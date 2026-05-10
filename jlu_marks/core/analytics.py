"""
analytics.py
────────────
Read-only reporting endpoints:

  GET /api/analytics/dashboard/
      → Role-aware summary stats (admin / faculty / student views differ)

  GET /api/analytics/course_summary/?course=CS301
      → Per-course stats: enrolled count, marks entered %, avg/max/min
          int_total, ese entered %, pass/fail counts

  GET /api/analytics/grade_distribution/?course=CS301
      → Grand total bucketed into grade bands (O / A+ / A / B+ / B / C / F)

  GET /api/analytics/toppers/?course=CS301&limit=10
      → Top-N students by grand_total for a course

  GET /api/analytics/student_report/?student=S001
      → Full academic report for a single student across all courses

  GET /api/analytics/ia_breakdown/?course=CS301
      → Per-component avg / max / min / entries-missing count
"""
from decimal import Decimal

from django.db.models import (
    Avg, Max, Min, Count, Sum, Q, F,
    DecimalField, ExpressionWrapper, FloatField,
)
from django.db.models.functions import Coalesce
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    CCR, IAComponent, MarksEntry, ResultSheet,
    Student, StudentEnrolment, Faculty,
)
from .permissions import IsAdminOrFaculty
from .serializers import ResultSheetSerializer


# ── Grade banding ──────────────────────────────────────────────────────────────

GRADE_BANDS = [
    ('O',  Decimal('90'),  Decimal('100')),
    ('A+', Decimal('80'),  Decimal('89.99')),
    ('A',  Decimal('70'),  Decimal('79.99')),
    ('B+', Decimal('60'),  Decimal('69.99')),
    ('B',  Decimal('50'),  Decimal('59.99')),
    ('C',  Decimal('40'),  Decimal('49.99')),
    ('F',  Decimal('0'),   Decimal('39.99')),
]


def assign_grade(grand_total):
    if grand_total is None:
        return 'N/A'
    for grade, lo, hi in GRADE_BANDS:
        if lo <= grand_total <= hi:
            return grade
    return 'F'


def _grade_distribution(sheets_qs):
    """Return dict of {grade_letter: count} from a ResultSheet queryset."""
    dist = {g: 0 for g, _, _ in GRADE_BANDS}
    dist['N/A'] = 0
    for sheet in sheets_qs.only('grand_total'):
        dist[assign_grade(sheet.grand_total)] += 1
    return dist


# ── Helpers ────────────────────────────────────────────────────────────────────

def _filter_courses(request):
    code = request.query_params.get('course', '').strip()
    prog = request.query_params.get('program', '').strip()
    school = request.query_params.get('school', '').strip()
    fac = request.query_params.get('faculty_of', '').strip()
    ay = request.query_params.get('academic_year', '').strip()
    sem = request.query_params.get('semester', '').strip()

    qs = CCR.objects.all()
    title = "System Wide"
    code_val = "ALL"

    if code:
        qs = qs.filter(course_code=code)
        title = code
        code_val = code
    elif prog:
        qs = qs.filter(program_id=prog)
        title = f"Program {prog}"
        code_val = f"PROG-{prog}"
    elif school:
        qs = qs.filter(program__school_id=school)
        title = f"School {school}"
        code_val = f"SCH-{school}"
    elif fac:
        qs = qs.filter(program__school__faculty_of_id=fac)
        title = f"Division {fac}"
        code_val = f"FAC-{fac}"
    else:
        return None, None, None, Response({'detail': 'Requires course, program, school, or faculty_of.'}, status=status.HTTP_400_BAD_REQUEST)

    if ay:
        qs = qs.filter(academic_year=ay)
    if sem:
        qs = qs.filter(semester=sem)

    if not qs.exists():
        return None, None, None, Response({'detail': 'No courses found for the given criteria.'}, status=status.HTTP_404_NOT_FOUND)

    return qs, title, code_val, None


# ── Views ──────────────────────────────────────────────────────────────────────

class DashboardView(APIView):
    """
    Role-aware dashboard.
    Admin  → system-wide counts + recent activity
    Faculty → their courses summary
    Student → their own results summary
    """

    def get(self, request):
        user = request.user
        role = user.role

        if role == 'admin':
            return self._admin_dashboard()
        if role == 'faculty':
            return self._faculty_dashboard(user)
        return self._student_dashboard(user)

    # ── Admin ──────────────────────────────────────────────────────────────────
    def _admin_dashboard(self):
        data = {
            'total_students': Student.objects.count(),
            'total_faculty':  Faculty.objects.count(),
            'total_courses':  CCR.objects.count(),
            'total_enrolments': StudentEnrolment.objects.count(),
            'marks_entries_pending': MarksEntry.objects.filter(marks_obtained__isnull=True).count(),
            'ese_pending': ResultSheet.objects.filter(ese_marks__isnull=True).count(),
            'result_sheets_complete': ResultSheet.objects.filter(grand_total__isnull=False).count(),
            'recent_marks_entries': list(
                MarksEntry.objects
                .select_related('student', 'component__course', 'entered_by')
                .order_by('-updated_at')[:10]
                .values(
                    'student__roll_no',
                    'component__name',
                    'component__course__course_code',
                    'marks_obtained',
                    'updated_at',
                )
            ),
        }
        return Response(data)

    # ── Faculty ────────────────────────────────────────────────────────────────
    def _faculty_dashboard(self, user):
        try:
            faculty = user.faculty_profile
        except Exception:
            return Response({'detail': 'Faculty profile not found.'}, status=404)

        courses = CCR.objects.filter(faculty=faculty).values(
            'course_code', 'course_name', 'semester', 'academic_year',
        )
        summary = []
        for c in courses:
            code      = c['course_code']
            enrolled  = StudentEnrolment.objects.filter(course_id=code).count()
            # Count only Regular attempt marks to avoid double-counting Makeup/Backlog
            # entries which would push the percentage beyond 100%.
            entered   = MarksEntry.objects.filter(
                component__course_id=code,
                marks_obtained__isnull=False,
                attempt_type='Regular',
            ).count()
            total_slots = IAComponent.objects.filter(course_id=code).count() * enrolled
            ese_pending = ResultSheet.objects.filter(course_id=code, ese_marks__isnull=True).count()
            summary.append({
                **c,
                'enrolled_students': enrolled,
                'marks_entered':     entered,
                'total_ia_slots':    total_slots,
                'marks_completion_pct': round(entered / total_slots * 100, 1) if total_slots else 0,
                'ese_pending':       ese_pending,
            })
        return Response({'courses': summary})

    # ── Student ────────────────────────────────────────────────────────────────
    def _student_dashboard(self, user):
        try:
            student = user.student_profile
        except Exception:
            return Response({'detail': 'Student profile not found.'}, status=404)

        results = (
            ResultSheet.objects
            .filter(student=student)
            .select_related('course')
            .order_by('course__semester', 'course__course_code')
        )
        result_data = []
        for r in results:
            result_data.append({
                'course_code':  r.course.course_code,
                'course_name':  r.course.course_name,
                'semester':     r.course.semester,
                'int_total':    r.int_total,
                'ese_marks':    r.ese_marks,
                'grand_total':  r.grand_total,
                'grade':        assign_grade(r.grand_total),
            })

        totals = [r['grand_total'] for r in result_data if r['grand_total'] is not None]
        return Response({
            'student_id':  student.student_id,
            'roll_no':     student.roll_no,
            'program':     student.program.name,
            'semester':    student.semester,
            'results':     result_data,
            'sgpa_approx': round(sum(totals) / len(totals) / 10, 2) if totals else None,
        })


class CourseSummaryView(APIView):
    """GET /api/analytics/course_summary/?course=CS301"""
    permission_classes = [IsAdminOrFaculty]

    def get(self, request):
        courses, title, code_val, err = _filter_courses(request)
        if courses is None:
            return err

        enrolled_count = StudentEnrolment.objects.filter(course__in=courses).count()
        components     = IAComponent.objects.filter(course__in=courses)
        
        courses_annotated = courses.annotate(enr_cnt=Count('enrolments', distinct=True), comp_cnt=Count('ia_components', distinct=True))
        total_slots = sum(c.enr_cnt * c.comp_cnt for c in courses_annotated)

        marks_qs = MarksEntry.objects.filter(component__course__in=courses)
        entered  = marks_qs.filter(marks_obtained__isnull=False).count()

        result_qs = ResultSheet.objects.filter(course__in=courses)
        ese_count = result_qs.filter(ese_marks__isnull=False).count()

        agg = result_qs.filter(int_total__isnull=False).aggregate(
            avg_int=Avg('int_total'),
            max_int=Max('int_total'),
            min_int=Min('int_total'),
        )
        ese_agg = result_qs.filter(ese_marks__isnull=False).aggregate(
            avg_ese=Avg('ese_marks'),
            max_ese=Max('ese_marks'),
            min_ese=Min('ese_marks'),
        )
        gt_agg = result_qs.filter(grand_total__isnull=False).aggregate(
            avg_gt=Avg('grand_total'),
            max_gt=Max('grand_total'),
            min_gt=Min('grand_total'),
        )

        passing = result_qs.filter(grand_total__gte=Decimal('40')).count()
        failing = result_qs.filter(grand_total__lt=Decimal('40')).count()

        return Response({
            'course_code':   code_val,
            'course_name':   title,
            'enrolled':      enrolled_count,
            'ia_components': components.count(),
            'marks_entered': entered,
            'total_ia_slots': total_slots,
            'marks_completion_pct': round(entered / total_slots * 100, 1) if total_slots else 0,
            'ese_entered': ese_count,
            'ese_completion_pct': round(ese_count / enrolled_count * 100, 1) if enrolled_count else 0,
            'int_total':  {'avg': agg['avg_int'],  'max': agg['max_int'],  'min': agg['min_int']},
            'ese_marks':  {'avg': ese_agg['avg_ese'], 'max': ese_agg['max_ese'], 'min': ese_agg['min_ese']},
            'grand_total': {'avg': gt_agg['avg_gt'],  'max': gt_agg['max_gt'],  'min': gt_agg['min_gt']},
            'pass_count':  passing,
            'fail_count':  failing,
            'pass_pct':    round(passing / enrolled_count * 100, 1) if enrolled_count else 0,
        })


class GradeDistributionView(APIView):
    """GET /api/analytics/grade_distribution/?course=CS301"""

    def get(self, request):
        courses, title, code_val, err = _filter_courses(request)
        if courses is None:
            return err

        sheets = ResultSheet.objects.filter(course__in=courses)
        dist   = _grade_distribution(sheets)
        total  = sum(dist.values())

        return Response({
            'course_code': code_val,
            'course_name': title,
            'total':       total,
            'distribution': [
                {
                    'grade': grade,
                    'count': dist.get(grade, 0),
                    'pct':   round(dist.get(grade, 0) / total * 100, 1) if total else 0,
                }
                for grade in [g for g, _, _ in GRADE_BANDS] + ['N/A']
            ],
        })


class TopperListView(APIView):
    """GET /api/analytics/toppers/?course=CS301&limit=10"""

    def get(self, request):
        courses, title, code_val, err = _filter_courses(request)
        if courses is None:
            return err

        limit = min(int(request.query_params.get('limit', 10)), 100)
        sheets = (
            ResultSheet.objects
            .filter(course__in=courses, grand_total__isnull=False)
            .select_related('student__user', 'student__program', 'course')
            .order_by('-grand_total')[:limit]
        )

        data = []
        for rank, sheet in enumerate(sheets, start=1):
            s = sheet.student
            data.append({
                'rank':        rank,
                'student_id':  s.student_id,
                'roll_no':     s.roll_no,
                'name':        f'{s.user.first_name} {s.user.last_name}',
                'course':      sheet.course.course_code,
                'int_total':   sheet.int_total,
                'ese_marks':   sheet.ese_marks,
                'grand_total': sheet.grand_total,
                'grade':       assign_grade(sheet.grand_total),
            })
        return Response({'course_code': code_val, 'toppers': data})


class StudentReportView(APIView):
    """
    GET /api/analytics/student_report/?student=S001
    Full academic report: all courses, all IA breakdowns, result, grade.
    """

    def get(self, request):
        sid = request.query_params.get('student', '').strip()
        if not sid:
            return Response({'detail': '`student` query param is required.'}, status=400)
        try:
            student = Student.objects.select_related('user', 'program__school').get(student_id=sid)
        except Student.DoesNotExist:
            return Response({'detail': f'Student {sid!r} not found.'}, status=404)

        # Students can only see their own report; admin/faculty see anyone's
        if request.user.role == 'student':
            try:
                if request.user.student_profile.student_id != sid:
                    return Response({'detail': 'Permission denied.'}, status=403)
            except Exception:
                return Response({'detail': 'Permission denied.'}, status=403)

        enrolments = (
            StudentEnrolment.objects
            .filter(student=student)
            .select_related('course__faculty')
            .order_by('course__semester', 'course__course_code')
        )

        # Prefetch all data in bulk — avoids N+1 across courses
        all_course_codes = [e.course_id for e in enrolments]

        all_results = {
            rs.course_id: rs
            for rs in ResultSheet.objects.filter(student=student, course_id__in=all_course_codes)
        }
        all_components = {}
        for comp in IAComponent.objects.filter(course_id__in=all_course_codes).order_by('name'):
            all_components.setdefault(comp.course_id, []).append(comp)

        all_entries = {}
        for me in MarksEntry.objects.filter(student=student, component__course_id__in=all_course_codes).select_related('component'):
            all_entries[me.component_id] = me

        courses_data = []
        for enr in enrolments:
            course = enr.course
            result = all_results.get(course.course_code)

            # IA breakdown
            components = all_components.get(course.course_code, [])
            ia_entries = all_entries  # already filtered to this student
            ia_breakdown = []
            for comp in components:
                entry = ia_entries.get(comp.id)
                ia_breakdown.append({
                    'component':    comp.name,
                    'mode':         comp.mode,
                    'max_marks':    comp.max_marks,
                    'weightage':    comp.weightage,
                    'marks':        entry.marks_obtained if entry else None,
                    'scaled_marks': entry.scaled_marks   if entry else None,
                })

            courses_data.append({
                'course_code':  course.course_code,
                'course_name':  course.course_name,
                'course_type':  course.course_type,
                'semester':     course.semester,
                'credits':      course.credits,
                'faculty':      course.faculty.name,
                'ia_breakdown': ia_breakdown,
                'int_total':    result.int_total   if result else None,
                'ese_marks':    result.ese_marks   if result else None,
                'grand_total':  result.grand_total if result else None,
                'grade':        assign_grade(result.grand_total if result else None),
            })

        completed = [c for c in courses_data if c['grand_total'] is not None]
        totals    = [c['grand_total'] for c in completed]

        return Response({
            'student_id':   student.student_id,
            'roll_no':      student.roll_no,
            'name':         f'{student.user.first_name} {student.user.last_name}',
            'program':      student.program.name,
            'school':       student.program.school.name,
            'semester':     student.semester,
            'academic_year': student.academic_year,
            'courses':      courses_data,
            'summary': {
                'courses_enrolled':  len(courses_data),
                'courses_completed': len(completed),
                'avg_grand_total':   round(sum(totals) / len(totals), 2) if totals else None,
                'highest_grade':     assign_grade(max(totals)) if totals else None,
            },
        })


class IABreakdownView(APIView):
    """GET /api/analytics/ia_breakdown/?course=CS301"""
    permission_classes = [IsAdminOrFaculty]

    def get(self, request):
        courses, title, code_val, err = _filter_courses(request)
        if courses is None:
            return err

        enrolled = StudentEnrolment.objects.filter(course__in=courses).count()
        components = IAComponent.objects.filter(course__in=courses).order_by('name').select_related('course')

        breakdown = []
        for comp in components:
            comp_enrolled = StudentEnrolment.objects.filter(course=comp.course).count()
            agg = MarksEntry.objects.filter(
                component=comp, marks_obtained__isnull=False
            ).aggregate(
                avg=Avg('marks_obtained'),
                high=Max('marks_obtained'),
                low=Min('marks_obtained'),
                cnt=Count('id'),
            )
            breakdown.append({
                'course':       comp.course.course_code,
                'component':    comp.name,
                'mode':         comp.mode,
                'max_marks':    comp.max_marks,
                'weightage':    comp.weightage,
                'entries':      agg['cnt'],
                'missing':      comp_enrolled - agg['cnt'],
                'avg_marks':    round(float(agg['avg']), 2) if agg['avg'] else None,
                'max_marks_scored': agg['high'],
                'min_marks_scored': agg['low'],
                'completion_pct': round(agg['cnt'] / comp_enrolled * 100, 1) if comp_enrolled else 0,
            })

        return Response({
            'course_code': code_val,
            'course_name': title,
            'enrolled':    enrolled,
            'components':  breakdown,
        })
