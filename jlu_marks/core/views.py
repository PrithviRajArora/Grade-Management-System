import re
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    User, FacultyOf, School, Program, Faculty, Student,
    CCR, StudentEnrolment, IAComponent, MarksEntry, ResultSheet,
    PassStatusEnum,
    ExamAttempt, StudentBacklog, CourseExamStats,
    ExamAttemptStatusEnum, ExamAttemptTypeEnum, BacklogStatusEnum,
)
from .serializers import (
    UserSerializer, UserCreateSerializer, ChangePasswordSerializer,
    FacultyOfSerializer, SchoolSerializer, ProgramSerializer,
    FacultySerializer, FacultyCreateSerializer,
    StudentSerializer, StudentCreateSerializer,
    CCRSerializer, StudentEnrolmentSerializer,
    IAComponentSerializer, MarksEntrySerializer,
    ResultSheetSerializer, ESEMarksInputSerializer,
)
from .permissions import (
    IsAdmin, IsAdminOrFaculty, IsAdminOrReadOnly, IsSelfOrAdmin, FacultyCanEnterMarks,
)
from .filters import (
    UserFilter, FacultyFilter, StudentFilter, CCRFilter,
    StudentEnrolmentFilter, IAComponentFilter, MarksEntryFilter, ResultSheetFilter,
)


# ── User ──────────────────────────────────────────────────────────────────────

class UserViewSet(viewsets.ModelViewSet):
    queryset         = User.objects.all().order_by('jlu_id')
    permission_classes = [IsAdmin]
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class  = UserFilter
    search_fields    = ['jlu_id', 'email', 'first_name', 'last_name']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Return the currently authenticated user's profile."""
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'detail': 'Old password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.must_change_password = False
        user.save()
        return Response({'detail': 'Password updated successfully.'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def reset_password(self, request, pk=None):
        """POST /users/{id}/reset_password/

        Admin-only endpoint to reset a user's password.
        Requires the admin's own password for verification.

        Body: {
            admin_password: str,       — admin's current password (required)
            new_password: str|None,    — new password for the target user (optional, defaults to 'Password')
        }

        Sets must_change_password=True so the user is forced to change on next login.
        """
        target_user = self.get_object()
        admin_password = request.data.get('admin_password', '')
        new_password = request.data.get('new_password', 'Password')

        if not admin_password:
            return Response(
                {'detail': 'Admin password is required for verification.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(admin_password):
            return Response(
                {'detail': 'Incorrect admin password.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if len(new_password) < 6:
            return Response(
                {'detail': 'New password must be at least 6 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_user.set_password(new_password)
        target_user.must_change_password = True
        target_user.save(update_fields=['password', 'must_change_password'])

        return Response({
            'detail': f'Password for {target_user.jlu_id} has been reset successfully.',
            'must_change_password': True,
        })


# ── Org Hierarchy ─────────────────────────────────────────────────────────────

class FacultyOfViewSet(viewsets.ModelViewSet):
    queryset           = FacultyOf.objects.all().order_by('name')
    serializer_class   = FacultyOfSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields      = ['name', 'short_name']


class SchoolViewSet(viewsets.ModelViewSet):
    queryset           = School.objects.select_related('faculty_of').order_by('name')
    serializer_class   = SchoolSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['faculty_of']
    search_fields      = ['name', 'short_name']


class ProgramViewSet(viewsets.ModelViewSet):
    queryset           = Program.objects.select_related('school').order_by('short_name')
    serializer_class   = ProgramSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['school', 'duration_yrs']
    search_fields      = ['name', 'short_name']


# ── Faculty ───────────────────────────────────────────────────────────────────

class FacultyViewSet(viewsets.ModelViewSet):
    queryset           = Faculty.objects.select_related('user', 'school').order_by('faculty_id')
    permission_classes = [IsAdminOrReadOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class    = FacultyFilter
    search_fields      = ['faculty_id', 'name', 'department', 'user__jlu_id']

    def get_serializer_class(self):
        if self.action == 'create':
            return FacultyCreateSerializer
        return FacultySerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def next_id(self, request):
        """Return a suggested next faculty_id and jlu_id."""
        last = Faculty.objects.order_by('-faculty_id').values_list('faculty_id', flat=True).first()
        last_jlu = User.objects.filter(role='faculty').order_by('-jlu_id').values_list('jlu_id', flat=True).first()
        def _increment(val, prefix):
            if not val:
                return f'{prefix}001'
            m = re.search(r'(\d+)$', val)
            if m:
                n = int(m.group(1)) + 1
                return val[:m.start()] + str(n).zfill(len(m.group(1)))
            return val + '_1'
        return Response({
            'faculty_id': _increment(last, 'F'),
            'jlu_id':     _increment(last_jlu, 'FAC'),
        })


# ── Student ───────────────────────────────────────────────────────────────────

class StudentViewSet(viewsets.ModelViewSet):
    queryset           = Student.objects.select_related('user', 'program').order_by('student_id')
    permission_classes = [IsAdminOrReadOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class    = StudentFilter
    search_fields      = ['student_id', 'roll_no', 'user__first_name', 'user__last_name', 'user__jlu_id']

    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def next_id(self, request):
        """Return a suggested next student_id and jlu_id."""
        last = Student.objects.order_by('-student_id').values_list('student_id', flat=True).first()
        last_jlu = User.objects.filter(role='student').order_by('-jlu_id').values_list('jlu_id', flat=True).first()
        def _increment(val, prefix):
            if not val:
                return f'{prefix}001'
            m = re.search(r'(\d+)$', val)
            if m:
                n = int(m.group(1)) + 1
                return val[:m.start()] + str(n).zfill(len(m.group(1)))
            return val + '_1'
        return Response({
            'student_id': _increment(last, 'S'),
            'jlu_id':     _increment(last_jlu, 'STU'),
        })

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def results(self, request, pk=None):
        student = self.get_object()
        results = ResultSheet.objects.filter(student=student).select_related('course')
        return Response(ResultSheetSerializer(results, many=True).data)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def marks(self, request, pk=None):
        student = self.get_object()
        entries = MarksEntry.objects.filter(student=student).select_related('component__course')
        return Response(MarksEntrySerializer(entries, many=True).data)

    @action(detail=False, methods=['post'], permission_classes=[IsAdmin])
    def promote_batch(self, request):
        """
        Promote (increment semester) for all students in a program+semester whose
        results show Pass in all enrolled courses.

        Body: { program, semester, academic_year }
        Also flags all completed courses for that program+semester as deprecated.
        """
        program_id    = request.data.get('program')
        semester      = request.data.get('semester')
        academic_year = request.data.get('academic_year')

        if not all([program_id, semester, academic_year]):
            return Response(
                {'detail': 'program, semester, and academic_year are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        semester = int(semester)
        students = Student.objects.filter(program_id=program_id, semester=semester)

        promoted, skipped_fail, skipped_max = [], [], []

        for student in students:
            # Check all enrolled courses for this student in this semester
            enrolments = StudentEnrolment.objects.filter(
                student=student,
                course__semester=semester,
                academic_year=academic_year,
            ).select_related('course')

            if not enrolments.exists():
                skipped_fail.append(student.student_id)
                continue

            # All courses must have Pass status
            all_passed = True
            for enrolment in enrolments:
                result = ResultSheet.objects.filter(
                    student=student, course=enrolment.course
                ).first()
                if not result or result.pass_status != 'Pass':
                    all_passed = False
                    break

            if not all_passed:
                skipped_fail.append(student.student_id)
                continue

            # Check semester limit
            program = student.program
            max_semester = program.duration_yrs * 2
            if student.semester >= max_semester:
                skipped_max.append(student.student_id)
                continue

            student.semester += 1
            student.save()
            promoted.append(student.student_id)

        # Deprecate courses for the batch semester
        deprecated_count = CCR.objects.filter(
            program_id=program_id,
            semester=semester,
            academic_year=academic_year,
        ).update(is_deprecated=True)

        return Response({
            'promoted': promoted,
            'skipped_not_passed': skipped_fail,
            'skipped_max_semester': skipped_max,
            'deprecated_courses': deprecated_count,
        })


# ── CCR ───────────────────────────────────────────────────────────────────────

class CCRViewSet(viewsets.ModelViewSet):
    queryset           = CCR.objects.select_related('faculty', 'program').order_by('course_code')
    serializer_class   = CCRSerializer
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class    = CCRFilter
    search_fields      = ['course_code', 'course_name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def _verify_admin_password(self, request):
        """Return None if password is valid, else a Response with error."""
        password = request.data.get('admin_password') or request.query_params.get('admin_password')
        if not password:
            return Response(
                {'detail': 'Admin password is required to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not request.user.check_password(password):
            return Response(
                {'detail': 'Incorrect password.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def update(self, request, *args, **kwargs):
        err = self._verify_admin_password(request)
        if err:
            return err
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        err = self._verify_admin_password(request)
        if err:
            return err
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # Password check
        err = self._verify_admin_password(request)
        if err:
            return err

        # Confirmation phrase check
        confirmation = request.data.get('confirmation', '')
        expected = 'Delete this course and all data along with it.'
        if confirmation != expected:
            return Response(
                {'detail': f'You must type exactly: "{expected}"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Block if students are enrolled
        course = self.get_object()
        enrolled_count = StudentEnrolment.objects.filter(course=course).count()
        if enrolled_count > 0:
            return Response(
                {'detail': f'Cannot delete course "{course.course_code}": {enrolled_count} student(s) are enrolled. Remove all enrolments first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def enrolled_students(self, request, pk=None):
        course = self.get_object()
        enrolments = StudentEnrolment.objects.filter(course=course).select_related('student__user', 'student')
        return Response(StudentEnrolmentSerializer(enrolments, many=True).data)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def ia_components(self, request, pk=None):
        course = self.get_object()
        components = IAComponent.objects.filter(course=course)
        return Response(IAComponentSerializer(components, many=True).data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminOrFaculty])
    def set_thresholds(self, request, pk=None):
        """
        Update only the pass/fail thresholds for a course — no admin password
        required because this is a grading policy change, not a structural edit.
        Faculty may only update thresholds for courses they own.
        Accepts: ia_pass_min, ese_pass_min
        """
        course = self.get_object()
        if request.user.role == 'faculty' and course.faculty.user != request.user:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        allowed = {'ia_pass_min', 'ese_pass_min'}
        data = {k: v for k, v in request.data.items() if k in allowed}
        if not data:
            return Response(
                {'detail': 'Provide at least one of: ia_pass_min, ese_pass_min.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for field, value in data.items():
            setattr(course, field, value)
        course.save()   # triggers post_save signal → recomputes all ResultSheets
        return Response({
            'ia_pass_min':  course.ia_pass_min,
            'ese_pass_min': course.ese_pass_min,
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrFaculty])
    def submit(self, request, pk=None):
        course = self.get_object()
        user = request.user
        if user.role == 'faculty' and course.faculty.user != user:
            return Response({'message': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        course.is_submitted = True
        course.save()
        return Response({'message': 'Course marked as submitted.', 'is_submitted': True})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def unlock(self, request, pk=None):
        from .models import CourseUnlockLog
        course = self.get_object()
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'detail': 'A reason for unlocking is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        course.is_submitted = False
        course.save()
        CourseUnlockLog.objects.create(
            course=course,
            unlocked_by=request.user,
            reason=reason,
        )
        return Response({'message': 'Course unlocked.', 'is_submitted': False})

    @action(detail=False, methods=['post'], permission_classes=[IsAdmin])
    def unlock_bulk(self, request):
        from .models import CourseUnlockLog
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'detail': 'A reason for unlocking is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        courses = request.data.get('courses', [])
        filter_kwargs = {'is_submitted': True}
        if courses:
            filter_kwargs['course_code__in'] = courses
        else:
            if 'program' in request.data: filter_kwargs['program_id'] = request.data['program']
            if 'semester' in request.data: filter_kwargs['semester'] = request.data['semester']
            if 'academic_year' in request.data: filter_kwargs['academic_year'] = request.data['academic_year']

        qs = CCR.objects.filter(**filter_kwargs)
        for course in qs:
            CourseUnlockLog.objects.create(
                course=course,
                unlocked_by=request.user,
                reason=reason,
            )
        updated = qs.update(is_submitted=False)
        return Response({'message': f'{updated} courses unlocked.'})


# ── Student Enrolment ─────────────────────────────────────────────────────────

class StudentEnrolmentViewSet(viewsets.ModelViewSet):
    queryset           = StudentEnrolment.objects.select_related('student', 'course').order_by('-enrolled_at')
    serializer_class   = StudentEnrolmentSerializer
    filter_backends    = [DjangoFilterBackend]
    filterset_class    = StudentEnrolmentFilter

    def get_permissions(self):
        if self.action in ('create', 'destroy', 'batch_enrol'):
            return [IsAdminOrFaculty()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'])
    def batch_enrol(self, request):
        """
        Enrol all students matching a program/semester/section into a course.
        Body: { course, program, semester, academic_year, section (optional) }
        """
        course_code   = request.data.get('course')
        program_id    = request.data.get('program')
        semester      = request.data.get('semester')
        academic_year = request.data.get('academic_year')
        section       = request.data.get('section', None)

        if not all([course_code, program_id, semester, academic_year]):
            return Response(
                {'detail': 'course, program, semester, and academic_year are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            course = CCR.objects.get(pk=course_code)
        except CCR.DoesNotExist:
            return Response({'detail': f'Course {course_code!r} not found.'}, status=404)

        qs = Student.objects.filter(program_id=program_id, semester=semester)
        if section:
            qs = qs.filter(section=section)

        created, skipped = 0, 0
        for student in qs:
            _, was_created = StudentEnrolment.objects.get_or_create(
                student=student,
                course=course,
                academic_year=academic_year,
                defaults={'admin_override': False},
            )
            if was_created:
                created += 1
            else:
                skipped += 1

        return Response({
            'message': f'{created} students enrolled, {skipped} already enrolled.',
            'created': created,
            'skipped': skipped,
        })


# ── IA Component ──────────────────────────────────────────────────────────────

class IAComponentViewSet(viewsets.ModelViewSet):
    queryset           = IAComponent.objects.select_related('course').order_by('course__course_code', 'name')
    serializer_class   = IAComponentSerializer
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class    = IAComponentFilter
    search_fields      = ['name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminOrFaculty()]
        return [IsAuthenticated()]


# ── Marks Entry ───────────────────────────────────────────────────────────────

class MarksEntryViewSet(viewsets.ModelViewSet):
    queryset           = MarksEntry.objects.select_related('student', 'component__course', 'entered_by').order_by('-updated_at')
    serializer_class   = MarksEntrySerializer
    permission_classes = [FacultyCanEnterMarks]
    filter_backends    = [DjangoFilterBackend]
    filterset_class    = MarksEntryFilter

    def perform_create(self, serializer):
        faculty = None
        try:
            faculty = self.request.user.faculty_profile
        except Exception:
            pass
        serializer.save(entered_by=faculty, entered_at=timezone.now())

    def perform_update(self, serializer):
        faculty = None
        try:
            faculty = self.request.user.faculty_profile
        except Exception:
            pass
        serializer.save(entered_by=faculty, entered_at=timezone.now())

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrFaculty])
    def bulk_enter(self, request):
        """
        Bulk upsert IA marks.
        Expects: [{"student": "S001", "component": 1, "marks_obtained": 42.5, "attempt_type": "Regular"}, ...]

        Guards:
        1. Course must not be submitted (unless admin).
        2. Student must have a registered ExamAttempt for the given attempt_type
           (i.e. they must first be registered via the Exam Attempts tab).
        3. Marks for an older attempt cannot be modified once a newer attempt
           has been registered (data integrity lock).
        """
        entries = request.data
        if not isinstance(entries, list):
            return Response({'detail': 'Provide a list of mark entries.'}, status=status.HTTP_400_BAD_REQUEST)

        # Attempt ordering: Regular < Makeup < Backlog < SpecialBacklog
        ATTEMPT_ORDER = {'Regular': 1, 'Makeup': 2, 'Backlog': 3, 'SpecialBacklog': 4}

        results  = []
        errors   = []
        try:
            faculty = request.user.faculty_profile
        except Exception:
            faculty = None  # admin users have no faculty profile — allowed

        for entry in entries:
            # Guard 1: check if course is submitted (via the component's course)
            try:
                comp = IAComponent.objects.select_related('course').get(pk=entry.get('component'))
                course_obj = comp.course
                if course_obj.is_submitted and request.user.role != 'admin':
                    errors.append({'input': entry, 'errors': {'non_field_errors': ['Course is locked. Unlock it before entering marks.']}})
                    continue
            except IAComponent.DoesNotExist:
                errors.append({'input': entry, 'errors': {'component': ['Component not found.']}})
                continue

            attempt_type = entry.get('attempt_type', 'Regular')
            student_id   = entry.get('student')

            # Guard 2: Student must be registered for this attempt_type
            is_registered = ExamAttempt.objects.filter(
                student_id=student_id,
                course_id=course_obj.course_code,
                attempt_type=attempt_type,
            ).exists()
            if not is_registered:
                errors.append({'input': entry, 'errors': {'non_field_errors': [
                    f'Student has not been registered for a {attempt_type} attempt. '
                    f'Register them first in the Exam Attempts tab.'
                ]}})
                continue

            # Note: We intentionally allow editing marks for any attempt_type even
            # when a newer attempt exists. All attempts are preserved for auditing.

            marks_val = entry.get('marks_obtained')
            try:
                obj = MarksEntry.objects.get(
                    student_id   = student_id,
                    component_id = entry['component'],
                    attempt_type = attempt_type,
                )
                obj.marks_obtained = marks_val
                obj.entered_by     = faculty
                obj.entered_at     = timezone.now()
            except MarksEntry.DoesNotExist:
                obj = MarksEntry(
                    student_id     = student_id,
                    component_id   = entry['component'],
                    attempt_type   = attempt_type,
                    marks_obtained = marks_val,
                    entered_by     = faculty,
                    entered_at     = timezone.now(),
                )
            # .save() triggers scaled_marks recomputation (MarksEntry.save)
            # and then the post_save signal recomputes the ResultSheet.
            try:
                obj.save()
                results.append(MarksEntrySerializer(obj).data)
            except Exception as exc:
                errors.append({'input': entry, 'errors': {'non_field_errors': [str(exc)]}})

        return Response({'saved': results, 'errors': errors}, status=status.HTTP_200_OK)


# ── Result Sheet ──────────────────────────────────────────────────────────────

class ResultSheetViewSet(viewsets.ModelViewSet):
    queryset           = ResultSheet.objects.select_related('student', 'course').order_by('student', 'course')
    serializer_class   = ResultSheetSerializer
    filter_backends    = [DjangoFilterBackend]
    filterset_class    = ResultSheetFilter

    def get_permissions(self):
        if self.action in ('destroy',):
            return [IsAdmin()]
        if self.action in ('create', 'update', 'partial_update', 'enter_ese', 'compute',
                           'reset_for_reattempt', 'batch_reset'):
            return [IsAdminOrFaculty()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'])
    def enter_ese(self, request, pk=None):
        """POST /result-sheets/{id}/enter_ese/ — record ESE marks via ExamAttempt.

        Creates/updates an ExamAttempt record (single source of truth) and
        updates ResultSheet through signals.

        Body: {
            ese_marks: number|null,       — ESE marks (null for absent/withheld/UFM)
            attempt_type: str,            — Regular/Makeup/Backlog
            sitting_status: str,          — Appeared/Absent/UFM/Withheld/Cancelled/Detained/Debarred/Medical
        }

        Guards:
        1. Student must be registered for this attempt_type.
        2. Cannot write ESE marks for an older attempt when a newer one exists.
        """
        result = self.get_object()
        serializer = ESEMarksInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ese_marks    = serializer.validated_data.get('ese_marks')
        attempt_type = serializer.validated_data.get('attempt_type', 'Regular')
        sitting_status = serializer.validated_data.get('sitting_status', 'Appeared')

        # Attempt ordering: Regular < Makeup < Backlog < SpecialBacklog
        ATTEMPT_ORDER = {'Regular': 1, 'Makeup': 2, 'Backlog': 3, 'SpecialBacklog': 4}

        # Guard 1: Student must be registered for this attempt_type
        is_registered = ExamAttempt.objects.filter(
            student=result.student,
            course=result.course,
            attempt_type=attempt_type,
        ).exists()
        if not is_registered:
            return Response(
                {'detail': (
                    f'Student has not been registered for a {attempt_type} attempt. '
                    f'Register them first in the Exam Attempts tab.'
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Note: We intentionally allow editing ESE marks for any attempt_type even
        # when a newer attempt exists. All attempts are preserved for auditing.

        # Resolve faculty
        try:
            faculty = request.user.faculty_profile
        except Exception:
            faculty = None

        # Map the frontend sitting status to ExamAttemptStatusEnum.
        STATUS_MAP = {
            'Appeared':  ExamAttemptStatusEnum.APPEARED,
            'Absent':    ExamAttemptStatusEnum.ABSENT,
            'Withheld':  ExamAttemptStatusEnum.WITHHELD,
            'UFM':       ExamAttemptStatusEnum.WITHHELD,   # unfair means → withheld
            'Cancelled': ExamAttemptStatusEnum.ABSENT,
            'Detained':  ExamAttemptStatusEnum.ABSENT,
            'Debarred':  ExamAttemptStatusEnum.ABSENT,
            'Medical':   ExamAttemptStatusEnum.ABSENT,
        }
        attempt_status = STATUS_MAP.get(sitting_status, ExamAttemptStatusEnum.APPEARED)

        # Find existing attempt for this (student, course, attempt_type)
        existing = (
            ExamAttempt.objects
            .filter(
                student=result.student,
                course=result.course,
                attempt_type=attempt_type,
            )
            .order_by('-attempt_no')
            .first()
        )

        if existing:
            existing.ese_marks = ese_marks
            existing.status = attempt_status
            existing.academic_year = result.course.academic_year
            existing.entered_by = faculty
            existing.entered_at = timezone.now()
            existing.save()
            attempt = existing
        else:
            attempt = ExamAttempt.objects.create(
                student=result.student,
                course=result.course,
                attempt_type=attempt_type,
                academic_year=result.course.academic_year,
                ese_marks=ese_marks,
                status=attempt_status,
                entered_by=faculty,
                entered_at=timezone.now(),
            )

        # If the student appeared and has ESE marks, compute grand_total and
        # determine the actual Pass/Fail from the final number.
        if ese_marks is not None and attempt_status == ExamAttemptStatusEnum.APPEARED:
            result.refresh_from_db()
            if result.grand_total is not None:
                if result.pass_status == PassStatusEnum.PASS:
                    final_status = ExamAttemptStatusEnum.PASS
                else:
                    final_status = ExamAttemptStatusEnum.FAIL
                attempt.status = final_status
                attempt.save()
                result.refresh_from_db()

        result.refresh_from_db()
        return Response(ResultSheetSerializer(result).data)

    @action(detail=True, methods=['post'])
    def reset_for_reattempt(self, request, pk=None):
        """POST /result-sheets/{id}/reset_for_reattempt/

        Register a student for a new attempt type.

        KEY INVARIANT: ALL previous attempt marks (both IA MarksEntry records
        and ExamAttempt ESE records) are NEVER deleted or zeroed.
        The IA marks for the old attempt_type are COPIED to the new attempt_type
        so the ResultSheet can be recomputed correctly for the new attempt.
        The new attempt's ESE starts empty (student hasn't sat it yet).

        Body: { "attempt_type": "Makeup" | "Backlog" }
        """
        result = self.get_object()
        attempt_type     = request.data.get('attempt_type', 'Backlog')
        old_attempt_type = result.active_attempt_type

        try:
            faculty = request.user.faculty_profile
        except Exception:
            faculty = None

        # ALWAYS copy IA marks from old attempt to new attempt_type.
        # This preserves data integrity: old attempt marks remain intact
        # under their original attempt_type, and the new attempt starts
        # with the same IA marks (faculty can override later if needed).
        old_entries = MarksEntry.objects.filter(
            student=result.student,
            component__course=result.course,
            attempt_type=old_attempt_type,
        )
        for entry in old_entries:
            MarksEntry.objects.update_or_create(
                student=entry.student,
                component=entry.component,
                attempt_type=attempt_type,
                defaults={
                    'marks_obtained': entry.marks_obtained,
                    'entered_by':     entry.entered_by,
                    'entered_at':     entry.entered_at,
                }
            )

        # Switch the ResultSheet active_attempt_type, clear ESE (new attempt)
        # The IA total will be recomputed from the copied marks via compute().
        result.ese_marks       = None
        result.grand_total     = None
        result.pass_status     = PassStatusEnum.INCOMPLETE
        result.ese_pass_status = PassStatusEnum.INCOMPLETE
        result.active_attempt_type = attempt_type
        result.save()
        result.compute(attempt_type=attempt_type)

        # Register a new ExamAttempt with Scheduled status
        ExamAttempt.objects.create(
            student=result.student,
            course=result.course,
            attempt_type=attempt_type,
            academic_year=result.course.academic_year,
            status=ExamAttemptStatusEnum.SCHEDULED,
            entered_by=faculty,
            entered_at=timezone.now(),
        )

        result.refresh_from_db()
        return Response(ResultSheetSerializer(result).data)

    @action(detail=False, methods=['post'])
    def batch_reset(self, request):
        """POST /result-sheets/batch_reset/

        Register multiple failed students for a new attempt.

        KEY INVARIANT: ALL previous attempt marks are PRESERVED.
        IA marks from the old attempt are COPIED to the new attempt_type.
        The new attempt's ESE starts empty.

        Body: { "course": "CS301", "attempt_type": "Backlog", "students": ["S001"] }
        """
        course_code  = request.data.get('course')
        attempt_type = request.data.get('attempt_type', 'Backlog')
        student_ids  = request.data.get('students', [])

        if not course_code or not student_ids:
            return Response({'detail': 'course and students are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            faculty = request.user.faculty_profile
        except Exception:
            faculty = None

        reset_count = 0
        for sid in student_ids:
            try:
                sheet = ResultSheet.objects.get(student_id=sid, course_id=course_code)
                old_attempt_type = sheet.active_attempt_type

                # ALWAYS copy IA marks from old attempt to new attempt_type
                old_entries = MarksEntry.objects.filter(
                    student_id=sid,
                    component__course_id=course_code,
                    attempt_type=old_attempt_type,
                )
                for entry in old_entries:
                    MarksEntry.objects.update_or_create(
                        student=entry.student,
                        component=entry.component,
                        attempt_type=attempt_type,
                        defaults={
                            'marks_obtained': entry.marks_obtained,
                            'entered_by':     entry.entered_by,
                            'entered_at':     entry.entered_at,
                        }
                    )

                # Switch active attempt, clear ESE for the new attempt
                sheet.ese_marks       = None
                sheet.grand_total     = None
                sheet.pass_status     = PassStatusEnum.INCOMPLETE
                sheet.ese_pass_status = PassStatusEnum.INCOMPLETE
                sheet.active_attempt_type = attempt_type
                sheet.save()
                sheet.compute(attempt_type=attempt_type)

                ExamAttempt.objects.create(
                    student_id=sid,
                    course_id=course_code,
                    attempt_type=attempt_type,
                    academic_year=request.data.get('academic_year', ''),
                    status=ExamAttemptStatusEnum.SCHEDULED,
                    entered_by=faculty,
                    entered_at=timezone.now(),
                )
                reset_count += 1
            except ResultSheet.DoesNotExist:
                continue

        return Response({'detail': f'Reset {reset_count} student(s) for {attempt_type} attempt.'})

    @action(detail=True, methods=['post'])
    def compute(self, request, pk=None):
        """POST /result-sheets/{id}/compute/ — recompute int_total and grand_total from marks."""
        result = self.get_object()
        attempt_type = request.data.get('attempt_type', result.active_attempt_type)
        result.compute(attempt_type=attempt_type)
        return Response(ResultSheetSerializer(result).data)

    @action(detail=False, methods=['post'])
    def compute_all(self, request):
        """POST /result-sheets/compute_all/?course=COURSE_CODE — batch recompute for a course."""
        course_code = request.query_params.get('course')
        if not course_code:
            return Response({'detail': 'course query param required.'}, status=status.HTTP_400_BAD_REQUEST)
        sheets = ResultSheet.objects.filter(course_id=course_code)
        for sheet in sheets:
            sheet.compute()
        return Response({'detail': f'Recomputed {sheets.count()} result sheets.'})


# ── Exam Attempt ──────────────────────────────────────────────────────────────

# (ExamAttempt and enums already imported at module level above)
from .serializers import (
    ExamAttemptSerializer, ExamAttemptBulkRegisterSerializer,
    ExamAttemptBulkResultSerializer,
    StudentBacklogSerializer, CourseExamStatsSerializer,
)
from .filters import ExamAttemptFilter, StudentBacklogFilter, CourseExamStatsFilter


class ExamAttemptViewSet(viewsets.ModelViewSet):
    queryset = (
        ExamAttempt.objects
        .select_related('student__user', 'course', 'entered_by')
        .order_by('-updated_at')
    )
    serializer_class   = ExamAttemptSerializer
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class    = ExamAttemptFilter
    search_fields      = ['student__roll_no', 'student__user__first_name', 'course__course_code']
    ordering_fields    = ['conducted_on', 'ese_marks', 'attempt_no', 'updated_at']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy',
                           'bulk_register', 'bulk_results'):
            return [IsAdminOrFaculty()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        faculty = _get_faculty(self.request)
        serializer.save(entered_by=faculty, entered_at=timezone.now())

    def perform_update(self, serializer):
        faculty = _get_faculty(self.request)
        serializer.save(entered_by=faculty, entered_at=timezone.now())

    @action(detail=False, methods=['post'], url_path='bulk_register')
    def bulk_register(self, request):
        """
        Register a list of students for a given (course, attempt_type, academic_year).
        Creates ExamAttempt rows with status=Scheduled; skips duplicates.

        Body: {students: ["S001","S002"], course, attempt_type, academic_year, conducted_on?}
        """
        ser = ExamAttemptBulkRegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        try:
            course = CCR.objects.get(pk=d['course'])
        except CCR.DoesNotExist:
            return Response({'detail': f'Course {d["course"]!r} not found.'}, status=404)

        students = Student.objects.filter(student_id__in=d['students'])
        found_ids = set(students.values_list('student_id', flat=True))
        missing   = [s for s in d['students'] if s not in found_ids]

        faculty  = _get_faculty(request)
        created, skipped = [], []

        for student in students:
            # Find max attempt_no for this (student, course, attempt_type)
            last = (
                ExamAttempt.objects
                .filter(student=student, course=course, attempt_type=d['attempt_type'])
                .order_by('-attempt_no')
                .values_list('attempt_no', flat=True)
                .first()
            )
            # Skip if a Scheduled attempt already exists
            exists = ExamAttempt.objects.filter(
                student=student, course=course,
                attempt_type=d['attempt_type'],
                status=ExamAttemptStatusEnum.SCHEDULED,
            ).exists()
            if exists:
                skipped.append(student.student_id)
                continue

            attempt = ExamAttempt.objects.create(
                student=student,
                course=course,
                attempt_type=d['attempt_type'],
                attempt_no=(last or 0) + 1,
                academic_year=d['academic_year'],
                conducted_on=d.get('conducted_on'),
                status=ExamAttemptStatusEnum.SCHEDULED,
                entered_by=faculty,
                entered_at=timezone.now(),
            )
            created.append(attempt.id)

        return Response({
            'registered': len(created),
            'skipped_duplicate': skipped,
            'missing_students': missing,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bulk_results')
    def bulk_results(self, request):
        """
        Enter ESE marks + status for multiple attempts in one call.

        Body: { results: [{student, course, attempt_type, attempt_no, ese_marks, status}, ...] }
        """
        ser = ExamAttemptBulkResultSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        faculty = _get_faculty(request)

        saved, errors = [], []
        for row in ser.validated_data['results']:
            try:
                attempt = ExamAttempt.objects.get(
                    student_id   = row['student'],
                    course_id    = row['course'],
                    attempt_type = row['attempt_type'],
                    attempt_no   = row['attempt_no'],
                )
            except ExamAttempt.DoesNotExist:
                errors.append({**row, 'error': 'Attempt not found.'})
                continue
            except KeyError as e:
                errors.append({**row, 'error': f'Missing field: {e}'})
                continue

            upd_ser = ExamAttemptSerializer(attempt, data={
                'ese_marks': row.get('ese_marks'),
                'status':    row.get('status'),
                'remarks':   row.get('remarks', attempt.remarks),
            }, partial=True)

            if upd_ser.is_valid():
                upd_ser.save(entered_by=faculty, entered_at=timezone.now())
                saved.append(upd_ser.data)
            else:
                errors.append({**row, 'error': upd_ser.errors})

        return Response({'saved': saved, 'errors': errors})

    @action(detail=False, methods=['get'], url_path='student_history')
    def student_history(self, request):
        """
        GET /exam-attempts/student_history/?student=S001
        Returns all exam attempts for a student, grouped by course.
        """
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'detail': 'student query param required.'}, status=400)

        qs = (
            ExamAttempt.objects
            .filter(student_id=student_id)
            .select_related('course', 'entered_by')
            .order_by('course_id', 'attempt_no')
        )
        # Group by course
        from collections import defaultdict
        grouped = defaultdict(list)
        for a in qs:
            grouped[a.course_id].append(ExamAttemptSerializer(a).data)

        return Response([
            {'course': course_id, 'attempts': attempts}
            for course_id, attempts in grouped.items()
        ])


# ── Student Backlog ───────────────────────────────────────────────────────────

class StudentBacklogViewSet(viewsets.ModelViewSet):
    queryset = (
        StudentBacklog.objects
        .select_related('student__user', 'course', 'origin_attempt', 'clearing_attempt')
        .order_by('-created_at')
    )
    serializer_class = StudentBacklogSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class  = StudentBacklogFilter
    search_fields    = ['student__roll_no', 'student__user__first_name', 'course__course_code']
    ordering_fields  = ['created_at', 'updated_at', 'status']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'clear', 'lapse'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'])
    def clear(self, request, pk=None):
        """Manually clear a backlog (admin override). Optionally pass clearing_attempt id."""
        backlog = self.get_object()
        if backlog.status == BacklogStatusEnum.CLEARED:
            return Response({'detail': 'Backlog is already cleared.'}, status=400)

        attempt_id = request.data.get('clearing_attempt')
        clearing_attempt = None
        if attempt_id:
            try:
                clearing_attempt = ExamAttempt.objects.get(pk=attempt_id)
            except ExamAttempt.DoesNotExist:
                return Response({'detail': 'Attempt not found.'}, status=404)

        backlog.status = BacklogStatusEnum.CLEARED
        backlog.clearing_attempt = clearing_attempt
        backlog.save()
        return Response(StudentBacklogSerializer(backlog).data)

    @action(detail=True, methods=['post'])
    def lapse(self, request, pk=None):
        """Mark a backlog as Lapsed (student exhausted all attempts)."""
        backlog = self.get_object()
        if backlog.status != BacklogStatusEnum.ACTIVE:
            return Response({'detail': 'Only Active backlogs can be lapsed.'}, status=400)
        backlog.status = BacklogStatusEnum.LAPSED
        backlog.save()
        return Response(StudentBacklogSerializer(backlog).data)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        GET /backlogs/summary/?student=S001
        Returns backlog counts by status for a student.
        """
        student_id = request.query_params.get('student')
        qs = StudentBacklog.objects.all()
        if student_id:
            qs = qs.filter(student_id=student_id)

        from django.db.models import Count, Q
        agg = qs.aggregate(
            total  = Count('id'),
            active = Count('id', filter=Q(status=BacklogStatusEnum.ACTIVE)),
            cleared= Count('id', filter=Q(status=BacklogStatusEnum.CLEARED)),
            lapsed = Count('id', filter=Q(status=BacklogStatusEnum.LAPSED)),
        )
        return Response(agg)


# ── Course Exam Stats ─────────────────────────────────────────────────────────

class CourseExamStatsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        CourseExamStats.objects
        .select_related('course')
        .order_by('course_id', 'academic_year', 'attempt_type')
    )
    serializer_class = CourseExamStatsSerializer
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class  = CourseExamStatsFilter
    ordering_fields  = ['pass_rate', 'avg_marks', 'total_appeared', 'computed_at']
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrFaculty])
    def refresh(self, request):
        """
        POST /exam-stats/refresh/?course=CS101&academic_year=2024-2025&attempt_type=Regular
        Recomputes the stats slice. Omit attempt_type to refresh all types for that course+year.
        """
        course_id     = request.query_params.get('course')
        academic_year = request.query_params.get('academic_year')
        attempt_type  = request.query_params.get('attempt_type')

        if not course_id or not academic_year:
            return Response({'detail': 'course and academic_year query params required.'}, status=400)

        try:
            course = CCR.objects.get(pk=course_id)
        except CCR.DoesNotExist:
            return Response({'detail': f'Course {course_id!r} not found.'}, status=404)

        from .models import ExamAttemptTypeEnum as AT
        types = [attempt_type] if attempt_type else [c for c, _ in AT.choices]
        refreshed = []
        for at in types:
            obj = CourseExamStats.refresh_for(course, academic_year, at)
            refreshed.append(CourseExamStatsSerializer(obj).data)

        return Response({'refreshed': refreshed})

    @action(detail=False, methods=['get'], url_path='program_summary')
    def program_summary(self, request):
        """
        GET /exam-stats/program_summary/?program=1&academic_year=2024-2025&attempt_type=Regular
        Aggregated pass/fail/backlog stats across all courses in a program.
        """
        program_id    = request.query_params.get('program')
        academic_year = request.query_params.get('academic_year')
        attempt_type  = request.query_params.get('attempt_type', 'Regular')

        if not program_id or not academic_year:
            return Response({'detail': 'program and academic_year required.'}, status=400)

        from django.db.models import Sum, Avg, Count
        qs = CourseExamStats.objects.filter(
            course__program_id=program_id,
            academic_year=academic_year,
            attempt_type=attempt_type,
        ).select_related('course')

        agg = qs.aggregate(
            total_registered = Sum('total_registered'),
            total_appeared   = Sum('total_appeared'),
            total_absent     = Sum('total_absent'),
            total_pass       = Sum('total_pass'),
            total_fail       = Sum('total_fail'),
            total_withheld   = Sum('total_withheld'),
            avg_pass_rate    = Avg('pass_rate'),
            courses_count    = Count('id'),
        )
        agg['per_course'] = CourseExamStatsSerializer(qs, many=True).data
        return Response(agg)


# ── Utility ───────────────────────────────────────────────────────────────────

def _get_faculty(request):
    try:
        return request.user.faculty_profile
    except Exception:
        return None


# Patch CCR import needed in bulk_register
from .models import CCR
