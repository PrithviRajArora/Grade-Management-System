"""
Custom JWT token classes
────────────────────────
Adds the following claims to both access and refresh tokens:
  • role        — admin / faculty / student
  • full_name   — "First Last"
  • profile_id  — faculty_id or student_id (empty string for admin)

Usage in settings:
    SIMPLE_JWT = {
        ...
        "TOKEN_OBTAIN_SERIALIZER": "core.token.CustomTokenObtainPairSerializer",
    }
"""
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken


class CustomRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        _inject_claims(token, user)
        return token


def _inject_claims(token, user):
    token['role']      = user.role
    token['full_name'] = f'{user.first_name} {user.last_name}'
    token['jlu_id']    = user.jlu_id

    profile_id = ''
    if user.role == 'faculty':
        try:
            profile_id = user.faculty_profile.faculty_id
        except Exception:
            pass
    elif user.role == 'student':
        try:
            profile_id = user.student_profile.student_id
        except Exception:
            pass
    token['profile_id'] = profile_id


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Returns the standard access+refresh pair, but with extra claims injected
    into both tokens and also echoed in the response body for convenience.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        _inject_claims(token, user)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Echo claims in the JSON response so the frontend doesn't have to
        # decode the JWT just to know who logged in.
        data['role']                 = self.user.role
        data['full_name']            = f'{self.user.first_name} {self.user.last_name}'
        data['jlu_id']               = self.user.jlu_id
        data['must_change_password'] = self.user.must_change_password
        data['profile_id'] = ''
        if self.user.role == 'faculty':
            try:
                data['profile_id'] = self.user.faculty_profile.faculty_id
            except Exception:
                pass
        elif self.user.role == 'student':
            try:
                data['profile_id'] = self.user.student_profile.student_id
            except Exception:
                pass
        return data


# ── Custom token view (thin wrapper — lets DRF routing stay clean) ────────────
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
