from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsAdminOrFaculty(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'faculty')


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role == 'admin'


class IsSelfOrAdmin(BasePermission):
    """Allow users to view/edit their own record; admins can do anything."""
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        # obj is a User, Faculty, or Student — resolve to user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return obj == request.user


class FacultyCanEnterMarks(BasePermission):
    """Faculty may only enter marks for courses they own."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'faculty')

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if request.method in SAFE_METHODS:
            return True
        try:
            faculty = request.user.faculty_profile
            return obj.component.course.faculty == faculty
        except Exception:
            return False
