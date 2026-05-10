from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, FacultyOf, School, Program, Faculty, Student,
    CCR, StudentEnrolment, IAComponent, MarksEntry, ResultSheet,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('jlu_id', 'email', 'first_name', 'last_name', 'role', 'is_active')
    list_filter   = ('role', 'is_active', 'is_staff')
    search_fields = ('jlu_id', 'email', 'first_name', 'last_name')
    ordering      = ('jlu_id',)

    fieldsets = (
        (None, {'fields': ('jlu_id', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'created_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('jlu_id', 'email', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )
    readonly_fields = ('created_at', 'last_login')


@admin.register(FacultyOf)
class FacultyOfAdmin(admin.ModelAdmin):
    list_display  = ('id', 'name', 'short_name', 'created_at')
    search_fields = ('name', 'short_name')


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display  = ('id', 'name', 'short_name', 'faculty_of')
    list_filter   = ('faculty_of',)
    search_fields = ('name', 'short_name')


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display  = ('id', 'short_name', 'name', 'school', 'duration_yrs')
    list_filter   = ('school',)
    search_fields = ('name', 'short_name')


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display  = ('faculty_id', 'name', 'school', 'department')
    list_filter   = ('school',)
    search_fields = ('faculty_id', 'name', 'department')
    raw_id_fields = ('user',)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display  = ('student_id', 'roll_no', 'program', 'semester', 'section', 'academic_year')
    list_filter   = ('program', 'semester', 'gender', 'academic_year')
    search_fields = ('student_id', 'roll_no')
    raw_id_fields = ('user',)


class IAComponentInline(admin.TabularInline):
    model  = IAComponent
    extra  = 1
    fields = ('name', 'mode', 'max_marks', 'weightage')


@admin.register(CCR)
class CCRAdmin(admin.ModelAdmin):
    list_display  = ('course_code', 'course_name', 'course_type', 'faculty', 'program', 'semester', 'academic_year', 'credits')
    list_filter   = ('course_type', 'academic_year', 'semester', 'ese_mode')
    search_fields = ('course_code', 'course_name')
    inlines       = [IAComponentInline]


@admin.register(StudentEnrolment)
class StudentEnrolmentAdmin(admin.ModelAdmin):
    list_display  = ('id', 'student', 'course', 'academic_year', 'enrolled_at')
    list_filter   = ('academic_year',)
    search_fields = ('student__student_id', 'course__course_code')
    raw_id_fields = ('student', 'course')


@admin.register(IAComponent)
class IAComponentAdmin(admin.ModelAdmin):
    list_display  = ('id', 'course', 'name', 'mode', 'max_marks', 'weightage')
    list_filter   = ('mode', 'course')
    search_fields = ('name', 'course__course_code')


@admin.register(MarksEntry)
class MarksEntryAdmin(admin.ModelAdmin):
    list_display  = ('id', 'student', 'component', 'marks_obtained', 'scaled_marks', 'entered_by', 'updated_at')
    list_filter   = ('entered_by',)
    search_fields = ('student__student_id', 'component__name')
    raw_id_fields = ('student', 'component', 'entered_by')


@admin.register(ResultSheet)
class ResultSheetAdmin(admin.ModelAdmin):
    list_display  = ('id', 'student', 'course', 'int_total', 'ese_marks', 'grand_total', 'computed_at')
    list_filter   = ('course',)
    search_fields = ('student__student_id', 'course__course_code')
    raw_id_fields = ('student', 'course')
