"""
exceptions.py
─────────────
1. custom_exception_handler  — wraps every DRF error in a uniform envelope:
       {
           "success": false,
           "code":    "validation_error",   ← machine-readable snake_case key
           "message": "Human readable ...", ← single summary string
           "errors":  { ... }               ← field-level detail (when present)
       }

2. Domain exception classes that views can raise directly.
"""
from __future__ import annotations

import logging
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import (
    APIException, ValidationError, AuthenticationFailed,
    NotAuthenticated, PermissionDenied, NotFound,
    MethodNotAllowed, Throttled,
)
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.http import Http404

logger = logging.getLogger(__name__)


# ── Domain Exceptions ─────────────────────────────────────────────────────────

class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'A conflict occurred.'
    default_code = 'conflict'


class UnprocessableEntity(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = 'Unprocessable entity.'
    default_code = 'unprocessable_entity'


class ServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Service temporarily unavailable.'
    default_code = 'service_unavailable'


# ── Code Map ──────────────────────────────────────────────────────────────────

_STATUS_TO_CODE: dict[int, str] = {
    400: 'bad_request',
    401: 'authentication_failed',
    403: 'permission_denied',
    404: 'not_found',
    405: 'method_not_allowed',
    409: 'conflict',
    422: 'unprocessable_entity',
    429: 'throttled',
    500: 'internal_server_error',
    503: 'service_unavailable',
}


def _flatten_errors(detail) -> dict | list | str:
    """
    Recursively convert DRF ErrorDetail / nested dicts / lists
    into plain strings for clean JSON serialisation.
    """
    if isinstance(detail, list):
        flat = [_flatten_errors(d) for d in detail]
        return flat[0] if len(flat) == 1 else flat
    if isinstance(detail, dict):
        return {k: _flatten_errors(v) for k, v in detail.items()}
    return str(detail)


def _first_message(detail) -> str:
    """Extract a single human-readable summary sentence from nested detail."""
    if isinstance(detail, dict):
        for v in detail.values():
            return _first_message(v)
    if isinstance(detail, list):
        return _first_message(detail[0])
    return str(detail)


# ── Handler ───────────────────────────────────────────────────────────────────

def custom_exception_handler(exc, context):
    # Convert Django's Http404 / ValidationError so DRF can handle them
    if isinstance(exc, Http404):
        exc = NotFound()
    elif isinstance(exc, DjangoValidationError):
        exc = ValidationError(detail=exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
    elif isinstance(exc, IntegrityError):
        # e.g. duplicate student_id, unique constraint violations
        msg = str(exc)
        if 'unique' in msg.lower() or 'duplicate' in msg.lower():
            exc = ValidationError(detail={'non_field_errors': ['A record with these details already exists.']})
        else:
            exc = ValidationError(detail={'non_field_errors': [f'Database integrity error: {msg}']})

    response = drf_exception_handler(exc, context)

    if response is None:
        # Unhandled exception — log it, return 500
        logger.exception('Unhandled exception in %s', context.get('view'))
        return Response(
            {
                'success': False,
                'code':    'internal_server_error',
                'message': 'An unexpected error occurred. Please try again later.',
                'errors':  {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code    = _STATUS_TO_CODE.get(response.status_code, 'error')
    detail  = response.data

    # DRF wraps everything in {"detail": ...} for non-validation errors
    if isinstance(detail, dict) and list(detail.keys()) == ['detail']:
        message = str(detail['detail'])
        errors  = {}
    elif isinstance(detail, dict):
        errors  = _flatten_errors(detail)
        message = _first_message(detail)
    else:
        message = str(detail)
        errors  = {}

    response.data = {
        'success': False,
        'code':    code,
        'message': message,
        'errors':  errors,
    }
    return response
