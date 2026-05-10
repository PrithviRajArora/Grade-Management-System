from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, FacultyOfViewSet, SchoolViewSet, ProgramViewSet,
    FacultyViewSet, StudentViewSet, CCRViewSet, StudentEnrolmentViewSet,
    IAComponentViewSet, MarksEntryViewSet, ResultSheetViewSet,
    ExamAttemptViewSet, StudentBacklogViewSet, CourseExamStatsViewSet,
)
from .analytics import (
    DashboardView, CourseSummaryView, GradeDistributionView,
    TopperListView, StudentReportView, IABreakdownView,
)

router = DefaultRouter()
router.register(r'users',           UserViewSet,            basename='user')
router.register(r'faculty-of',      FacultyOfViewSet,       basename='faculty-of')
router.register(r'schools',         SchoolViewSet,          basename='school')
router.register(r'programs',        ProgramViewSet,         basename='program')
router.register(r'faculty',         FacultyViewSet,         basename='faculty')
router.register(r'students',        StudentViewSet,         basename='student')
router.register(r'ccr',             CCRViewSet,             basename='ccr')
router.register(r'enrolments',      StudentEnrolmentViewSet,basename='enrolment')
router.register(r'ia-components',   IAComponentViewSet,     basename='ia-component')
router.register(r'marks',           MarksEntryViewSet,      basename='marks')
router.register(r'result-sheets',   ResultSheetViewSet,     basename='result-sheet')
router.register(r'exam-attempts',   ExamAttemptViewSet,     basename='exam-attempt')
router.register(r'backlogs',        StudentBacklogViewSet,  basename='backlog')
router.register(r'exam-stats',      CourseExamStatsViewSet, basename='exam-stat')

analytics_urlpatterns = [
    path('analytics/dashboard/',         DashboardView.as_view(),         name='analytics-dashboard'),
    path('analytics/course_summary/',    CourseSummaryView.as_view(),     name='analytics-course-summary'),
    path('analytics/grade_distribution/',GradeDistributionView.as_view(), name='analytics-grade-dist'),
    path('analytics/toppers/',           TopperListView.as_view(),        name='analytics-toppers'),
    path('analytics/student_report/',    StudentReportView.as_view(),     name='analytics-student-report'),
    path('analytics/ia_breakdown/',      IABreakdownView.as_view(),       name='analytics-ia-breakdown'),
]

urlpatterns = [
    path('', include(router.urls)),
    *analytics_urlpatterns,
]
