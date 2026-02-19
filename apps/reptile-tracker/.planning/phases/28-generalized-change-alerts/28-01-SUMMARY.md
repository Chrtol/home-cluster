---
phase: 28-generalized-change-alerts
plan: 01
subsystem: change-alerts
tags: [database, models, migration, alerts]
dependency_graph:
  requires: [phase-24-weight-alerts]
  provides: [change-alert-infrastructure]
  affects: [notification-system, alert-tracking]
tech_stack:
  added: [ChangeAlertConfig, ChangeAlertTracking, generalized-alert-tracking]
  patterns: [polymorphic-alert-types, per-reptile-config-override, cooldown-enforcement]
key_files:
  created:
    - backend/migrations/versions/0105_add_generalized_change_alerts.py
  modified:
    - backend/app/models.py
decisions:
  - decision: "Use alert_type polymorphism instead of separate tables per alert type"
    rationale: "Enables extensible alert system without schema changes for new alert types"
    impact: "Single config/tracking table serves feeding, measurement, weight, and future alert types"
  - decision: "Preserve WeightAlertTracking table during migration"
    rationale: "Maintains backward compatibility during transition period"
    impact: "Both old and new tracking systems coexist until weight alerts migrated to new system"
  - decision: "Migrate existing weight alert data to new tables"
    rationale: "Ensures continuity of cooldown tracking when transitioning to new system"
    impact: "No alert spam when migrating existing reptile weight alerts"
metrics:
  duration: "5m 37s"
  tasks_completed: 3
  files_modified: 2
  completed_at: "2026-02-19T21:19:05Z"
---

# Phase 28 Plan 01: Database Models for Generalized Change Alerts

**One-liner:** Polymorphic alert config/tracking tables with global defaults for feeding trends and measurement growth alerts.

## Overview

Established database foundation for generalized change alert system that extends the existing weight alert infrastructure to support multiple alert types (feeding trends, measurement growth) with shared cooldown and threshold patterns.

## Tasks Completed

### Task 1: Add ChangeAlertConfig and ChangeAlertTracking models
**Commit:** a844a1a40
**Files:** backend/app/models.py

Added two new SQLAlchemy models:

1. **ChangeAlertConfig** - Per-reptile alert configuration with polymorphic alert_type:
   - Common fields: enabled, cooldown_days (NULL = inherit global), threshold_type, threshold_increase, threshold_decrease
   - Feeding-specific: window_days (comparison time window)
   - Measurement-specific: rolling_average_window (number of measurements to average)
   - Unique constraint on (reptile_id, alert_type)
   - Composite index for efficient lookups

2. **ChangeAlertTracking** - Cooldown tracking per reptile per alert type:
   - Fields: reptile_id, alert_type, last_alert_at, last_alert_context (JSON)
   - Unique constraint on (reptile_id, alert_type)
   - Extends pattern from WeightAlertTracking but supports multiple types

### Task 2: Add global alert settings to NotificationSettings
**Commit:** c42e65301
**Files:** backend/app/models.py

Added global default fields for new alert types:

**Feeding alerts:**
- feeding_alert_enabled (default: false)
- feeding_alert_window_days (default: 14)
- feeding_alert_threshold_percent (default: 30)
- feeding_alert_cooldown_days (default: 7)

**Measurement alerts:**
- measurement_alert_enabled (default: false)
- measurement_alert_rolling_window (default: 3)
- measurement_alert_threshold_percent (default: 10)
- measurement_alert_cooldown_days (default: 14)
- measurement_alert_types (JSON array, e.g., ["svl", "total_length"])

### Task 3: Create Alembic migration for generalized alerts
**Commit:** ec19d0cb5
**Files:** backend/migrations/versions/0105_add_generalized_change_alerts.py

Created migration 0105 with:
- change_alert_configs table creation with indexes
- change_alert_tracking table creation with indexes
- NotificationSettings column additions with defaults
- Data migration from weight_alert_tracking to change_alert_tracking (alert_type='weight')
- Data migration from reptiles.weight_alert_* columns to change_alert_configs
- Preserved WeightAlertTracking table for backward compatibility

Applied successfully to development database (version 0105).

## Verification Results

All verification criteria passed:

1. ✓ ChangeAlertConfig and ChangeAlertTracking models exist and import successfully
2. ✓ NotificationSettings has feeding_alert_* and measurement_alert_* fields
3. ✓ Alembic migration completed successfully (current: 0105, head)
4. ✓ Tables exist in database (change_alert_configs, change_alert_tracking)
5. ✓ All columns have correct types and constraints
6. ✓ Existing weight alert tracking data preserved (migration logic verified)

## Success Criteria Met

- [x] ChangeAlertConfig model stores per-reptile settings with alert_type polymorphism
- [x] ChangeAlertTracking model stores cooldown tracking with alert_type polymorphism
- [x] NotificationSettings has global defaults for feeding and measurement alerts
- [x] Migration preserves existing WeightAlertTracking data
- [x] Models can be imported without errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing Alembic template file**
- **Found during:** Task 3
- **Issue:** Alembic autogenerate failed with "FileNotFoundError: migrations/script.py.mako"
- **Fix:** Created migration manually following existing migration pattern (numbered migrations with helper functions)
- **Files modified:** backend/migrations/versions/0105_add_generalized_change_alerts.py
- **Commit:** ec19d0cb5

**2. [Rule 3 - Blocking] Migration file not visible in container**
- **Found during:** Task 3
- **Issue:** Docker volume only mounts backend/app, not backend/migrations directory
- **Fix:** Used docker cp to copy migration file into running container
- **Verification:** Migration applied successfully via alembic upgrade head

## Database Schema Changes

### New Tables

**change_alert_configs:**
```sql
CREATE TABLE change_alert_configs (
    id SERIAL PRIMARY KEY,
    reptile_id INTEGER NOT NULL REFERENCES reptiles(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    cooldown_days INTEGER,
    threshold_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
    threshold_increase FLOAT,
    threshold_decrease FLOAT,
    window_days INTEGER,
    rolling_average_window INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(reptile_id, alert_type)
);
CREATE INDEX ix_change_alert_config_lookup ON change_alert_configs(reptile_id, alert_type);
```

**change_alert_tracking:**
```sql
CREATE TABLE change_alert_tracking (
    id SERIAL PRIMARY KEY,
    reptile_id INTEGER NOT NULL REFERENCES reptiles(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    last_alert_at TIMESTAMP WITH TIME ZONE,
    last_alert_context JSON,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(reptile_id, alert_type)
);
CREATE INDEX ix_change_alert_tracking_lookup ON change_alert_tracking(reptile_id, alert_type);
```

### Modified Tables

**notification_settings:** Added 9 new columns for feeding and measurement alert defaults (all with appropriate defaults)

## Technical Notes

### Polymorphic Alert Type Pattern

The alert_type field enables a single table to serve multiple alert categories:
- "weight" - Weight change alerts (existing, migrated from WeightAlertTracking)
- "feeding" - Feeding frequency/trend alerts
- "measurement_svl" - SVL measurement growth alerts
- "measurement_total_length" - Total length measurement growth alerts
- Future: Any new alert type without schema changes

### Per-Reptile Override Pattern

ChangeAlertConfig.cooldown_days = NULL means "inherit global setting from NotificationSettings". This follows the existing pattern from Reptile.weight_alert_cooldown_days.

### Migration Data Preservation

Migration 0105 includes SQL to:
1. Copy all weight_alert_tracking records to change_alert_tracking with alert_type='weight'
2. Create change_alert_configs records for reptiles with non-default weight alert settings
3. Uses ON CONFLICT DO NOTHING to be idempotent

## Next Steps

**For Plan 02 (Feeding Alerts):**
- Implement feeding frequency calculation (compare current vs. baseline window)
- Create scheduler job to check feeding trends
- Add notification templates for feeding alerts

**For Plan 03 (Measurement Alerts):**
- Implement measurement growth calculation (rolling average baseline)
- Create scheduler job to check measurement trends
- Add notification templates for measurement alerts

**For Future Enhancement:**
- Migrate weight_alerts.py to use ChangeAlertConfig/ChangeAlertTracking
- Deprecate WeightAlertTracking table after migration complete
- Add UI for configuring feeding/measurement alerts per reptile

## Self-Check: PASSED

**Created files exist:**
- ✓ backend/migrations/versions/0105_add_generalized_change_alerts.py

**Modified files have changes:**
- ✓ backend/app/models.py (ChangeAlertConfig, ChangeAlertTracking, NotificationSettings fields)

**Commits exist:**
- ✓ a844a1a40: Task 1 (ChangeAlertConfig and ChangeAlertTracking models)
- ✓ c42e65301: Task 2 (NotificationSettings global defaults)
- ✓ ec19d0cb5: Task 3 (Migration 0105)

**Database state:**
- ✓ Tables created: change_alert_configs, change_alert_tracking
- ✓ Columns added: 9 new columns in notification_settings
- ✓ Migration version: 0105 (head)

---

**Plan Status:** Complete
**Duration:** 5 minutes 37 seconds
**Tasks:** 3/3 completed
**Commits:** 3 (all task-scoped)
**Database:** Migration 0105 applied successfully
