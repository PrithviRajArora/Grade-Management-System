"""
python manage.py seed_attempt_test

Creates minimal test data to verify the unified attempt-based marks system:

  SCENARIO 1 — Regular attempt (full pass):
    Student S001 → Regular IA marks + Regular ESE → Pass

  SCENARIO 2 — Regular attempt (fail), then Backlog attempt (pass):
    Student S002 → Regular IA marks + Regular ESE (low) → Fail
                 → Reset marks → Backlog IA marks + Backlog ESE → Pass

  SCENARIO 3 — Regular attempt (fail), Backlog scheduled (no ESE yet):
    Student S003 → Regular IA marks + Regular ESE (low) → Fail
                 → Reset marks → Backlog attempt Scheduled (ESE pending)

After running, visit:
  - Course Detail → IA Marks tab: switch between Regular / Backlog to see different marks
  - Course Detail → ESE Marks tab: switch attempt type to see different ESE
  - Course Detail → Exam Attempts tab: see attempt history, reset button

Login:
  Admin:   ADM001 / Admin@1234
  Faculty: FAC001 / Faculty@1234
  Students: STU001–STU003 / Student@1234
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from decimal import Decimal


class Command(BaseCommand):
    help = 'Seed minimal test data for the per-attempt marks system'

    @transaction.atomic
    def handle(self, *args, **options):
        from core.models import (
            User, FacultyOf, School, Program, Faculty, Student,
            CCR, IAComponent, StudentEnrolment, MarksEntry,
            ResultSheet, ExamAttempt,
            ExamAttemptStatusEnum, ExamAttemptTypeEnum,
        )

        self.stdout.write(self.style.WARNING('=== Seeding Attempt-Test Data ===\n'))

        # ── Org hierarchy ─────────────────────────────────────────────────────
        fac_of, _ = FacultyOf.objects.get_or_create(
            name='Faculty of Engineering & Technology',
            defaults={'short_name': 'FET'},
        )
        school, _ = School.objects.get_or_create(
            name='School of Computer Science & Engineering',
            defaults={'short_name': 'SCSE', 'faculty_of': fac_of},
        )
        program, _ = Program.objects.get_or_create(
            school=school, short_name='BTECH-CSE',
            defaults={'name': 'B.Tech Computer Science & Engineering', 'duration_yrs': 4},
        )

        # ── Admin ─────────────────────────────────────────────────────────────
        if not User.objects.filter(jlu_id='ADM001').exists():
            User.objects.create_superuser(
                jlu_id='ADM001', email='admin@jlu.edu.in',
                first_name='Super', last_name='Admin', password='Admin@1234',
            )
        self.stdout.write(self.style.SUCCESS('  ✓ Admin     — ADM001 / Admin@1234'))

        # ── Faculty ───────────────────────────────────────────────────────────
        if not User.objects.filter(jlu_id='FAC001').exists():
            fac_user = User.objects.create_user(
                jlu_id='FAC001', email='prof.sharma@jlu.edu.in',
                first_name='Ramesh', last_name='Sharma',
                role='faculty', password='Faculty@1234',
            )
            Faculty.objects.create(
                faculty_id='F001', user=fac_user,
                name='Prof. Ramesh Sharma',
                school=school, department='Computer Science',
            )
        faculty = Faculty.objects.get(faculty_id='F001')
        self.stdout.write(self.style.SUCCESS('  ✓ Faculty   — FAC001 / Faculty@1234'))

        # ── Students ──────────────────────────────────────────────────────────
        students_data = [
            ('S001', 'STU001', 'stu001@jlu.edu.in', 'Arjun',  'Verma',  'Male',   '21BTCSE001'),
            ('S002', 'STU002', 'stu002@jlu.edu.in', 'Priya',  'Singh',  'Female', '21BTCSE002'),
            ('S003', 'STU003', 'stu003@jlu.edu.in', 'Rohit',  'Sharma', 'Male',   '21BTCSE003'),
        ]
        student_objs = {}
        for sid, jlu_id, email, fn, ln, gender, roll in students_data:
            if not User.objects.filter(jlu_id=jlu_id).exists():
                u = User.objects.create_user(
                    jlu_id=jlu_id, email=email,
                    first_name=fn, last_name=ln,
                    role='student', password='Student@1234',
                )
                Student.objects.create(
                    student_id=sid, user=u, roll_no=roll, gender=gender,
                    program=program, semester=3, section='A',
                    academic_year='2023-2024',
                )
            student_objs[sid] = Student.objects.get(student_id=sid)
        self.stdout.write(self.style.SUCCESS('  ✓ Students  — STU001–STU003 / Student@1234'))

        # ── CCR ───────────────────────────────────────────────────────────────
        ccr, _ = CCR.objects.get_or_create(
            course_code='CS301',
            defaults={
                'course_name': 'Data Structures & Algorithms',
                'course_type': 'Core',
                'faculty': faculty,
                'program': program,
                'semester': 3,
                'academic_year': '2023-2024',
                'term': 1,
                'lecture_hrs': 3, 'tutorial_hrs': 1, 'practical_hrs': 2,
                'credits': 4,
                'int_weightage': 40, 'ese_weightage': 60,
                'ese_mode': 'Written',
                'ese_duration_hrs': 3, 'ese_max_marks': 100,
            }
        )
        self.stdout.write(self.style.SUCCESS('  ✓ CCR       — CS301 (IA=40%, ESE=60%)'))

        # ── IA Components ─────────────────────────────────────────────────────
        MarksEntry.objects.filter(component__course=ccr).delete()
        IAComponent.objects.filter(course=ccr).delete()

        ia1 = IAComponent.objects.create(
            course=ccr, name='Mid-Term Test', weightage=20, max_marks=50, mode='Offline')
        ia2 = IAComponent.objects.create(
            course=ccr, name='Assignment',    weightage=10, max_marks=25, mode='Offline')
        ia3 = IAComponent.objects.create(
            course=ccr, name='Online Quiz',   weightage=10, max_marks=25, mode='Online')
        self.stdout.write(self.style.SUCCESS('  ✓ IA Components: Mid-Term/50, Assignment/25, Quiz/25'))

        # ── Enrolments ────────────────────────────────────────────────────────
        for sid, student in student_objs.items():
            enrol, _ = StudentEnrolment.objects.get_or_create(
                student=student, course=ccr, academic_year='2023-2024',
                defaults={'ese_eligible': True},
            )
            if not enrol.ese_eligible:
                enrol.ese_eligible = True
                enrol.save()
        self.stdout.write(self.style.SUCCESS('  ✓ Enrolments (all ESE-eligible)'))

        # Clean up existing attempt data for clean re-seed
        ExamAttempt.objects.filter(course=ccr).delete()
        ResultSheet.objects.filter(course=ccr).delete()

        # ──────────────────────────────────────────────────────────────────────
        # SCENARIO 1 — S001: Regular attempt → Pass
        # int_total: 40/50→16 + 22/25→8.8 + 20/25→8 = 32.8
        # ese_marks: 74   grand_total: 32.8 + 74*0.60 = 32.8+44.4 = 77.2 ✓ Pass
        # ──────────────────────────────────────────────────────────────────────
        s1 = student_objs['S001']
        for comp, raw in [(ia1, 40), (ia2, 22), (ia3, 20)]:
            MarksEntry.objects.create(
                student=s1, component=comp,
                attempt_type=ExamAttemptTypeEnum.REGULAR,
                marks_obtained=Decimal(str(raw)),
                entered_by=faculty, entered_at=timezone.now(),
            )
        att1 = ExamAttempt.objects.create(
            student=s1, course=ccr,
            attempt_type=ExamAttemptTypeEnum.REGULAR,
            academic_year='2023-2024',
            ese_marks=Decimal('74'),
            status=ExamAttemptStatusEnum.PASS,
            entered_by=faculty, entered_at=timezone.now(),
        )
        self.stdout.write(self.style.SUCCESS(
            '  ✓ S001 Regular attempt — ESE=74 → expecting Pass'))

        # ──────────────────────────────────────────────────────────────────────
        # SCENARIO 2 — S002: Regular (fail) → Backlog (pass)
        # Regular: int_total=18+6+4=28, ESE=28 → grand=28+16.8=44.8 < 40? No, 44.8 ≥ 40
        # Actually let's use ESE=18 → grand=28+10.8=38.8 < 40 → Fail
        # Backlog: int_total=35+20+18=23.2+8+7.2=38.4... Let's simplify:
        #   Regular IA: mid=35/50→14, asgn=15/25→6, quiz=12/25→4.8  int=24.8
        #   Regular ESE: 18  → grand=24.8+10.8=35.6 → FAIL
        #   Backlog IA:  mid=48/50→19.2, asgn=22/25→8.8, quiz=23/25→9.2  int=37.2
        #   Backlog ESE: 72  → grand=37.2+43.2=80.4 → PASS
        # ──────────────────────────────────────────────────────────────────────
        s2 = student_objs['S002']
        # Regular IA marks
        for comp, raw in [(ia1, 35), (ia2, 15), (ia3, 12)]:
            MarksEntry.objects.create(
                student=s2, component=comp,
                attempt_type=ExamAttemptTypeEnum.REGULAR,
                marks_obtained=Decimal(str(raw)),
                entered_by=faculty, entered_at=timezone.now(),
            )
        # Regular ESE attempt (fail)
        ExamAttempt.objects.create(
            student=s2, course=ccr,
            attempt_type=ExamAttemptTypeEnum.REGULAR,
            academic_year='2023-2024',
            ese_marks=Decimal('18'),
            status=ExamAttemptStatusEnum.FAIL,
            entered_by=faculty, entered_at=timezone.now(),
        )
        self.stdout.write(self.style.SUCCESS(
            '  ✓ S002 Regular attempt — ESE=18 → expecting Fail'))

        # Backlog IA marks (better performance)
        for comp, raw in [(ia1, 48), (ia2, 22), (ia3, 23)]:
            MarksEntry.objects.create(
                student=s2, component=comp,
                attempt_type=ExamAttemptTypeEnum.BACKLOG,
                marks_obtained=Decimal(str(raw)),
                entered_by=faculty, entered_at=timezone.now(),
            )
        # Backlog ESE attempt (pass) — this triggers signal to update ResultSheet
        ExamAttempt.objects.create(
            student=s2, course=ccr,
            attempt_type=ExamAttemptTypeEnum.BACKLOG,
            academic_year='2023-2024',
            ese_marks=Decimal('72'),
            status=ExamAttemptStatusEnum.PASS,
            entered_by=faculty, entered_at=timezone.now(),
        )
        self.stdout.write(self.style.SUCCESS(
            '  ✓ S002 Backlog  attempt — ESE=72 → expecting Pass'))

        # ──────────────────────────────────────────────────────────────────────
        # SCENARIO 3 — S003: Regular (fail), Backlog registered but ESE pending
        # ──────────────────────────────────────────────────────────────────────
        s3 = student_objs['S003']
        for comp, raw in [(ia1, 20), (ia2, 10), (ia3, 8)]:
            MarksEntry.objects.create(
                student=s3, component=comp,
                attempt_type=ExamAttemptTypeEnum.REGULAR,
                marks_obtained=Decimal(str(raw)),
                entered_by=faculty, entered_at=timezone.now(),
            )
        ExamAttempt.objects.create(
            student=s3, course=ccr,
            attempt_type=ExamAttemptTypeEnum.REGULAR,
            academic_year='2023-2024',
            ese_marks=Decimal('22'),
            status=ExamAttemptStatusEnum.FAIL,
            entered_by=faculty, entered_at=timezone.now(),
        )
        # Backlog registered but no ESE yet
        ExamAttempt.objects.create(
            student=s3, course=ccr,
            attempt_type=ExamAttemptTypeEnum.BACKLOG,
            academic_year='2023-2024',
            status=ExamAttemptStatusEnum.SCHEDULED,
            entered_by=faculty, entered_at=timezone.now(),
        )
        self.stdout.write(self.style.SUCCESS(
            '  ✓ S003 Regular Fail + Backlog Scheduled (ESE pending)'))

        # ── Print result summary ───────────────────────────────────────────────
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('=== Result Sheet Summary (CS301) ==='))
        for sid, student in student_objs.items():
            rs = ResultSheet.objects.filter(student=student, course=ccr).first()
            if rs:
                attempts = ExamAttempt.objects.filter(
                    student=student, course=ccr).order_by('attempt_type', 'entered_at')
                att_summary = ', '.join(
                    f"{a.attempt_type}({a.status})" for a in attempts)
                self.stdout.write(
                    f'  {student.roll_no:15s}  '
                    f'active={rs.active_attempt_type:12s}  '
                    f'IA={str(rs.int_total or "—"):6}  '
                    f'ESE={str(rs.ese_marks or "—"):5}  '
                    f'Total={str(rs.grand_total or "—"):6}  '
                    f'Status={rs.pass_status:10s}  '
                    f'Attempts=[{att_summary}]'
                )
            else:
                self.stdout.write(f'  {student.roll_no:15s}  — no result sheet')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Done! The following flows are now testable:'))
        self.stdout.write('  1. IA tab → select "Regular" → see S001/S002/S003 marks')
        self.stdout.write('  2. IA tab → select "Backlog" → see S002 higher marks')
        self.stdout.write('  3. ESE tab → select "Regular" → see all original ESE marks')
        self.stdout.write('  4. ESE tab → select "Backlog" → see S002 Backlog ESE=72')
        self.stdout.write('  5. Exam Attempts tab → S002 shows both attempts with history')
        self.stdout.write('  6. Exam Attempts tab → S003 has "↺ Reset → Backlog" button')
        self.stdout.write('')
