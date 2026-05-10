import django_filters as df
from .models import (
    User, Faculty, Student, CCR,
    StudentEnrolment, IAComponent, MarksEntry, ResultSheet,
)


# ── User ──────────────────────────────────────────────────────────────────────

class UserFilter(df.FilterSet):
    role       = df.CharFilter(field_name='role', lookup_expr='exact')
    is_active  = df.BooleanFilter()
    email      = df.CharFilter(lookup_expr='icontains')
    jlu_id     = df.CharFilter(lookup_expr='icontains')
    created_after  = df.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = df.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model  = User
        fields = []


# ── Faculty ───────────────────────────────────────────────────────────────────

class FacultyFilter(df.FilterSet):
    school     = df.NumberFilter(field_name='school_id')
    department = df.CharFilter(lookup_expr='icontains')
    name       = df.CharFilter(lookup_expr='icontains')

    class Meta:
        model  = Faculty
        fields = []


# ── Student ───────────────────────────────────────────────────────────────────

class StudentFilter(df.FilterSet):
    program       = df.NumberFilter(field_name='program_id')
    semester      = df.NumberFilter()
    semester_gte  = df.NumberFilter(field_name='semester', lookup_expr='gte')
    semester_lte  = df.NumberFilter(field_name='semester', lookup_expr='lte')
    section       = df.CharFilter(lookup_expr='iexact')
    academic_year = df.CharFilter(lookup_expr='exact')
    gender        = df.CharFilter(lookup_expr='exact')
    roll_no       = df.CharFilter(lookup_expr='icontains')

    class Meta:
        model  = Student
        fields = []


# ── CCR ───────────────────────────────────────────────────────────────────────

class CCRFilter(df.FilterSet):
    course_type   = df.CharFilter(lookup_expr='exact')
    semester      = df.NumberFilter()
    academic_year = df.CharFilter(lookup_expr='exact')
    program       = df.NumberFilter(field_name='program_id')
    faculty       = df.CharFilter(field_name='faculty_id', lookup_expr='exact')
    ese_mode      = df.CharFilter(lookup_expr='exact')
    credits_min   = df.NumberFilter(field_name='credits', lookup_expr='gte')
    credits_max   = df.NumberFilter(field_name='credits', lookup_expr='lte')
    course_name   = df.CharFilter(lookup_expr='icontains')
    course_code   = df.CharFilter(lookup_expr='icontains')

    class Meta:
        model  = CCR
        fields = []


# ── Student Enrolment ─────────────────────────────────────────────────────────

class StudentEnrolmentFilter(df.FilterSet):
    student       = df.CharFilter(field_name='student_id', lookup_expr='exact')
    course        = df.CharFilter(field_name='course_id',  lookup_expr='exact')
    academic_year = df.CharFilter(lookup_expr='exact')
    enrolled_after  = df.DateTimeFilter(field_name='enrolled_at', lookup_expr='gte')
    enrolled_before = df.DateTimeFilter(field_name='enrolled_at', lookup_expr='lte')

    class Meta:
        model  = StudentEnrolment
        fields = []


# ── IA Component ──────────────────────────────────────────────────────────────

class IAComponentFilter(df.FilterSet):
    course    = df.CharFilter(field_name='course_id', lookup_expr='exact')
    mode      = df.CharFilter(lookup_expr='exact')
    name      = df.CharFilter(lookup_expr='icontains')
    max_marks_min = df.NumberFilter(field_name='max_marks', lookup_expr='gte')
    max_marks_max = df.NumberFilter(field_name='max_marks', lookup_expr='lte')

    class Meta:
        model  = IAComponent
        fields = []


# ── Marks Entry ───────────────────────────────────────────────────────────────

class MarksEntryFilter(df.FilterSet):
    student      = df.CharFilter(field_name='student_id',   lookup_expr='exact')
    component    = df.NumberFilter(field_name='component_id')
    entered_by   = df.CharFilter(field_name='entered_by_id', lookup_expr='exact')
    # Course-level filter: marks for a specific course_code
    course       = df.CharFilter(field_name='component__course_id', lookup_expr='exact')
    attempt_type = df.CharFilter(lookup_expr='exact')
    marks_min    = df.NumberFilter(field_name='marks_obtained', lookup_expr='gte')
    marks_max    = df.NumberFilter(field_name='marks_obtained', lookup_expr='lte')
    has_marks    = df.BooleanFilter(field_name='marks_obtained', lookup_expr='isnull', exclude=True)
    updated_after  = df.DateTimeFilter(field_name='updated_at', lookup_expr='gte')
    updated_before = df.DateTimeFilter(field_name='updated_at', lookup_expr='lte')

    class Meta:
        model  = MarksEntry
        fields = []


# ── Result Sheet ──────────────────────────────────────────────────────────────

class ResultSheetFilter(df.FilterSet):
    student    = df.CharFilter(field_name='student_id', lookup_expr='exact')
    course     = df.CharFilter(field_name='course_id',  lookup_expr='exact')
    # Filter by program (joins through course)
    program    = df.NumberFilter(field_name='course__program_id')
    semester   = df.NumberFilter(field_name='course__semester')
    academic_year = df.CharFilter(field_name='course__academic_year')
    grand_total_min = df.NumberFilter(field_name='grand_total', lookup_expr='gte')
    grand_total_max = df.NumberFilter(field_name='grand_total', lookup_expr='lte')
    # Useful for finding incomplete results
    ese_entered = df.BooleanFilter(field_name='ese_marks', lookup_expr='isnull', exclude=True)

    class Meta:
        model  = ResultSheet
        fields = []


# ── Exam Attempt ──────────────────────────────────────────────────────────────

from .models import ExamAttempt, StudentBacklog, CourseExamStats


class ExamAttemptFilter(df.FilterSet):
    student       = df.CharFilter(field_name='student_id',   lookup_expr='exact')
    course        = df.CharFilter(field_name='course_id',    lookup_expr='exact')
    attempt_type  = df.CharFilter(lookup_expr='exact')
    status        = df.CharFilter(lookup_expr='exact')
    academic_year = df.CharFilter(lookup_expr='exact')
    program       = df.NumberFilter(field_name='course__program_id')
    semester      = df.NumberFilter(field_name='course__semester')
    conducted_after  = df.DateFilter(field_name='conducted_on', lookup_expr='gte')
    conducted_before = df.DateFilter(field_name='conducted_on', lookup_expr='lte')
    ese_min       = df.NumberFilter(field_name='ese_marks',  lookup_expr='gte')
    ese_max       = df.NumberFilter(field_name='ese_marks',  lookup_expr='lte')

    class Meta:
        model  = ExamAttempt
        fields = []


# ── Student Backlog ───────────────────────────────────────────────────────────

class StudentBacklogFilter(df.FilterSet):
    student       = df.CharFilter(field_name='student_id', lookup_expr='exact')
    course        = df.CharFilter(field_name='course_id',  lookup_expr='exact')
    status        = df.CharFilter(lookup_expr='exact')
    reason        = df.CharFilter(lookup_expr='exact')
    program       = df.NumberFilter(field_name='course__program_id')
    semester      = df.NumberFilter(field_name='course__semester')
    academic_year = df.CharFilter(field_name='course__academic_year')
    created_after  = df.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = df.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model  = StudentBacklog
        fields = []


# ── Course Exam Stats ─────────────────────────────────────────────────────────

class CourseExamStatsFilter(df.FilterSet):
    course        = df.CharFilter(field_name='course_id',  lookup_expr='exact')
    academic_year = df.CharFilter(lookup_expr='exact')
    attempt_type  = df.CharFilter(lookup_expr='exact')
    program       = df.NumberFilter(field_name='course__program_id')
    semester      = df.NumberFilter(field_name='course__semester')
    pass_rate_min = df.NumberFilter(field_name='pass_rate', lookup_expr='gte')
    pass_rate_max = df.NumberFilter(field_name='pass_rate', lookup_expr='lte')

    class Meta:
        model  = CourseExamStats
        fields = []
