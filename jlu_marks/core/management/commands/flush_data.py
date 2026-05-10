"""
python manage.py flush_data

Wipes ALL application data in safe FK order, then recreates ONE admin account.
Preserved: django_migrations, django_content_type, auth_permission tables.
Recreated: admin user  →  JLU ID: ADM001  |  Password: Admin@1234
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Delete all students, courses, faculties, schools, programs and divisions, then recreate the admin account.'

    @transaction.atomic
    def handle(self, *args, **options):
        from core.models import (
            User,
            CourseExamStats, StudentBacklog,
            ExamAttempt, ResultSheet, MarksEntry, IAComponent,
            StudentEnrolment, CCR,
            Faculty, Student,
            Program, School, FacultyOf,
        )

        self.stdout.write('Flushing all application data…\n')

        # ── Delete in reverse-FK order ─────────────────────────────────
        steps = [
            (CourseExamStats,   'CourseExamStats'),
            (StudentBacklog,    'StudentBacklogs'),
            (ExamAttempt,       'ExamAttempts'),
            (ResultSheet,       'ResultSheets'),
            (MarksEntry,        'MarksEntries'),
            (IAComponent,       'IAComponents'),
            (StudentEnrolment,  'StudentEnrolments'),
            (CCR,               'Courses (CCR)'),
            (Faculty,           'Faculties'),
            (Student,           'Students'),
            (Program,           'Programs'),
            (School,            'Schools'),
            (FacultyOf,         'Academic Divisions (FacultyOf)'),
        ]

        from django.db import connection

        # Tables to truncate in one shot using TRUNCATE CASCADE (PostgreSQL).
        # This is safe because we want ALL rows gone from all these tables.
        tables = [
            'course_exam_stats',
            'student_backlog',
            'exam_attempt',
            'result_sheet',
            'marks_entry',
            'ia_component',
            'student_enrolment',
            'course_unlock_log',
            'ccr',
            'faculty',
            'student',
            'program',
            'school',
            'faculty_of',
        ]

        with connection.cursor() as cursor:
            tables_sql = ', '.join(f'"{t}"' for t in tables)
            cursor.execute(f'TRUNCATE TABLE {tables_sql} CASCADE;')
        self.stdout.write('[OK] All application tables cleared (TRUNCATE CASCADE).')

        # Delete all users (students, faculty, any existing admin)
        non_admin_count, _ = User.objects.filter(is_superuser=False).delete()
        self.stdout.write(f'[OK] Deleted {non_admin_count} non-admin users.')
        User.objects.filter(is_superuser=True).delete()
        self.stdout.write('[OK] Deleted existing admin account(s).')

        # -- Recreate the single admin account -------------------------
        User.objects.create_superuser(
            jlu_id      = 'ADM001',
            email       = 'admin@jlu.edu.in',
            first_name  = 'Super',
            last_name   = 'Admin',
            password    = 'Admin@1234',
        )
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('[DONE] Admin account recreated:'))
        self.stdout.write(self.style.SUCCESS('    JLU ID   : ADM001'))
        self.stdout.write(self.style.SUCCESS('    Password : Admin@1234'))
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Database is clean. You can now add schools, programs, faculty and students from scratch.'))

