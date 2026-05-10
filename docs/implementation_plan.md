# Fix Critical Bugs & Implement Unified ESE/Attempt System with Marks Reset

## Background

The academic system has several interconnected bugs around how ESE marks, grand totals, and exam attempts are managed. The core issues are:

1. **Grand total double-scaling** — `int_total` is already in scaled units but gets multiplied by `int_weightage/100` again
2. **ESE Tab & ExamAttempts Tab are disconnected** — two parallel paths to set `ese_marks` on `ResultSheet` with no shared source of truth
3. **Attempt Type selectors are display-only** — the UI toggles do nothing
4. **Faculty "Add" modal lacks auto-suggest IDs**
5. **No marks reset / re-evaluation workflow** for failed students

> [!IMPORTANT]
> The grand total formula fix will change all existing computed values in the database. A recompute of all result sheets will be needed after migration.

## Open Questions

> [!IMPORTANT]
> **Q1: Should the ESE tab be completely removed in favor of the ExamAttempts-based workflow?**
> The plan below keeps both but **unifies them** — the ESE tab now creates/updates `ExamAttempt` records under the hood, making ExamAttempts the single source of truth. The ESE tab becomes a simplified "quick entry" view. If you'd prefer to remove the ESE tab entirely, let me know.

> [!IMPORTANT]
> **Q2: When a failed student is registered for a re-attempt and their marks are "reset", should the old IA marks (int_total) be preserved or also zeroed out?**
> The plan below preserves IA marks (they represent internal assessment, not ESE). Only `ese_marks` and `grand_total` are reset on the ResultSheet when registering for a new attempt. The old ESE attempt is still fully preserved in the `ExamAttempt` history table.

---

## Proposed Changes

### 1. Backend — Fix Grand Total Formula

#### [MODIFY] [models.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/models.py)

Fix `ResultSheet.compute()` (line 449–470):

```diff
 def compute(self):
     ...
     if self.int_total is not None and self.ese_marks is not None:
         course = self.course
         self.grand_total = (
-            self.int_total  * Decimal(str(course.int_weightage))  / Decimal('100') +
-            self.ese_marks  * Decimal(str(course.ese_weightage))  / Decimal('100')
+            self.int_total +
+            self.ese_marks * Decimal(str(course.ese_weightage)) / Decimal('100')
         )
```

**Rationale**: `int_total` is the sum of `scaled_marks` values, each already computed as `(marks_obtained / max_marks) × component_weightage`. It's already expressed in int_weightage units.

---

#### [MODIFY] [signals.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/signals.py)

The signal formulas in `_recompute_for_entry` (line 59–62) and `_sync_result_sheet_ese` (line 145–150) are already correct (they were fixed previously — the code shows `int_total +` without double-scaling). **No changes needed** in signals.py — confirmed the current code is correct.

---

#### [MODIFY] [tests.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/tests.py)

Fix `test_grand_total_computed_after_ese` (line 224–247) — the expected value uses the old double-scaled formula:

```diff
-        # grand_total = 32*(40/100) + 70*(60/100) = 12.8 + 42 = 54.8
-        self.assertEqual(sheet.grand_total, Decimal('54.80'))
+        # grand_total = 32 + 70*(60/100) = 32 + 42 = 74
+        self.assertEqual(sheet.grand_total, Decimal('74.00'))
```

---

### 2. Backend — Unify ESE Tab with ExamAttempts (Single Source of Truth)

#### [MODIFY] [views.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/views.py)

Modify `ResultSheetViewSet.enter_ese()` (line 575–584) to **create/update an ExamAttempt record** whenever ESE marks are entered via the ESE tab. This ensures:
- Every ESE mark entry creates a traceable `ExamAttempt` record
- The signal on `ExamAttempt.save()` fires backlog logic correctly
- `CourseExamStats` gets refreshed

```python
@action(detail=True, methods=['post'])
def enter_ese(self, request, pk=None):
    result = self.get_object()
    serializer = ESEMarksInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    ese_marks = serializer.validated_data['ese_marks']
    attempt_type = request.data.get('attempt_type', 'Regular')
    
    faculty = _get_faculty(request)
    
    # Create or update an ExamAttempt record — single source of truth
    attempt, created = ExamAttempt.objects.get_or_create(
        student=result.student,
        course=result.course,
        attempt_type=attempt_type,
        defaults={
            'attempt_no': 1,
            'academic_year': result.course.academic_year,
            'ese_marks': ese_marks,
            'status': ExamAttemptStatusEnum.PASS if ese_marks >= ResultSheet.PASS_THRESHOLD else ExamAttemptStatusEnum.FAIL,
            'entered_by': faculty,
            'entered_at': timezone.now(),
        }
    )
    if not created:
        attempt.ese_marks = ese_marks
        attempt.status = ExamAttemptStatusEnum.PASS if ese_marks >= ResultSheet.PASS_THRESHOLD else ExamAttemptStatusEnum.FAIL
        attempt.entered_by = faculty
        attempt.entered_at = timezone.now()
        attempt.save()  # triggers signal
    
    # Refresh from DB (signal updated ResultSheet)
    result.refresh_from_db()
    return Response(ResultSheetSerializer(result).data)
```

#### [NEW] Add `reset_for_reattempt` action to `ResultSheetViewSet`

New endpoint: `POST /result-sheets/{id}/reset_for_reattempt/`

```python
@action(detail=True, methods=['post'])
def reset_for_reattempt(self, request, pk=None):
    """
    Reset ESE marks and grand_total for a failed student being registered for re-evaluation.
    Creates a new ExamAttempt record with status=Scheduled.
    Old attempt history is preserved.
    """
    result = self.get_object()
    attempt_type = request.data.get('attempt_type', 'Backlog')
    
    # Only allow reset for failed students
    if result.pass_status not in (PassStatusEnum.FAIL, PassStatusEnum.INCOMPLETE):
        return Response({'detail': 'Can only reset for failed or incomplete students.'}, status=400)
    
    # Reset ESE-related fields on ResultSheet
    result.ese_marks = None
    result.grand_total = None
    result.pass_status = PassStatusEnum.INCOMPLETE
    result.save()
    
    # Register a new ExamAttempt with Scheduled status
    faculty = _get_faculty(request)
    ExamAttempt.objects.create(
        student=result.student,
        course=result.course,
        attempt_type=attempt_type,
        academic_year=result.course.academic_year,
        status=ExamAttemptStatusEnum.SCHEDULED,
        entered_by=faculty,
        entered_at=timezone.now(),
    )
    
    return Response(ResultSheetSerializer(result).data)
```

#### [NEW] Add `batch_reset` action to `ResultSheetViewSet`

New endpoint: `POST /result-sheets/batch_reset/`

```python
@action(detail=False, methods=['post'])
def batch_reset(self, request):
    """
    Reset marks for multiple failed students at once.
    Body: { course, attempt_type, students: [sid1, sid2, ...] }
    """
    # Reset ESE marks for each, register new attempt
```

---

### 3. Frontend — API Layer

#### [MODIFY] [api.js](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_frontend/src/api.js)

Add new API methods:

```diff
 export const results = {
   list:       params => api.get('/result-sheets/',              { params }),
   enterESE:   (id,d) => api.post(`/result-sheets/${id}/enter_ese/`, d),
   computeAll: course => api.post(`/result-sheets/compute_all/?course=${course}`),
+  resetForReattempt: (id, d) => api.post(`/result-sheets/${id}/reset_for_reattempt/`, d),
+  batchReset: data => api.post('/result-sheets/batch_reset/', data),
 }
```

---

### 4. Frontend — Fix ESE Tab (Unified with ExamAttempts)

#### [MODIFY] [CourseDetail.jsx](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_frontend/src/pages/CourseDetail.jsx)

**ESETab changes** (lines 505–778):
- Pass `attempt_type` (from `eseAttemptType` state) to `resultsApi.enterESE()` — now the backend will create a proper `ExamAttempt` record
- The attempt type selector now **does something** — it's passed to the API
- Remove the dead `eseAttemptType` selector OR wire it to actually filter/create the right attempt type

```diff
 // In saveOne():
 const payload = statusCfg?.disablesMarks
   ? { ese_marks: null }
-  : { ese_marks: parseFloat(e.ese) }
+  : { ese_marks: parseFloat(e.ese), attempt_type: eseAttemptType }
```

**MarksTab changes** (lines 229–491):
- Remove the dead `attemptType` selector from the IA Marks tab, since IA marks don't have attempt types — there's only one set of IA marks per student per component

---

### 5. Frontend — Exam Attempts Tab (Marks Reset Feature)

#### [MODIFY] [CourseDetail.jsx](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_frontend/src/pages/CourseDetail.jsx)

**ExamAttemptsTab changes** (lines 854–1244):

Add a **"Reset & Re-register"** button for failed students that:
1. Calls `resetForReattempt` API to zero out ESE marks on their ResultSheet
2. Creates a new `ExamAttempt` with `Scheduled` status
3. Shows a confirmation modal with attempt history before proceeding

Add a **batch "Reset All Failed"** button alongside existing "Register N for Next Attempt" that does both the marks reset AND the re-registration in one click.

Add an **"Attempt History" expandable row** (or modal) for each student showing all their past ExamAttempt records with marks, dates, and statuses — enabling full backtracking.

---

### 6. Frontend — Faculty "Add" Modal Auto-Suggest IDs

#### [MODIFY] [AdminPanel.jsx](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_frontend/src/pages/AdminPanel.jsx)

Add `useEffect` to `AddFacultyModal` (line 431) to call `facultyApi.nextId()`:

```diff
 function AddFacultyModal({ schools, onClose, onSaved, toast }) {
   const [form, setForm] = useState({...})
+  useEffect(() => {
+    facultyApi.nextId()
+      .then(r => setForm(p => ({
+        ...p,
+        faculty_id: p.faculty_id || r.data.faculty_id,
+        jlu_id: p.jlu_id || r.data.jlu_id,
+      })))
+      .catch(() => {})
+  }, [])
```

---

### 7. ESEMarksInputSerializer Update

#### [MODIFY] [serializers.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/serializers.py)

Add optional `attempt_type` field to `ESEMarksInputSerializer`:

```diff
 class ESEMarksInputSerializer(serializers.Serializer):
     ese_marks = serializers.DecimalField(max_digits=6, decimal_places=2)
+    attempt_type = serializers.ChoiceField(
+        choices=ExamAttemptTypeEnum.choices,
+        required=False,
+        default='Regular',
+    )
```

---

## Summary of Files Changed

| File | Type | Changes |
|------|------|---------|
| [models.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/models.py) | Backend | Fix `ResultSheet.compute()` grand total formula |
| [signals.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/signals.py) | Backend | Already correct — no changes |
| [views.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/views.py) | Backend | Unify `enter_ese` with ExamAttempts; add `reset_for_reattempt` and `batch_reset` |
| [serializers.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/serializers.py) | Backend | Add `attempt_type` to ESEMarksInputSerializer |
| [tests.py](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_marks/core/tests.py) | Backend | Fix expected grand total values |
| [api.js](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_frontend/src/api.js) | Frontend | Add `resetForReattempt`, `batchReset` |
| [CourseDetail.jsx](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_frontend/src/pages/CourseDetail.jsx) | Frontend | Wire ESE attempt type; add reset UI; add attempt history; remove dead IA attempt selector |
| [AdminPanel.jsx](file:///e:/newestjlu%20gma%20draft%205%20bro/draft-5/jlu_frontend/src/pages/AdminPanel.jsx) | Frontend | Auto-suggest faculty IDs |

---

## Verification Plan

### Automated Tests
1. Run `python manage.py test core --verbosity=2` — verify the fixed grand total test passes
2. Verify existing signal tests still pass with the corrected formula

### Manual Verification
1. **Grand Total**: Enter IA marks + ESE marks for a student, verify grand_total = int_total + (ese_marks × ese_weightage/100)
2. **ESE → ExamAttempt Unity**: Enter ESE via the ESE tab, then check the Exam Attempts tab — a corresponding ExamAttempt record should appear
3. **Marks Reset Flow**: Mark a student as failed → click "Reset & Re-register" → verify ESE marks zeroed, new Scheduled attempt created, old attempt preserved in history
4. **Batch Reset**: Use the batch button to reset multiple failed students at once
5. **Faculty Auto-ID**: Open Add Faculty modal, verify IDs are pre-filled
6. **Attempt Type**: Select "Backlog" in ESE tab, save marks — verify the ExamAttempt record has `attempt_type=Backlog`
