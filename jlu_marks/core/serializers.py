from rest_framework import serializers
from django.utils import timezone
from .models import (
    User, FacultyOf, School, Program, Faculty, Student,
    CCR, StudentEnrolment, IAComponent, MarksEntry, ResultSheet,
    ExamAttemptTypeEnum,
)


# ── User ──────────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ('id', 'jlu_id', 'first_name', 'last_name', 'email', 'role', 'must_change_password', 'created_at')
        read_only_fields = ('id', 'created_at')


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, default='Password')

    class Meta:
        model  = User
        fields = ('jlu_id', 'first_name', 'last_name', 'email', 'role', 'password')

    def create(self, validated_data):
        password = validated_data.pop('password', 'Password')
        user = User(**validated_data)
        user.set_password(password)
        # Flag must_change_password if using the default password
        user.must_change_password = (password == 'Password')
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)


# ── Org Hierarchy ─────────────────────────────────────────────────────────────

class FacultyOfSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FacultyOf
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class SchoolSerializer(serializers.ModelSerializer):
    faculty_of_name = serializers.CharField(source='faculty_of.name', read_only=True)

    class Meta:
        model  = School
        fields = ('id', 'faculty_of', 'faculty_of_name', 'name', 'short_name', 'created_at')
        read_only_fields = ('id', 'created_at')


class ProgramSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model  = Program
        fields = ('id', 'school', 'school_name', 'name', 'short_name', 'duration_yrs', 'created_at')
        read_only_fields = ('id', 'created_at')


# ── Faculty ───────────────────────────────────────────────────────────────────

class FacultySerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    user_info   = UserSerializer(source='user', read_only=True)

    class Meta:
        model  = Faculty
        fields = ('faculty_id', 'user', 'user_info', 'name', 'school', 'school_name', 'department', 'created_at')
        read_only_fields = ('created_at',)

    def validate_faculty_id(self, value):
        if not value.strip():
            raise serializers.ValidationError('faculty_id cannot be blank.')
        return value.upper()


class FacultyCreateSerializer(serializers.ModelSerializer):
    """Creates a User + Faculty profile in one shot."""
    jlu_id     = serializers.CharField(write_only=True)
    email      = serializers.EmailField(write_only=True)
    password   = serializers.CharField(write_only=True, required=False, default='Password')
    first_name = serializers.CharField(write_only=True)
    last_name  = serializers.CharField(write_only=True)

    class Meta:
        model  = Faculty
        fields = (
            'faculty_id', 'jlu_id', 'email', 'password',
            'first_name', 'last_name', 'name', 'school', 'department',
        )

    def create(self, validated_data):
        password = validated_data.pop('password', 'Password')
        user = User.objects.create_user(
            jlu_id     = validated_data.pop('jlu_id'),
            email      = validated_data.pop('email'),
            first_name = validated_data.pop('first_name'),
            last_name  = validated_data.pop('last_name'),
            role       = 'faculty',
            password   = password,
        )
        user.must_change_password = (password == 'Password')
        user.save(update_fields=['must_change_password'])
        return Faculty.objects.create(user=user, **validated_data)


# ── Student ───────────────────────────────────────────────────────────────────

class StudentSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    user_info    = UserSerializer(source='user', read_only=True)

    class Meta:
        model  = Student
        fields = (
            'student_id', 'user', 'user_info', 'roll_no', 'gender',
            'program', 'program_name', 'semester', 'section',
            'academic_year', 'created_at',
        )
        read_only_fields = ('created_at',)


class StudentCreateSerializer(serializers.ModelSerializer):
    jlu_id     = serializers.CharField(write_only=True)
    email      = serializers.EmailField(write_only=True)
    password   = serializers.CharField(write_only=True, required=False, default='Password')
    first_name = serializers.CharField(write_only=True)
    last_name  = serializers.CharField(write_only=True)

    class Meta:
        model  = Student
        fields = (
            'student_id', 'jlu_id', 'email', 'password',
            'first_name', 'last_name', 'roll_no', 'gender',
            'program', 'semester', 'section', 'academic_year',
        )

    def create(self, validated_data):
        password = validated_data.pop('password', 'Password')
        user = User.objects.create_user(
            jlu_id     = validated_data.pop('jlu_id'),
            email      = validated_data.pop('email'),
            first_name = validated_data.pop('first_name'),
            last_name  = validated_data.pop('last_name'),
            role       = 'student',
            password   = password,
        )
        user.must_change_password = (password == 'Password')
        user.save(update_fields=['must_change_password'])
        return Student.objects.create(user=user, **validated_data)


# ── CCR ───────────────────────────────────────────────────────────────────────

class CCRSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)

    class Meta:
        model  = CCR
        fields = '__all__'
        read_only_fields = ('total_hrs', 'created_at', 'is_deprecated')

    def validate(self, data):
        iw = data.get('int_weightage', getattr(self.instance, 'int_weightage', None))
        ew = data.get('ese_weightage', getattr(self.instance, 'ese_weightage', None))
        if iw is not None and ew is not None and iw + ew != 100:
            raise serializers.ValidationError('int_weightage + ese_weightage must equal 100.')
        return data


class CourseUnlockLogSerializer(serializers.ModelSerializer):
    unlocked_by_name = serializers.CharField(source='unlocked_by.jlu_id', read_only=True)
    course_code      = serializers.CharField(source='course.course_code', read_only=True)

    class Meta:
        model  = __import__('core.models', fromlist=['CourseUnlockLog']).CourseUnlockLog
        fields = ('id', 'course', 'course_code', 'unlocked_by', 'unlocked_by_name', 'reason', 'unlocked_at')
        read_only_fields = ('id', 'unlocked_at')


# ── Student Enrolment ─────────────────────────────────────────────────────────

class StudentEnrolmentSerializer(serializers.ModelSerializer):
    student_roll = serializers.CharField(source='student.roll_no', read_only=True)
    student_jlu_id = serializers.CharField(source='student.user.jlu_id', read_only=True)
    student_name = serializers.SerializerMethodField()
    course_name  = serializers.CharField(source='course.course_name', read_only=True)

    class Meta:
        model  = StudentEnrolment
        fields = ('id', 'student', 'student_roll', 'student_jlu_id', 'student_name', 'course', 'course_name', 'academic_year', 'admin_override', 'enrolled_at')
        read_only_fields = ('id', 'enrolled_at')

    def get_student_name(self, obj):
        u = obj.student.user
        return f'{u.first_name} {u.last_name}'

    def validate(self, data):
        student = data.get('student')
        course  = data.get('course')
        year    = data.get('academic_year')
        qs = StudentEnrolment.objects.filter(student=student, course=course, academic_year=year)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Student already enrolled in this course for the given academic year.')
        return data


# ── IA Component ──────────────────────────────────────────────────────────────

class IAComponentSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.course_name', read_only=True)

    class Meta:
        model  = IAComponent
        fields = ('id', 'course', 'course_name', 'name', 'weightage', 'max_marks', 'mode', 'created_at')
        read_only_fields = ('id', 'created_at')


# ── Marks Entry ───────────────────────────────────────────────────────────────

class MarksEntrySerializer(serializers.ModelSerializer):
    student_roll   = serializers.CharField(source='student.roll_no', read_only=True)
    student_jlu_id = serializers.CharField(source='student.user.jlu_id', read_only=True)
    component_name = serializers.CharField(source='component.name', read_only=True)
    course_code    = serializers.CharField(source='component.course.course_code', read_only=True)

    class Meta:
        model  = MarksEntry
        fields = (
            'id', 'student', 'student_roll', 'student_jlu_id', 'component', 'component_name',
            'course_code', 'attempt_type', 'marks_obtained', 'scaled_marks',
            'entered_by', 'entered_at', 'updated_at',
        )
        read_only_fields = ('id', 'scaled_marks', 'updated_at')
        # Override validators so updates don't trip on the existing unique triple
        validators = []

    def validate(self, data):
        student   = data.get('student',   getattr(self.instance, 'student',   None))
        component = data.get('component', getattr(self.instance, 'component', None))
        attempt_type = data.get('attempt_type', getattr(self.instance, 'attempt_type', 'Regular'))
        if student and component:
            qs = MarksEntry.objects.filter(student=student, component=component, attempt_type=attempt_type)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists() and not self.instance:
                pass
        return data

    def validate_marks_obtained(self, value):
        component_id = self.initial_data.get('component') or (self.instance.component_id if self.instance else None)
        if component_id:
            try:
                comp = IAComponent.objects.get(pk=component_id)
                if value is not None and value > comp.max_marks:
                    raise serializers.ValidationError(
                        f'marks_obtained ({value}) exceeds max_marks ({comp.max_marks}).'
                    )
            except IAComponent.DoesNotExist:
                pass
        return value

    def create(self, validated_data):
        validated_data.setdefault('entered_at', timezone.now())
        return super().create(validated_data)


class ESEMarksInputSerializer(serializers.Serializer):
    """Used to POST ESE marks and trigger grand_total recompute."""
    ese_marks = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True, default=None)
    attempt_type = serializers.ChoiceField(
        choices=ExamAttemptTypeEnum.choices,
        required=False,
        default='Regular',
    )
    sitting_status = serializers.CharField(required=False, default='Appeared')


# ── Exam Attempt ──────────────────────────────────────────────────────────────

from .models import (
    ExamAttempt, StudentBacklog, CourseExamStats,
    ExamAttemptTypeEnum, ExamAttemptStatusEnum,
)


class ExamAttemptSerializer(serializers.ModelSerializer):
    student_roll   = serializers.CharField(source='student.roll_no',       read_only=True)
    student_name   = serializers.SerializerMethodField()
    course_name    = serializers.CharField(source='course.course_name',    read_only=True)
    entered_by_name = serializers.CharField(source='entered_by.name',      read_only=True)

    class Meta:
        model  = ExamAttempt
        fields = (
            'id', 'student', 'student_roll', 'student_name',
            'course', 'course_name',
            'attempt_type', 'attempt_no', 'academic_year',
            'conducted_on', 'ese_marks', 'status', 'remarks',
            'entered_by', 'entered_by_name', 'entered_at', 'updated_at',
        )
        read_only_fields = ('id', 'attempt_no', 'entered_at', 'updated_at')

    def get_student_name(self, obj):
        u = obj.student.user
        return f'{u.first_name} {u.last_name}'

    def validate(self, data):
        status = data.get('status', getattr(self.instance, 'status', None))
        ese    = data.get('ese_marks', getattr(self.instance, 'ese_marks', None))
        if status in (
            ExamAttemptStatusEnum.PASS, ExamAttemptStatusEnum.FAIL,
        ) and ese is None:
            raise serializers.ValidationError(
                {'ese_marks': 'ese_marks is required when status is Pass or Fail.'}
            )
        return data


class ExamAttemptBulkRegisterSerializer(serializers.Serializer):
    """Register a cohort of students for an exam attempt in one shot."""
    students      = serializers.ListField(child=serializers.CharField(), min_length=1)
    course        = serializers.CharField()
    attempt_type  = serializers.ChoiceField(choices=ExamAttemptTypeEnum.choices)
    academic_year = serializers.CharField(max_length=9)
    conducted_on  = serializers.DateField(required=False, allow_null=True)


class ExamAttemptBulkResultSerializer(serializers.Serializer):
    """Bulk ESE marks + status entry."""
    results = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        help_text='List of {student, course, attempt_type, attempt_no, ese_marks, status}',
    )


# ── Student Backlog ───────────────────────────────────────────────────────────

class StudentBacklogSerializer(serializers.ModelSerializer):
    student_roll   = serializers.CharField(source='student.roll_no',    read_only=True)
    student_name   = serializers.SerializerMethodField()
    course_name    = serializers.CharField(source='course.course_name', read_only=True)
    origin_attempt_info  = ExamAttemptSerializer(source='origin_attempt',   read_only=True)
    clearing_attempt_info = ExamAttemptSerializer(source='clearing_attempt', read_only=True)

    class Meta:
        model  = StudentBacklog
        fields = (
            'id', 'student', 'student_roll', 'student_name',
            'course', 'course_name',
            'reason', 'status',
            'origin_attempt', 'origin_attempt_info',
            'clearing_attempt', 'clearing_attempt_info',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_student_name(self, obj):
        u = obj.student.user
        return f'{u.first_name} {u.last_name}'


# ── Course Exam Stats ─────────────────────────────────────────────────────────

class CourseExamStatsSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.course_name', read_only=True)

    class Meta:
        model  = CourseExamStats
        fields = (
            'id', 'course', 'course_name', 'academic_year', 'attempt_type',
            'total_registered', 'total_appeared', 'total_absent',
            'total_pass', 'total_fail', 'total_withheld',
            'pass_rate', 'avg_marks', 'computed_at',
        )
        read_only_fields = '__all__'


# ── Updated ResultSheet (re-declare to include pass_status) ──────────────────

class ResultSheetSerializer(serializers.ModelSerializer):
    student_roll   = serializers.CharField(source='student.roll_no',       read_only=True)
    student_jlu_id = serializers.CharField(source='student.user.jlu_id',   read_only=True)
    course_name    = serializers.CharField(source='course.course_name',    read_only=True)

    class Meta:
        model  = ResultSheet
        fields = (
            'id', 'student', 'student_roll', 'student_jlu_id', 'course', 'course_name',
            'active_attempt_type', 'int_total', 'ese_marks', 'grand_total',
            'ia_pass_status', 'ese_pass_status', 'pass_status', 'computed_at',
        )
        read_only_fields = ('id', 'int_total', 'grand_total', 'ia_pass_status', 'ese_pass_status', 'computed_at')
