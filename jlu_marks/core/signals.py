"""
Signals
───────
1. StudentEnrolment post_save  → create ResultSheet row automatically
2. MarksEntry post_save/delete → recompute ResultSheet.int_total
3. ExamAttempt post_save       →
     • Pass   : update ResultSheet.ese_marks + pass_status, clear Active backlogs
     • Fail   : create / keep Active StudentBacklog (reason=Failed)
     • Absent : create / keep Active StudentBacklog (reason=Absent)
     • Any    : refresh CourseExamStats slice
"""
from decimal import Decimal
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import (
    StudentEnrolment, MarksEntry, ResultSheet, IAComponent, CCR,
    ExamAttempt, StudentBacklog, CourseExamStats,
    ExamAttemptStatusEnum, BacklogReasonEnum, BacklogStatusEnum, PassStatusEnum,
)


# ── 1. Auto-create ResultSheet on enrolment ───────────────────────────────────

@receiver(post_save, sender=StudentEnrolment)
def create_result_sheet_on_enrolment(sender, instance, created, **kwargs):
    if created:
        ResultSheet.objects.get_or_create(
            student=instance.student,
            course=instance.course,
        )


# ── 2. Recompute int_total whenever a MarksEntry is saved or deleted ──────────

def _recompute_for_entry(entry: MarksEntry):
    """Find the ResultSheet for this student+course and recompute all totals
    and pass/fail statuses via sheet.compute().

    Filters MarksEntry by the entry's attempt_type so that each attempt's
    IA marks are aggregated independently.

    BUG FIX: previously used ResultSheet.objects.filter().update() which
    only refreshed int_total/grand_total and silently skipped ia_pass_status
    and pass_status. Now delegates to sheet.compute() which recalculates
    every field in one place.
    """
    course = entry.component.course
    attempt_type = entry.attempt_type

    try:
        sheet = ResultSheet.objects.select_related('course').get(
            student=entry.student, course=course
        )
    except ResultSheet.DoesNotExist:
        sheet = ResultSheet.objects.create(student=entry.student, course=course)

    # Only recompute if this entry's attempt_type matches the sheet's active attempt
    # (avoid overwriting int_total with a different attempt's marks)
    if sheet.active_attempt_type != attempt_type:
        # This entry is for a non-active attempt — store the marks but don't
        # update the result sheet's int_total (the sheet shows the active attempt).
        return

    # compute() recalculates int_total, grand_total, ia_pass_status,
    # ese_pass_status, and pass_status in one call and saves the sheet.
    sheet.compute(attempt_type=attempt_type)


@receiver(post_save, sender=MarksEntry)
def recompute_result_on_marks_save(sender, instance, **kwargs):
    _recompute_for_entry(instance)


@receiver(post_delete, sender=MarksEntry)
def recompute_result_on_marks_delete(sender, instance, **kwargs):
    _recompute_for_entry(instance)


# ── 3. ExamAttempt post_save ──────────────────────────────────────────────────

@receiver(post_save, sender=ExamAttempt)
def handle_exam_attempt_saved(sender, instance, created, **kwargs):
    """
    Central handler for exam attempt status changes.
    """
    status = instance.status

    # ── A. Pass → update ResultSheet ese_marks + pass_status, clear backlogs ──
    if status == ExamAttemptStatusEnum.PASS:
        _sync_result_sheet_ese(instance)
        _clear_backlogs(instance)

    # ── A2. Appeared → sync ESE marks to ResultSheet (pass/fail TBD) ─────────
    elif status == ExamAttemptStatusEnum.APPEARED:
        if instance.ese_marks is not None:
            _sync_result_sheet_ese(instance)

    # ── B. Fail / Absent → ensure an Active backlog exists ───────────────────
    elif status in (ExamAttemptStatusEnum.FAIL, ExamAttemptStatusEnum.ABSENT):
        reason = (
            BacklogReasonEnum.FAILED
            if status == ExamAttemptStatusEnum.FAIL
            else BacklogReasonEnum.ABSENT
        )
        _ensure_backlog(instance, reason)
        # Also update ResultSheet pass_status for Fail with ese_marks
        if status == ExamAttemptStatusEnum.FAIL and instance.ese_marks is not None:
            _sync_result_sheet_ese(instance, force_status=PassStatusEnum.FAIL)

    # ── C. Withheld → mark result sheet ──────────────────────────────────────
    elif status == ExamAttemptStatusEnum.WITHHELD:
        try:
            sheet = ResultSheet.objects.get(student=instance.student, course=instance.course)
            ResultSheet.objects.filter(pk=sheet.pk).update(pass_status=PassStatusEnum.WITHHELD)
        except ResultSheet.DoesNotExist:
            pass

    # ── D. Always refresh aggregated stats ───────────────────────────────────
    CourseExamStats.refresh_for(
        course=instance.course,
        academic_year=instance.academic_year,
        attempt_type=instance.attempt_type,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sync_result_sheet_ese(attempt: ExamAttempt, force_status=None):
    """
    Copy ese_marks from the attempt into ResultSheet and recompute grand_total + pass_status.
    Also recomputes int_total for this attempt_type's IA marks.
    Only updates when ese_marks is set on the attempt.
    """
    if attempt.ese_marks is None:
        return

    try:
        sheet = ResultSheet.objects.select_related('course').get(
            student=attempt.student, course=attempt.course,
        )
    except ResultSheet.DoesNotExist:
        sheet = ResultSheet.objects.create(
            student=attempt.student, course=attempt.course,
        )

    from django.db.models import Sum
    from .models import CCR
    # Always fetch a fresh CCR so that threshold changes (int_weightage,
    # ese_weightage, ese_max_marks) are never served from a cached FK object.
    course      = CCR.objects.get(pk=attempt.course_id)
    at          = attempt.attempt_type
    ese_marks   = attempt.ese_marks

    # Recompute int_total for this attempt_type
    agg = MarksEntry.objects.filter(
        student=attempt.student,
        component__course=course,
        attempt_type=at,
        scaled_marks__isnull=False,
    ).aggregate(total=Sum('scaled_marks'))
    int_total = Decimal(str(agg['total'] or 0))

    grand_total = (
        # int_total is already expressed in int_weightage units — do not
        # multiply by int_weightage/100 a second time.
        int_total +
        Decimal(str(ese_marks)) * Decimal(str(course.ese_weightage)) / Decimal('100')
    )

    # ── Separate IA / ESE pass checks — read thresholds from CCR ──────────────
    ia_threshold  = Decimal(str(course.ia_pass_min))
    ese_threshold = Decimal(str(course.ese_pass_min))

    ia_pass_status  = PassStatusEnum.PASS if int_total  >= ia_threshold  else PassStatusEnum.FAIL
    ese_pass_status = PassStatusEnum.PASS if Decimal(str(ese_marks)) >= ese_threshold else PassStatusEnum.FAIL

    if force_status:
        pass_status = force_status
    else:
        ia_ok  = ia_pass_status  == PassStatusEnum.PASS
        ese_ok = ese_pass_status == PassStatusEnum.PASS
        pass_status = PassStatusEnum.PASS if (ia_ok and ese_ok) else PassStatusEnum.FAIL

    ResultSheet.objects.filter(pk=sheet.pk).update(
        int_total=int_total,
        ese_marks=ese_marks,
        grand_total=grand_total,
        ia_pass_status=ia_pass_status,
        ese_pass_status=ese_pass_status,
        pass_status=pass_status,
        active_attempt_type=at,
    )


def _ensure_backlog(attempt: ExamAttempt, reason: str):
    """
    Create an Active backlog for this student+course if one doesn't already exist.
    Uses origin_attempt to de-duplicate (one backlog per attempt that caused it).
    """
    StudentBacklog.objects.get_or_create(
        student=attempt.student,
        course=attempt.course,
        origin_attempt=attempt,
        defaults={
            'reason': reason,
            'status': BacklogStatusEnum.ACTIVE,
        },
    )


def _clear_backlogs(attempt: ExamAttempt):
    """
    Mark all Active backlogs for this student+course as Cleared,
    pointing to this passing attempt.
    """
    StudentBacklog.objects.filter(
        student=attempt.student,
        course=attempt.course,
        status=BacklogStatusEnum.ACTIVE,
    ).update(
        status=BacklogStatusEnum.CLEARED,
        clearing_attempt=attempt,
    )

# ── 4. Recompute all ResultSheets when an IAComponent weightage/max_marks changes ──

@receiver(post_save, sender=IAComponent)
def recompute_on_component_change(sender, instance, **kwargs):
    """
    When a component's weightage or max_marks is edited, all existing
    MarksEntry.scaled_marks for that component are stale (they were calculated
    against the old max_marks/weightage). Recompute them first, then recompute
    every affected ResultSheet.

    BUG FIX: previously there was no signal here, so threshold/weightage
    changes never propagated to ResultSheet pass/fail statuses.
    """
    # 1. Recompute scaled_marks for every MarksEntry on this component.
    #    Call .save() on each so the MarksEntry.save() scaling logic runs,
    #    but temporarily disconnect our own signal to avoid recursive calls.
    post_save.disconnect(recompute_result_on_marks_save, sender=MarksEntry)
    try:
        for entry in MarksEntry.objects.filter(component=instance).select_related('component'):
            if entry.marks_obtained is not None:
                if instance.max_marks and float(instance.max_marks) > 0:
                    entry.scaled_marks = (
                        float(entry.marks_obtained) / float(instance.max_marks)
                    ) * float(instance.weightage)
                    MarksEntry.objects.filter(pk=entry.pk).update(
                        scaled_marks=entry.scaled_marks
                    )
    finally:
        post_save.connect(recompute_result_on_marks_save, sender=MarksEntry)

    # 2. Recompute every ResultSheet that has enrolments in this course.
    course = instance.course
    for sheet in ResultSheet.objects.filter(course=course).select_related('course'):
        sheet.compute(attempt_type=sheet.active_attempt_type)


# ── 5. Recompute all ResultSheets when CCR thresholds change ─────────────────

@receiver(post_save, sender=CCR)
def recompute_on_ccr_threshold_change(sender, instance, created, **kwargs):
    """
    When ia_pass_min, ese_pass_min, or overall_pass_min changes on a CCR,
    all existing ResultSheets for that course must be recomputed so that
    pass/fail statuses reflect the new thresholds immediately.

    Skips on creation (no ResultSheets exist yet).
    """
    if created:
        return

    for sheet in ResultSheet.objects.filter(course=instance).select_related('course'):
        # Pass the fresh CCR instance explicitly so compute() doesn't need
        # to re-fetch it (though it will — CCR.objects.get — as a safety net).
        sheet.compute(attempt_type=sheet.active_attempt_type)
