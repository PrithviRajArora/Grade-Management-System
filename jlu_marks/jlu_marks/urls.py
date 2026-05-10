from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from core.token import CustomTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/',   CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(),          name='token_refresh'),
    path('api/', include('core.urls')),
]
