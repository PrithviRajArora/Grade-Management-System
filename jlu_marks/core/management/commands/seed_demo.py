"""
Usage:
    python manage.py seed_demo

Creates a complete demo dataset:
  • 1 FacultyOf → 1 School → 1 Program
  • 1 admin, 1 faculty, 6 students
  • 1 CCR with 3 IA components
  • All 6 students enrolled, marks entered, ESE entered, grand totals computed
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal


STUDENTS = [
    ('S001', 'STU001', 'stu001@jlu.edu.in', 'Arjun',   'Verma',  'Male',   '21BTCSE001', 3, 'A'),
    ('S002', 'STU002', 'stu002@jlu.edu.in', 'Priya',   'Singh',  'Female', '21BTCSE002', 3, 'A'),
    ('S003', 'STU003', 'stu003@jlu.edu.in', 'Rohit',   'Sharma', 'Male',   '21BTCSE003', 3, 'A'),
    ('S004', 'STU004', 'stu004@jlu.edu.in', 'Anjali',  'Patel',  'Female', '21BTCSE004', 3, 'B'),
    ('S005', 'STU005', 'stu005@jlu.edu.in', 'Vikram',  'Kumar',  'Male',   '21BTCSE005', 3, 'B'),
    ('S006', 'STU006', 'stu006@jlu.edu.in', 'Sneha',   'Gupta',  'Female', '21BTCSE006', 3, 'B'),
]

# (student_id, mid_term/50, assignment/25, quiz/25, ese/100)
MARKS = {
    'S001': (44, 22, 21, 74),   # B+
    'S002': (48, 24, 23, 82),   # A
    'S003': (50, 25, 25, 92),   # O
    'S004': (35, 18, 17, 55),   # C
    'S005': (28, 14, 12, 38),   # F
    'S006': (40, 20, 20, 65),   # B
}


class Command(BaseCommand):
    help = 'Seed the database with demo data'

    @transaction.atomic
    def handle(self, *args, **options):
        from core.models import (
            User, FacultyOf, School, Program, Faculty, Student,
            CCR, IAComponent, StudentEnrolment, MarksEntry, ResultSheet,
        )

        self.stdout.write('Seeding demo data…')

        # ── Org hierarchy ─────────────────────────────────────────────
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
        self.stdout.write(self.style.SUCCESS('  ✓ Org hierarchy'))

        # ── Admin ──────────────────────────────────────────────────────
        if not User.objects.filter(jlu_id='ADM001').exists():
            User.objects.create_superuser(
                jlu_id='ADM001', email='admin@jlu.edu.in',
                first_name='Super', last_name='Admin', password='Admin@1234',
            )
        self.stdout.write(self.style.SUCCESS('  ✓ Admin     — ADM001 / Admin@1234'))

        # ── Faculty ────────────────────────────────────────────────────
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

        # ── Students ───────────────────────────────────────────────────
        student_objs = {}
        for sid, jlu_id, email, fn, ln, gender, roll, sem, sec in STUDENTS:
            if not User.objects.filter(jlu_id=jlu_id).exists():
                u = User.objects.create_user(
                    jlu_id=jlu_id, email=email,
                    first_name=fn, last_name=ln,
                    role='student', password='Student@1234',
                )
                Student.objects.create(
                    student_id=sid, user=u, roll_no=roll, gender=gender,
                    program=program, semester=sem, section=sec,
                    academic_year='2023-2024',
                )
            student_objs[sid] = Student.objects.get(student_id=sid)
        self.stdout.write(self.style.SUCCESS(
            f'  ✓ Students  — STU001–STU006 / Student@1234'
        ))

        # ── CCR ────────────────────────────────────────────────────────
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
        self.stdout.write(self.style.SUCCESS('  ✓ CCR       — CS301'))

        # ── IA Components ──────────────────────────────────────────────
        # Wipe and recreate to avoid cumulative-weightage validation errors on
        # re-seed. MarksEntry rows that FK into IAComponent must go first.
        MarksEntry.objects.filter(component__course=ccr).delete()
        IAComponent.objects.filter(course=ccr).delete()

        ia1 = IAComponent.objects.create(course=ccr, name='Mid-Term Test',
            weightage=20, max_marks=50, mode='Offline')
        ia2 = IAComponent.objects.create(course=ccr, name='Assignment',
            weightage=10, max_marks=25, mode='Offline')
        ia3 = IAComponent.objects.create(course=ccr, name='Online Quiz',
            weightage=10, max_marks=25, mode='Online')
        self.stdout.write(self.style.SUCCESS('  ✓ IA Components (3)'))

        # ── Enrolments + Marks + Results ───────────────────────────────
        for sid, student in student_objs.items():
            StudentEnrolment.objects.get_or_create(
                student=student, course=ccr, academic_year='2023-2024'
            )
            mid, asgn, quiz, ese = MARKS[sid]

            for comp, raw in [(ia1, mid), (ia2, asgn), (ia3, quiz)]:
                MarksEntry.objects.update_or_create(
                    student=student, component=comp,
                    attempt_type='Regular',
                    defaults={'marks_obtained': Decimal(str(raw)), 'entered_by': faculty},
                )

            rs, _ = ResultSheet.objects.get_or_create(student=student, course=ccr)
            rs.ese_marks = Decimal(str(ese))
            rs.save()
            rs.compute()

        self.stdout.write(self.style.SUCCESS('  ✓ Enrolments, marks, ESE, grand totals'))
        self.stdout.write('')

        # ── Print result summary ───────────────────────────────────────
        self.stdout.write('  Grade summary for CS301:')
        for sid, student in student_objs.items():
            rs = ResultSheet.objects.get(student=student, course=ccr)
            self.stdout.write(f'    {student.roll_no}  IA={rs.int_total}  ESE={rs.ese_marks}  Total={rs.grand_total}')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Done! Run: python manage.py runserver'))
