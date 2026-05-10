"""
Test suite for JLU Marks Management System
Run: python manage.py test core --verbosity=2
"""
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import (
    User, FacultyOf, School, Program, Faculty, Student,
    CCR, IAComponent, StudentEnrolment, MarksEntry, ResultSheet,
)


# ── Shared fixture mixin ───────────────────────────────────────────────────────

class BaseFixture(TestCase):
    """Creates a minimal working hierarchy reused by all test cases."""

    @classmethod
    def setUpTestData(cls):
        # Org
        cls.fac_of  = FacultyOf.objects.create(name='FET', short_name='FET')
        cls.school  = School.objects.create(name='SCSE', short_name='SCSE', faculty_of=cls.fac_of)
        cls.program = Program.objects.create(
            name='B.Tech CSE', short_name='BTECH-CSE',
            school=cls.school, duration_yrs=4,
        )

        # Users
        cls.admin_user = User.objects.create_superuser(
            jlu_id='ADM001', email='admin@test.com',
            first_name='Admin', last_name='User', password='pass1234',
        )
        cls.fac_user = User.objects.create_user(
            jlu_id='FAC001', email='fac@test.com',
            first_name='Faculty', last_name='User', role='faculty', password='pass1234',
        )
        cls.stu_user1 = User.objects.create_user(
            jlu_id='STU001', email='stu1@test.com',
            first_name='Student', last_name='One', role='student', password='pass1234',
        )
        cls.stu_user2 = User.objects.create_user(
            jlu_id='STU002', email='stu2@test.com',
            first_name='Student', last_name='Two', role='student', password='pass1234',
        )

        # Profiles
        cls.faculty = Faculty.objects.create(
            faculty_id='F001', user=cls.fac_user,
            name='Faculty User', school=cls.school, department='CS',
        )
        cls.student1 = Student.objects.create(
            student_id='S001', user=cls.stu_user1,
            roll_no='21CSE001', gender='Male',
            program=cls.program, semester=3, academic_year='2023-2024',
        )
        cls.student2 = Student.objects.create(
            student_id='S002', user=cls.stu_user2,
            roll_no='21CSE002', gender='Female',
            program=cls.program, semester=3, academic_year='2023-2024',
        )

        # CCR
        cls.ccr = CCR.objects.create(
            course_code='CS301',
            course_name='Data Structures',
            course_type='Core',
            faculty=cls.faculty,
            program=cls.program,
            semester=3,
            academic_year='2023-2024',
            term=1,
            lecture_hrs=3, tutorial_hrs=1, practical_hrs=2,
            credits=4,
            int_weightage=40, ese_weightage=60,
            ese_mode='Written',
        )

        # IA Components
        cls.ia1 = IAComponent.objects.create(
            course=cls.ccr, name='Mid-Term', weightage=20, max_marks=50, mode='Offline',
        )
        cls.ia2 = IAComponent.objects.create(
            course=cls.ccr, name='Assignment', weightage=10, max_marks=25, mode='Offline',
        )
        cls.ia3 = IAComponent.objects.create(
            course=cls.ccr, name='Online Quiz', weightage=10, max_marks=25, mode='Online',
        )


# ── Model Tests ───────────────────────────────────────────────────────────────

class CCRModelTest(BaseFixture):

    def test_total_hrs_auto_computed(self):
        self.assertEqual(self.ccr.total_hrs, 6)  # 3+1+2

    def test_weightage_validation_passes(self):
        """int_weightage + ese_weightage = 100 should not raise."""
        try:
            self.ccr.full_clean()
        except ValidationError:
            self.fail('full_clean() raised ValidationError unexpectedly.')

    def test_weightage_validation_fails(self):
        """int_weightage + ese_weightage != 100 should raise ValidationError."""
        bad = CCR(
            course_code='CS999', course_name='Bad', course_type='Core',
            faculty=self.faculty, program=self.program,
            semester=3, academic_year='2023-2024', term=1,
            lecture_hrs=2, tutorial_hrs=0, practical_hrs=0,
            credits=3,
            int_weightage=50, ese_weightage=40,   # ← sums to 90
            ese_mode='Written',
        )
        with self.assertRaises(ValidationError):
            bad.full_clean()

    def test_semester_validation(self):
        bad = CCR(
            course_code='CS998', course_name='Bad2', course_type='Core',
            faculty=self.faculty, program=self.program,
            semester=13,   # ← out of range
            academic_year='2023-2024', term=1,
            lecture_hrs=2, tutorial_hrs=0, practical_hrs=0,
            credits=3, int_weightage=40, ese_weightage=60,
            ese_mode='Written',
        )
        with self.assertRaises(ValidationError):
            bad.full_clean()


class MarksEntryModelTest(BaseFixture):

    def test_scaled_marks_auto_computed(self):
        """scaled_marks = (marks_obtained / max_marks) × weightage"""
        entry = MarksEntry.objects.create(
            student=self.student1, component=self.ia1,
            marks_obtained=Decimal('40'),
            entered_by=self.faculty,
        )
        # 40/50 × 20 = 16
        self.assertEqual(entry.scaled_marks, Decimal('16.00'))

    def test_scaled_marks_max(self):
        entry = MarksEntry.objects.create(
            student=self.student1, component=self.ia2,
            marks_obtained=Decimal('25'),
            entered_by=self.faculty,
        )
        # 25/25 × 10 = 10
        self.assertEqual(entry.scaled_marks, Decimal('10.00'))

    def test_scaled_marks_zero(self):
        entry = MarksEntry.objects.create(
            student=self.student1, component=self.ia3,
            marks_obtained=Decimal('0'),
            entered_by=self.faculty,
        )
        self.assertEqual(entry.scaled_marks, Decimal('0.00'))


# ── Signal Tests ──────────────────────────────────────────────────────────────

class SignalTest(BaseFixture):

    def test_enrolment_creates_result_sheet(self):
        """Enrolling a student should auto-create a ResultSheet row."""
        enrolment = StudentEnrolment.objects.create(
            student=self.student1, course=self.ccr, academic_year='2023-2024',
        )
        self.assertTrue(
            ResultSheet.objects.filter(student=self.student1, course=self.ccr).exists()
        )

    def test_enrolment_idempotent(self):
        """Re-saving an enrolment must not create a duplicate ResultSheet."""
        StudentEnrolment.objects.create(
            student=self.student1, course=self.ccr, academic_year='2023-2024',
        )
        enrolment = StudentEnrolment.objects.get(student=self.student1, course=self.ccr)
        enrolment.save()  # triggers post_save again
        count = ResultSheet.objects.filter(student=self.student1, course=self.ccr).count()
        self.assertEqual(count, 1)

    def test_marks_save_updates_int_total(self):
        """Saving a MarksEntry should update ResultSheet.int_total via signal."""
        StudentEnrolment.objects.create(
            student=self.student1, course=self.ccr, academic_year='2023-2024',
        )
        MarksEntry.objects.create(
            student=self.student1, component=self.ia1,
            marks_obtained=Decimal('40'), entered_by=self.faculty,
        )
        MarksEntry.objects.create(
            student=self.student1, component=self.ia2,
            marks_obtained=Decimal('20'), entered_by=self.faculty,
        )
        sheet = ResultSheet.objects.get(student=self.student1, course=self.ccr)
        # ia1: 40/50*20=16, ia2: 20/25*10=8 → int_total = 24
        self.assertEqual(sheet.int_total, Decimal('24.00'))

    def test_marks_delete_recomputes_int_total(self):
        """Deleting a MarksEntry should re-reduce int_total."""
        StudentEnrolment.objects.create(
            student=self.student1, course=self.ccr, academic_year='2023-2024',
        )
        e1 = MarksEntry.objects.create(
            student=self.student1, component=self.ia1,
            marks_obtained=Decimal('40'), entered_by=self.faculty,
        )
        e2 = MarksEntry.objects.create(
            student=self.student1, component=self.ia2,
            marks_obtained=Decimal('20'), entered_by=self.faculty,
        )
        e2.delete()
        sheet = ResultSheet.objects.get(student=self.student1, course=self.ccr)
        # Only ia1: 16
        self.assertEqual(sheet.int_total, Decimal('16.00'))

    def test_grand_total_computed_after_ese(self):
        """ResultSheet.compute() should produce correct grand_total."""
        StudentEnrolment.objects.create(
            student=self.student1, course=self.ccr, academic_year='2023-2024',
        )
        MarksEntry.objects.create(
            student=self.student1, component=self.ia1,
            marks_obtained=Decimal('40'), entered_by=self.faculty,
        )  # scaled = 16
        MarksEntry.objects.create(
            student=self.student1, component=self.ia2,
            marks_obtained=Decimal('20'), entered_by=self.faculty,
        )  # scaled = 8
        MarksEntry.objects.create(
            student=self.student1, component=self.ia3,
            marks_obtained=Decimal('20'), entered_by=self.faculty,
        )  # scaled = 8  → int_total = 32

        sheet = ResultSheet.objects.get(student=self.student1, course=self.ccr)
        sheet.ese_marks = Decimal('70')
        sheet.save()
        sheet.compute()
        # int_total = 32 (already in int_weightage units)
        # grand_total = 32 + 70*(60/100) = 32 + 42 = 74
        self.assertEqual(sheet.grand_total, Decimal('74.00'))


# ── API Endpoint Tests ────────────────────────────────────────────────────────

class APIBaseTest(APITestCase):
    """Base for API tests — sets up users and provides login helper."""

    @classmethod
    def setUpTestData(cls):
        cls.fac_of  = FacultyOf.objects.create(name='FET2', short_name='FET2')
        cls.school  = School.objects.create(name='SCSE2', short_name='SCSE2', faculty_of=cls.fac_of)
        cls.program = Program.objects.create(
            name='B.Tech IT', short_name='BTECH-IT',
            school=cls.school, duration_yrs=4,
        )
        cls.admin_user = User.objects.create_superuser(
            jlu_id='AADM001', email='aadmin@test.com',
            first_name='Admin', last_name='API', password='pass1234',
        )
        cls.fac_user = User.objects.create_user(
            jlu_id='AFAC001', email='afac@test.com',
            first_name='Faculty', last_name='API', role='faculty', password='pass1234',
        )
        cls.stu_user = User.objects.create_user(
            jlu_id='ASTU001', email='astu@test.com',
            first_name='Student', last_name='API', role='student', password='pass1234',
        )
        cls.faculty = Faculty.objects.create(
            faculty_id='AF001', user=cls.fac_user,
            name='Faculty API', school=cls.school, department='IT',
        )
        cls.student = Student.objects.create(
            student_id='AS001', user=cls.stu_user,
            roll_no='21IT001', gender='Male',
            program=cls.program, semester=1, academic_year='2023-2024',
        )
        cls.ccr = CCR.objects.create(
            course_code='IT101',
            course_name='Intro to Programming',
            course_type='Core',
            faculty=cls.faculty,
            program=cls.program,
            semester=1,
            academic_year='2023-2024',
            term=1,
            lecture_hrs=3, tutorial_hrs=0, practical_hrs=2,
            credits=3,
            int_weightage=40, ese_weightage=60,
            ese_mode='Written',
        )
        cls.ia = IAComponent.objects.create(
            course=cls.ccr, name='Test 1', weightage=20, max_marks=50, mode='Offline',
        )

    def login(self, jlu_id, password='pass1234'):
        self.client = APIClient()
        resp = self.client.post('/api/auth/login/', {'jlu_id': jlu_id, 'password': password})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')


class AuthTest(APIBaseTest):

    def test_login_success(self):
        resp = self.client.post('/api/auth/login/', {'jlu_id': 'AADM001', 'password': 'pass1234'})
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

    def test_login_wrong_password(self):
        resp = self.client.post('/api/auth/login/', {'jlu_id': 'AADM001', 'password': 'wrong'})
        self.assertEqual(resp.status_code, 401)

    def test_unauthenticated_request_rejected(self):
        resp = self.client.get('/api/students/')
        self.assertEqual(resp.status_code, 401)

    def test_me_endpoint(self):
        self.login('AFAC001')
        resp = self.client.get('/api/users/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['jlu_id'], 'AFAC001')
        self.assertEqual(resp.data['role'], 'faculty')

    def test_change_password(self):
        self.login('ASTU001')
        resp = self.client.post('/api/users/change_password/', {
            'old_password': 'pass1234',
            'new_password': 'newpass5678',
        })
        self.assertEqual(resp.status_code, 200)
        # Revert
        User.objects.get(jlu_id='ASTU001').set_password('pass1234')
        User.objects.filter(jlu_id='ASTU001').update(password=User.objects.get(jlu_id='ASTU001').password)


class OrgAPITest(APIBaseTest):

    def test_student_can_read_schools(self):
        self.login('ASTU001')
        resp = self.client.get('/api/schools/')
        self.assertEqual(resp.status_code, 200)

    def test_student_cannot_create_school(self):
        self.login('ASTU001')
        resp = self.client.post('/api/schools/', {'name': 'Hack', 'faculty_of': self.fac_of.id})
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_create_school(self):
        self.login('AADM001')
        resp = self.client.post('/api/schools/', {
            'name': 'New School of Science',
            'short_name': 'NSS',
            'faculty_of': self.fac_of.id,
        })
        self.assertEqual(resp.status_code, 201)

    def test_program_filter_by_school(self):
        self.login('AADM001')
        resp = self.client.get(f'/api/programs/?school={self.school.id}')
        self.assertEqual(resp.status_code, 200)
        for item in resp.data['results']:
            self.assertEqual(item['school'], self.school.id)


class MarksAPITest(APIBaseTest):

    def setUp(self):
        # Enrol student and create result sheet before each test
        StudentEnrolment.objects.get_or_create(
            student=self.student, course=self.ccr, academic_year='2023-2024',
        )

    def test_faculty_can_enter_marks(self):
        self.login('AFAC001')
        resp = self.client.post('/api/marks/', {
            'student': 'AS001',
            'component': self.ia.id,
            'marks_obtained': '35.00',
        })
        self.assertEqual(resp.status_code, 201)
        self.assertIn('scaled_marks', resp.data)

    def test_marks_exceed_max_rejected(self):
        self.login('AFAC001')
        resp = self.client.post('/api/marks/', {
            'student': 'AS001',
            'component': self.ia.id,
            'marks_obtained': '99.00',   # max is 50
        })
        self.assertEqual(resp.status_code, 400)

    def test_student_cannot_enter_marks(self):
        self.login('ASTU001')
        resp = self.client.post('/api/marks/', {
            'student': 'AS001',
            'component': self.ia.id,
            'marks_obtained': '40.00',
        })
        self.assertEqual(resp.status_code, 403)

    def test_bulk_marks_entry(self):
        self.login('AFAC001')
        resp = self.client.post('/api/marks/bulk_enter/', [
            {'student': 'AS001', 'component': self.ia.id, 'marks_obtained': '42.00'},
        ], format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['saved']), 1)
        self.assertEqual(len(resp.data['errors']), 0)

    def test_result_sheet_auto_created_on_enrol(self):
        self.assertTrue(
            ResultSheet.objects.filter(student=self.student, course=self.ccr).exists()
        )

    def test_enter_ese_marks_and_compute(self):
        self.login('AFAC001')
        # Enter IA marks first
        self.client.post('/api/marks/', {
            'student': 'AS001',
            'component': self.ia.id,
            'marks_obtained': '40.00',
        })
        sheet = ResultSheet.objects.get(student=self.student, course=self.ccr)
        resp = self.client.post(f'/api/result-sheets/{sheet.id}/enter_ese/', {'ese_marks': '70'})
        self.assertEqual(resp.status_code, 200)
        self.assertIsNotNone(resp.data['grand_total'])


class FilterAPITest(APIBaseTest):

    def test_filter_students_by_semester(self):
        self.login('AADM001')
        resp = self.client.get('/api/students/?semester=1')
        self.assertEqual(resp.status_code, 200)
        for item in resp.data['results']:
            self.assertEqual(item['semester'], 1)

    def test_filter_marks_by_course(self):
        self.login('AFAC001')
        MarksEntry.objects.create(
            student=self.student, component=self.ia,
            marks_obtained=30, entered_by=self.faculty,
        )
        resp = self.client.get(f'/api/marks/?course=IT101')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(resp.data['count'], 1)

    def test_filter_result_sheets_by_program(self):
        self.login('AADM001')
        StudentEnrolment.objects.get_or_create(
            student=self.student, course=self.ccr, academic_year='2023-2024',
        )
        resp = self.client.get(f'/api/result-sheets/?program={self.program.id}')
        self.assertEqual(resp.status_code, 200)

    def test_filter_ccr_by_credits_range(self):
        self.login('AADM001')
        resp = self.client.get('/api/ccr/?credits_min=2&credits_max=5')
        self.assertEqual(resp.status_code, 200)
        for item in resp.data['results']:
            self.assertGreaterEqual(item['credits'], 2)
            self.assertLessEqual(item['credits'], 5)


class JWTClaimsTest(APIBaseTest):

    def test_login_response_includes_role(self):
        resp = self.client.post('/api/auth/login/', {'jlu_id': 'AFAC001', 'password': 'pass1234'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['role'], 'faculty')

    def test_login_response_includes_full_name(self):
        resp = self.client.post('/api/auth/login/', {'jlu_id': 'AFAC001', 'password': 'pass1234'})
        self.assertIn('full_name', resp.data)
        self.assertEqual(resp.data['full_name'], 'Faculty API')

    def test_login_response_includes_profile_id(self):
        resp = self.client.post('/api/auth/login/', {'jlu_id': 'AFAC001', 'password': 'pass1234'})
        self.assertEqual(resp.data['profile_id'], 'AF001')

    def test_student_login_profile_id(self):
        resp = self.client.post('/api/auth/login/', {'jlu_id': 'ASTU001', 'password': 'pass1234'})
        self.assertEqual(resp.data['profile_id'], 'AS001')

    def test_admin_login_profile_id_empty(self):
        resp = self.client.post('/api/auth/login/', {'jlu_id': 'AADM001', 'password': 'pass1234'})
        self.assertEqual(resp.data['profile_id'], '')


class ErrorHandlerTest(APIBaseTest):

    def test_404_shape(self):
        self.login('AADM001')
        resp = self.client.get('/api/students/NONEXISTENT/')
        self.assertEqual(resp.status_code, 404)
        self.assertFalse(resp.data['success'])
        self.assertEqual(resp.data['code'], 'not_found')
        self.assertIn('message', resp.data)

    def test_401_shape(self):
        resp = self.client.get('/api/students/')
        self.assertEqual(resp.status_code, 401)
        self.assertFalse(resp.data['success'])
        self.assertEqual(resp.data['code'], 'authentication_failed')

    def test_403_shape(self):
        self.login('ASTU001')
        resp = self.client.post('/api/schools/', {'name': 'Hack', 'faculty_of': self.fac_of.id})
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(resp.data['success'])
        self.assertEqual(resp.data['code'], 'permission_denied')

    def test_validation_error_shape(self):
        self.login('AFAC001')
        resp = self.client.post('/api/marks/', {})  # missing required fields
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(resp.data['success'])
        self.assertEqual(resp.data['code'], 'bad_request')
        self.assertIn('errors', resp.data)


class AnalyticsTest(APIBaseTest):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        # Enrol student and add marks + result
        enr, _ = StudentEnrolment.objects.get_or_create(
            student=cls.student, course=cls.ccr, academic_year='2023-2024',
        )
        MarksEntry.objects.update_or_create(
            student=cls.student, component=cls.ia,
            defaults={'marks_obtained': 40, 'entered_by': cls.faculty},
        )
        sheet, _ = ResultSheet.objects.get_or_create(student=cls.student, course=cls.ccr)
        sheet.ese_marks = 65
        sheet.save()
        sheet.compute()

    def test_admin_dashboard(self):
        self.login('AADM001')
        resp = self.client.get('/api/analytics/dashboard/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('total_students', resp.data)
        self.assertIn('total_courses', resp.data)
        self.assertIn('ese_pending', resp.data)

    def test_faculty_dashboard(self):
        self.login('AFAC001')
        resp = self.client.get('/api/analytics/dashboard/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('courses', resp.data)
        self.assertGreaterEqual(len(resp.data['courses']), 1)

    def test_student_dashboard(self):
        self.login('ASTU001')
        resp = self.client.get('/api/analytics/dashboard/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('results', resp.data)
        self.assertIn('semester', resp.data)

    def test_course_summary(self):
        self.login('AFAC001')
        resp = self.client.get('/api/analytics/course_summary/?course=IT101')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['course_code'], 'IT101')
        self.assertIn('enrolled', resp.data)
        self.assertIn('pass_pct', resp.data)

    def test_course_summary_missing_param(self):
        self.login('AFAC001')
        resp = self.client.get('/api/analytics/course_summary/')
        self.assertEqual(resp.status_code, 400)

    def test_grade_distribution(self):
        self.login('AADM001')
        resp = self.client.get('/api/analytics/grade_distribution/?course=IT101')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('distribution', resp.data)
        grades = [d['grade'] for d in resp.data['distribution']]
        self.assertIn('O', grades)
        self.assertIn('F', grades)

    def test_toppers(self):
        self.login('AADM001')
        resp = self.client.get('/api/analytics/toppers/?course=IT101&limit=5')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('toppers', resp.data)
        if resp.data['toppers']:
            self.assertIn('rank', resp.data['toppers'][0])
            self.assertIn('grade', resp.data['toppers'][0])

    def test_student_report_own(self):
        self.login('ASTU001')
        resp = self.client.get('/api/analytics/student_report/?student=AS001')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('courses', resp.data)
        self.assertIn('summary', resp.data)

    def test_student_report_other_student_forbidden(self):
        # Create a second student user to test cross-access
        other_user = User.objects.create_user(
            jlu_id='ASTU999', email='stu999@test.com',
            first_name='Other', last_name='Student', role='student', password='pass1234',
        )
        self.login('ASTU999')
        resp = self.client.get('/api/analytics/student_report/?student=AS001')
        self.assertEqual(resp.status_code, 403)

    def test_ia_breakdown(self):
        self.login('AFAC001')
        resp = self.client.get('/api/analytics/ia_breakdown/?course=IT101')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('components', resp.data)
        self.assertGreaterEqual(len(resp.data['components']), 1)
        comp = resp.data['components'][0]
        self.assertIn('completion_pct', comp)
        self.assertIn('missing', comp)


class EnrolmentAPITest(APIBaseTest):

    def test_faculty_can_enrol_student(self):
        self.login('AFAC001')
        resp = self.client.post('/api/enrolments/', {
            'student': 'AS001',
            'course': 'IT101',
            'academic_year': '2023-2024',
        })
        # 201 or 400 if already exists
        self.assertIn(resp.status_code, [201, 400])

    def test_duplicate_enrolment_rejected(self):
        StudentEnrolment.objects.get_or_create(
            student=self.student, course=self.ccr, academic_year='2023-2024',
        )
        self.login('AFAC001')
        resp = self.client.post('/api/enrolments/', {
            'student': 'AS001',
            'course': 'IT101',
            'academic_year': '2023-2024',
        })
        self.assertEqual(resp.status_code, 400)

    def test_student_nested_results(self):
        StudentEnrolment.objects.get_or_create(
            student=self.student, course=self.ccr, academic_year='2023-2024',
        )
        self.login('ASTU001')
        resp = self.client.get('/api/students/AS001/results/')
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)
