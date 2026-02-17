# Phase 26: Health Schedule Type - Research

**Researched:** 2026-02-17
**Domain:** React form state management, database migrations, schedule type refactoring
**Confidence:** HIGH

## Summary

Phase 26 replaces the "weighing" schedule type with a unified "health" schedule type that supports sub-types aligned with the existing health logging system. This involves database schema changes, backend validation updates, React form UI enhancements, and completion flow integration with the Health Log page.

The primary challenge is maintaining backward compatibility while migrating existing "weighing" schedules to "health" schedules with appropriate sub-types. The solution follows established patterns: Food Category selector on feeding schedules, conditional rendering in ScheduleForm.jsx, and pre-fill navigation to logging pages.

**Primary recommendation:** Follow the feeding schedule Food Category pattern for health sub-type selection. Add `health_subtype` and `measurement_type` columns to schedules table, migrate data with SQL UPDATE statements, update backend validation to handle new fields, and enhance ScheduleForm.jsx with conditional sub-selectors.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Hook Form | 7.x | Form state management | Already used in ScheduleForm.jsx and HealthLog.jsx |
| Zod | 3.x | Schema validation | Already used for health log validation |
| React Router | 6.x | Navigation with state | Already used for pre-fill navigation |
| Alembic | Current | Database migrations | Project standard for schema changes |
| SQLAlchemy | 2.x | ORM and query building | Project standard for backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Shadcn/ui Select | Current | Dropdown components | Sub-type selectors (already used) |
| Axios | Current | API requests | Health log creation, instance completion |

### Alternatives Considered
None - all patterns already established in codebase.

**Installation:**
No new dependencies required.

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── migrations/versions/
│   └── 0102_health_schedule_refactor.py  # Schema changes + data migration
├── app/
│   ├── models.py                          # Add health_subtype, measurement_type columns
│   ├── schemas.py                         # Validation schemas
│   └── routers/
│       ├── schedules.py                   # Update create/update validation
│       └── health.py                      # Add bathing record_type support
frontend/src/
├── pages/
│   ├── ScheduleForm.jsx                   # Health sub-type selectors
│   └── HealthLog.jsx                      # Add bathing to record_type options
└── components/
    └── ScheduleInstanceDetail.jsx         # Shedding check prompt modal
```

### Pattern 1: Conditional Form Rendering (Food Category Pattern)

**What:** Schedule form shows different sub-selectors based on main schedule type selection

**When to use:** When a schedule type has multiple sub-categories that affect logging behavior

**Example from ScheduleForm.jsx (lines 621-648):**
```jsx
{scheduleType === "feeding" && (
  <Card>
    <CardHeader>
      <CardTitle>Food Category</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Label htmlFor="foodCategory">Food Category</Label>
        <Select value={foodCategory} onValueChange={setFoodCategory}>
          <SelectTrigger id="foodCategory">
            <SelectValue placeholder="Not specified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Not specified</SelectItem>
            <SelectItem value="insects">Insects/Worms</SelectItem>
            <SelectItem value="salad">Salad/Vegetables</SelectItem>
            {/* ... more options */}
          </SelectContent>
        </Select>
      </div>
    </CardContent>
  </Card>
)}
```

**Apply to Phase 26:**
```jsx
{scheduleType === "health" && (
  <Card>
    <CardHeader>
      <CardTitle>Health Activity Type</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Label htmlFor="healthSubtype">Health Activity Type</Label>
        <Select value={healthSubtype} onValueChange={setHealthSubtype}>
          <SelectTrigger id="healthSubtype">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weight">Weight</SelectItem>
            <SelectItem value="measurement">Measurement</SelectItem>
            <SelectItem value="shedding_check">Shedding Check</SelectItem>
            <SelectItem value="brumation_check">Brumation Check</SelectItem>
            <SelectItem value="health_record">Health Record</SelectItem>
            <SelectItem value="bathing">Bathing</SelectItem>
          </SelectContent>
        </Select>

        {/* Conditional sub-selector for Measurement */}
        {healthSubtype === "measurement" && (
          <div className="space-y-2">
            <Label htmlFor="measurementType">Measurement Type</Label>
            <Select value={measurementType} onValueChange={setMeasurementType}>
              <SelectTrigger id="measurementType">
                <SelectValue placeholder="Select measurement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="svl">Snout-Vent Length (SVL)</SelectItem>
                <SelectItem value="total_length">Total Length</SelectItem>
                <SelectItem value="humidity">Humidity</SelectItem>
                <SelectItem value="temperature">Temperature</SelectItem>
                <SelectItem value="shell_length">Shell Length</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Conditional sub-selector for Health Record */}
        {healthSubtype === "health_record" && (
          <div className="space-y-2">
            <Label htmlFor="healthRecordType">Record Type</Label>
            <Select value={healthRecordType} onValueChange={setHealthRecordType}>
              <SelectTrigger id="healthRecordType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medication">Medication</SelectItem>
                <SelectItem value="observation">Observation</SelectItem>
                <SelectItem value="vet_visit">Vet Visit</SelectItem>
                <SelectItem value="bowel_movement">Bowel Movement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

### Pattern 2: Pre-fill Navigation to Logging Page

**What:** Completion of a schedule instance navigates to the appropriate log page with pre-filled fields

**When to use:** When completing a schedule should immediately prompt user to log the activity

**Example from HealthLog.jsx (lines 224-260):**
```jsx
// Check for instance_id or schedule_id in query params to pre-fill
const instanceId = searchParams.get('instance_id');
const scheduleId = searchParams.get('schedule_id');
const logTypeParam = searchParams.get('log_type');

if (instanceId) {
  try {
    const instanceRes = await axios.get(`/api/schedule-instances/${instanceId}`);
    const instance = instanceRes.data;
    const schedule = instance.schedule;

    // Pre-fill reptile from schedule
    if (schedule?.reptile_id) {
      form.setValue('reptile_id', schedule.reptile_id);
    }

    // Pre-fill date from instance
    if (instance.scheduled_date) {
      form.setValue('log_date', instance.scheduled_date);
    }

    // Pre-fill time from schedule
    if (schedule?.reminder_time || (schedule?.time_window_enabled && schedule?.earliest_time)) {
      const timeStr = schedule.reminder_time || schedule.earliest_time;
      form.setValue('log_time', timeStr);
    }

    // Pre-fill log type if specified in URL or from schedule
    if (logTypeParam) {
      form.setValue('log_type', logTypeParam);
    } else if (schedule?.health_category) {
      // Map health category to record type if applicable
      form.setValue('record_type', schedule.health_category);
    }
  } catch (instanceErr) {
    console.error('Failed to load instance for pre-fill:', instanceErr);
  }
}
```

**Apply to Phase 26:**
Navigation will be:
- Weight sub-type → `/health-log?instance_id=X&log_type=weight`
- Measurement sub-type → `/health-log?instance_id=X&log_type=measurement&measurement_type=Y`
- Shedding Check → Custom modal flow (see Pattern 3)
- Brumation Check → `/health-log?instance_id=X&log_type=brumation`
- Health Record → `/health-log?instance_id=X&log_type=health&record_type=Y`
- Bathing → `/health-log?instance_id=X&log_type=health&record_type=bathing`

### Pattern 3: Modal Confirmation Flow

**What:** Interactive prompt before completing a schedule instance

**When to use:** When completion requires user decision that affects logging (e.g., "Is reptile shedding?")

**Implementation approach:**
```jsx
// In ScheduleInstanceDetail.jsx or new SheddingCheckModal.jsx
const handleSheddingCheckComplete = async (instanceId, reptileId, reptileName) => {
  // Show modal
  const result = await showModal({
    title: `Shedding Check for ${reptileName}`,
    message: `Is ${reptileName} showing signs of shedding?`,
    buttons: [
      { label: 'Yes', value: 'yes', variant: 'default' },
      { label: 'No', value: 'no', variant: 'outline' },
      { label: 'Cancel', value: 'cancel', variant: 'ghost' }
    ]
  });

  if (result === 'cancel') {
    return; // Do nothing
  }

  if (result === 'yes') {
    // Navigate to health log with shedding start pre-filled
    navigate(`/health-log?instance_id=${instanceId}&log_type=shedding&event_subtype=start`);
  } else {
    // Just mark instance as complete without logging
    await axios.post(`/api/schedule-instances/${instanceId}/complete`, {
      skip_logging: true
    });
    // Refresh instance list or show success message
  }
};
```

### Pattern 4: Database Migration with Data Transformation

**What:** Add new columns, migrate existing data, then enforce constraints

**When to use:** When refactoring schedule types that have existing data

**Migration structure (Alembic):**
```python
def upgrade() -> None:
    # Step 1: Add new columns (nullable)
    op.add_column('schedules', sa.Column('health_subtype', sa.String(), nullable=True))
    op.add_column('schedules', sa.Column('measurement_type', sa.String(), nullable=True))

    # Step 2: Migrate existing data
    # Weighing schedules with health_category='weight_check' → health_subtype='weight'
    op.execute("""
        UPDATE schedules
        SET health_subtype = 'weight'
        WHERE schedule_type = 'weighing'
          AND (health_category = 'weight_check' OR health_category IS NULL)
    """)

    # Weighing schedules with health_category='bathing' → health_subtype='bathing'
    op.execute("""
        UPDATE schedules
        SET health_subtype = 'bathing'
        WHERE schedule_type = 'weighing' AND health_category = 'bathing'
    """)

    # Weighing schedules with health_category='shedding_check' → health_subtype='shedding_check'
    op.execute("""
        UPDATE schedules
        SET health_subtype = 'shedding_check'
        WHERE schedule_type = 'weighing' AND health_category = 'shedding_check'
    """)

    # Weighing schedules with health_category='health_inspection' → health_subtype='health_record'
    op.execute("""
        UPDATE schedules
        SET health_subtype = 'health_record'
        WHERE schedule_type = 'weighing' AND health_category = 'health_inspection'
    """)

    # Step 3: Rename schedule_type from 'weighing' to 'health'
    op.execute("""
        UPDATE schedules
        SET schedule_type = 'health'
        WHERE schedule_type = 'weighing'
    """)

    # Step 4: Drop old health_category column (no longer needed)
    op.drop_column('schedules', 'health_category')

def downgrade() -> None:
    # Reverse migration: add health_category back, migrate data, drop new columns
    op.add_column('schedules', sa.Column('health_category', sa.String(), nullable=True))

    # Map health_subtype back to health_category
    op.execute("""
        UPDATE schedules
        SET health_category = CASE health_subtype
            WHEN 'weight' THEN 'weight_check'
            WHEN 'bathing' THEN 'bathing'
            WHEN 'shedding_check' THEN 'shedding_check'
            WHEN 'health_record' THEN 'health_inspection'
            ELSE NULL
        END
        WHERE schedule_type = 'health'
    """)

    # Rename schedule_type back to 'weighing'
    op.execute("""
        UPDATE schedules
        SET schedule_type = 'weighing'
        WHERE schedule_type = 'health'
    """)

    op.drop_column('schedules', 'measurement_type')
    op.drop_column('schedules', 'health_subtype')
```

### Anti-Patterns to Avoid

- **Don't create separate log types for each sub-category:** Bathing should be `health` log with `record_type='bathing'`, not a new log type
- **Don't migrate data after enforcing constraints:** Add columns as nullable, migrate data, then add constraints
- **Don't use hard-coded mappings in frontend:** Backend should validate and provide field mappings via API schemas
- **Don't skip attribution:** All health log creations from schedule completion must track `logged_by_user_id`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state management | Custom onChange handlers for each field | React Hook Form (already in use) | Handles validation, dirty state, nested objects |
| Modal dialogs | Custom modal components | Shadcn/ui Dialog (project standard) | Accessible, themed, keyboard navigation |
| Database migrations | Manual SQL scripts | Alembic migrations | Version control, rollback support, team collaboration |
| URL query parameter parsing | Manual `window.location.search` parsing | `useSearchParams()` from react-router-dom | Type-safe, reactive updates |

**Key insight:** The existing codebase has well-established patterns for all Phase 26 requirements. Don't introduce new libraries or custom solutions — follow the Food Category pattern, pre-fill navigation pattern, and Alembic migration pattern.

## Common Pitfalls

### Pitfall 1: Incomplete Data Migration

**What goes wrong:** Migration adds new columns and changes schedule_type, but doesn't migrate all existing health_category values

**Why it happens:** Health_category column has 4 possible values (weight_check, bathing, shedding_check, health_inspection), but only migrating common ones leaves orphaned data

**How to avoid:**
1. Query existing data BEFORE writing migration: `SELECT DISTINCT health_category FROM schedules WHERE schedule_type = 'weighing'`
2. Write CASE statements covering all values
3. Add validation step: after migration, query for NULL health_subtype where schedule_type='health' (should be 0 rows)

**Warning signs:**
- Health schedules without sub-types appearing in UI
- "Required field" errors on existing schedules
- Notification templates failing to render for migrated schedules

### Pitfall 2: Mismatched Log Type Mapping

**What goes wrong:** Schedule completion navigates to Health Log with wrong log_type parameter (e.g., `log_type=shedding_check` instead of `log_type=shedding`)

**Why it happens:** Schedule health_subtype names don't exactly match HealthLog.jsx log_type enum

**How to avoid:**
1. Create explicit mapping in completion handler:
```javascript
const LOG_TYPE_MAPPING = {
  'weight': 'weight',
  'measurement': 'measurement',
  'shedding_check': 'shedding',  // Note: _check dropped
  'brumation_check': 'brumation', // Note: _check dropped
  'health_record': 'health',      // Note: maps to generic 'health'
  'bathing': 'health'              // Note: bathing is a health record_type
};
```
2. For bathing and health_record, include additional `record_type` parameter
3. Test each sub-type's navigation path

**Warning signs:**
- Health Log showing "Please select a reptile" despite instance_id being passed
- Log type buttons not pre-selecting correctly
- Browser console errors about unrecognized log_type

### Pitfall 3: Frontend State Desync on Schedule Edit

**What goes wrong:** User edits an existing "health" schedule, changes sub-type from "weight" to "measurement", but measurement_type field stays hidden because form state doesn't reset properly

**Why it happens:** React Hook Form doesn't clear nested conditional fields when parent selection changes

**How to avoid:**
```javascript
// In ScheduleForm.jsx, add useEffect to reset dependent fields
useEffect(() => {
  if (healthSubtype !== 'measurement') {
    setMeasurementType('');
    form.setValue('measurement_type', null);
  }
  if (healthSubtype !== 'health_record') {
    setHealthRecordType('observation'); // default
    form.setValue('health_record_type', null);
  }
}, [healthSubtype]);
```

**Warning signs:**
- Form submission includes fields that shouldn't be set (e.g., measurement_type on a weight schedule)
- Backend validation errors: "measurement_type not allowed for this health_subtype"
- Stale data persisting in form after sub-type change

### Pitfall 4: Missing Bathing Support in Backend Validation

**What goes wrong:** Frontend allows creating bathing schedules and logging bathing records, but backend rejects them with "Invalid record_type"

**Why it happens:** HealthRecord validation schema doesn't include 'bathing' in allowed record_type values

**How to avoid:**
1. Add 'bathing' to `record_type` enum in schemas.py BEFORE updating frontend
2. Update health.py router validation logic to accept 'bathing'
3. Ensure bathing records don't require event_type (unlike shedding/brumation)
4. Add backend test case for bathing record creation

**Warning signs:**
- Frontend shows bathing option but backend returns 422 Validation Error
- Bathing schedules can be created but completion fails
- Database has bathing schedules but no bathing health records

### Pitfall 5: Shedding Check Modal Doesn't Mark Instance Complete

**What goes wrong:** User clicks "No" on shedding check prompt, modal closes, but schedule instance remains pending

**Why it happens:** Modal only handles "Yes" path (navigate to log), doesn't have API call for "mark complete without logging"

**How to avoid:**
1. Implement `POST /api/schedule-instances/{id}/complete` endpoint with optional `skip_logging` flag
2. Modal "No" button calls this endpoint before closing
3. Instance status updates to "completed" with `completion_type='manual'`
4. UI refreshes to show instance as complete

**Warning signs:**
- Clicking "No" on shedding check leaves task pending indefinitely
- Same shedding check prompt appears again immediately
- Users have to manually skip instance separately

## Code Examples

Verified patterns from existing codebase:

### Health Log Pre-fill from Schedule Instance
```javascript
// Source: frontend/src/pages/HealthLog.jsx (lines 224-260)
// Demonstrates how to pre-fill form from URL query parameters
const instanceId = searchParams.get('instance_id');
if (instanceId) {
  const instanceRes = await axios.get(`/api/schedule-instances/${instanceId}`);
  const instance = instanceRes.data;
  const schedule = instance.schedule;

  if (schedule?.reptile_id) {
    form.setValue('reptile_id', schedule.reptile_id);
  }
  if (instance.scheduled_date) {
    form.setValue('log_date', instance.scheduled_date);
  }
  if (logTypeParam) {
    form.setValue('log_type', logTypeParam);
  }
}
```

### Conditional Form Rendering Based on Selection
```jsx
// Source: frontend/src/pages/ScheduleForm.jsx (lines 680-705)
// Demonstrates conditional rendering pattern for sub-selectors
{scheduleType === "weighing" && (
  <Card>
    <CardHeader>
      <CardTitle>Health Activity Type</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Label htmlFor="healthCategory">Health Activity Type</Label>
        <Select value={healthCategory} onValueChange={setHealthCategory}>
          <SelectTrigger id="healthCategory">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weight_check">Weight Check</SelectItem>
            <SelectItem value="bathing">Bathing</SelectItem>
            <SelectItem value="shedding_check">Shedding Check</SelectItem>
            <SelectItem value="health_inspection">Health Inspection</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardContent>
  </Card>
)}
```

### Database Column Addition with Data Migration
```python
# Source: backend/migrations/versions/0019_add_health_category_to_schedules.py
# Demonstrates safe column addition pattern
def upgrade() -> None:
    op.add_column('schedules', sa.Column('health_category', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('schedules', 'health_category')
```

### Backend Health Record Validation
```python
# Source: backend/app/routers/health.py (lines 90-116)
# Demonstrates validation for shedding/brumation state transitions
if record.record_type in ['shedding', 'brumation']:
    await validate_health_record_state(
        db,
        record.reptile_id,
        record.record_type,
        record.event_type
    )

new_record = HealthRecord(
    **record.model_dump(exclude={"date"}),
    date=record.date or datetime.now(timezone.utc),
    logged_by_user_id=current_user.id
)
```

### Form State Management with React Hook Form
```jsx
// Source: frontend/src/pages/HealthLog.jsx (lines 111-131)
// Demonstrates React Hook Form setup with Zod validation
const form = useForm({
  resolver: zodResolver(healthLogSchema),
  defaultValues: {
    reptile_id: 0,
    log_type: 'weight',
    log_date: new Date().toISOString().slice(0, 10),
    log_time: new Date().toTimeString().slice(0, 5),
    weight_grams: '',
    record_type: 'observation',
    title: '',
    consistency: 'normal',
    notes: '',
    event_subtype: '',
    measurement_type: '',
    measurement_value: '',
    measurement_unit: '',
    custom_label: '',
  },
  mode: 'onBlur',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate "weighing" schedule type | Unified "health" type with sub-types | Phase 26 (this phase) | Better alignment between schedules and logging |
| health_category field on schedules | health_subtype + measurement_type fields | Phase 26 (this phase) | Clearer field naming, supports nested sub-types |
| Pre-fill via health_category string match | Explicit log_type mapping with sub-selectors | Phase 26 (this phase) | Type-safe navigation, no ambiguity |
| Manual instance completion | Attribution-aware completion with streak tracking | Phase 23 (completed) | All completions credit correct user |

**Deprecated/outdated:**
- `schedule_type = 'weighing'` — replaced by `schedule_type = 'health'` with `health_subtype = 'weight'`
- `health_category` column — replaced by `health_subtype` and `measurement_type`
- Direct `record_type` matching in pre-fill logic — now uses explicit mapping

## Open Questions

1. **Should "Health Inspection" map to a specific health record type?**
   - What we know: Current `health_category='health_inspection'` exists in schedules
   - What's unclear: Does it map to `record_type='observation'` or should user choose at log time?
   - Recommendation: Map to `health_subtype='health_record'` with NO pre-filled record_type (user selects when logging)

2. **How should Brumation Check completion work?**
   - What we know: ROADMAP says "reminder to review/update brumation status"
   - What's unclear: Does it navigate to Health Log? Show modal? Just mark complete?
   - Recommendation: Navigate to `/health-log?log_type=brumation` pre-filled, user chooses start/end based on current status

3. **Should measurement_type be required when health_subtype='measurement'?**
   - What we know: Measurement schedules should specify what to measure
   - What's unclear: Can user schedule generic "measurement" and choose type at log time?
   - Recommendation: REQUIRED in schedule form (prevents ambiguity, enables better notifications)

4. **Does bathing require any special fields beyond standard health records?**
   - What we know: Bathing is a new `record_type` for HealthRecord
   - What's unclear: Should it have duration, water temperature, or other custom fields?
   - Recommendation: Phase 26 adds bathing as simple record_type with title/notes only. Custom fields can be Phase 28+ if users request.

## Sources

### Primary (HIGH confidence)
- `/apps/reptile-tracker/frontend/src/pages/ScheduleForm.jsx` - Food Category pattern, conditional rendering
- `/apps/reptile-tracker/frontend/src/pages/HealthLog.jsx` - Pre-fill navigation, log type validation
- `/apps/reptile-tracker/backend/app/models.py` - Schedule model, HealthRecord model, existing columns
- `/apps/reptile-tracker/backend/app/routers/health.py` - Health record validation, state transition logic
- `/apps/reptile-tracker/backend/migrations/versions/0019_add_health_category_to_schedules.py` - Migration pattern
- `/apps/reptile-tracker/.planning/ROADMAP.md` - Phase 26 specification, success criteria, subtype mappings
- `/apps/reptile-tracker/.planning/STATE.md` - Phase 26 assumptions clarifications

### Secondary (MEDIUM confidence)
- React Hook Form documentation (inferred from existing usage)
- Alembic migration patterns (verified via existing migrations)

### Tertiary (LOW confidence)
None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - all patterns exist in codebase with working examples
- Pitfalls: HIGH - based on known issues from similar refactors (food_category, health_category)

**Research date:** 2026-02-17
**Valid until:** 30 days (stable codebase, no fast-moving dependencies)
