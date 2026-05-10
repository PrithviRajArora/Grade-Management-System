# Continuity Document: Unified Attempt-Based Marks System

## Current Objective
Remediating academic grading logic to fix the grand total double-scaling bug, unifying the ESE marks entry and Exam Attempt workflows, implementing a marks reset/re-evaluation workflow for failed students, and preserving full attempt history for both IA and ESE marks.

## Work Completed So Far
1. **Database Schema & Models (`models.py`)**:
   - Added `attempt_type` to `MarksEntry` (with unique_together `[student, component, attempt_type]`).
   - Added `active_attempt_type` to `ResultSheet`.
   - Corrected `ResultSheet.compute()` formula: `grand_total = int_total + (ese_marks * ese_weightage / 100)`.
2. **Signals (`signals.py`)**:
   - Updated `_recompute_for_entry` to correctly filter `MarksEntry` aggregates by `attempt_type` and respect the `active_attempt_type`.
   - Updated `_sync_result_sheet_ese` to recalculate `int_total` specific to the attempt type before calculating the grand total.
3. **Serializers & Views (`serializers.py`, `views.py`)**:
   - Included `attempt_type` in Serializers (`MarksEntrySerializer`, `ESEMarksInputSerializer`, `ResultSheetSerializer`).
   - Rewrote `enter_ese` endpoint to create/update an `ExamAttempt` record as the single source of truth.
   - Added `reset_for_reattempt` and `batch_reset` API actions to `ResultSheetViewSet` to handle clearing ESE marks and scheduling a new `ExamAttempt`.
4. **Testing (`tests.py`)**:
   - Updated expected values in unit tests to reflect the corrected `grand_total` formula.
5. **Database Migration**:
   - Created migration `0009_add_attempt_type_fields` for the `core` app.
6. **Frontend — API (`api.js`)**:
   - Added `resetForReattempt`, `batchReset`, and `compute` endpoints.
7. **Frontend — IA Tab (`CourseDetail.jsx`)**:
   - Wired the attempt type selector to filter fetched marks and include `attempt_type` when saving marks. 

## Known Issues / Blocker Addressed
- **Database Authentication Error**: When attempting to run `python manage.py migrate`, it failed due to: `FATAL: password authentication failed for user "prithvirajarora"`. 
- **Action Required by User**: The database credentials in `e:\newestjlu gma draft 5 bro\draft-5\jlu_marks\.env` need to be corrected/verified, and the user must run `python manage.py migrate` locally.

## Remaining Work (In Progress)
1. **Frontend — ESE Tab (`CourseDetail.jsx`)**:
   - Wire the ESE attempt type selector so it includes the `attempt_type` payload when saving ESE marks (`saveOne`, `saveAll`).
2. **Frontend — Exam Attempts Tab (`CourseDetail.jsx`)**:
   - Enhance the UI to show attempt history per student.
   - Implement the "Reset & Re-register" action to use the new `reset_for_reattempt` API endpoint.
3. **Frontend — Admin Panel (`AdminPanel.jsx`)**:
   - Fix the Faculty Add Modal to use auto-suggest IDs.
4. **Verification**:
   - Add dummy data and test the full cycle (IA marks -> ESE marks -> Fail -> Reset -> Retake).

## Next Steps for the AI
1. Update `CourseDetail.jsx` (ESE Marks Tab).
2. Update `CourseDetail.jsx` (Exam Attempts Tab).
3. Fix the Faculty ID auto-suggest feature.
4. Provide the dummy data script and testing instructions.
