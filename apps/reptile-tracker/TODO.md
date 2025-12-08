# Reptile Tracker - Todo List

## 🔄 Future Improvements

- [ ] **Persist auto-complete jobs to database** - Similar to notification reminders for better reliability
  - Add job_type enum to ScheduledNotificationJob (or create separate table)
  - Create auto-complete job scheduling function (~100 lines)
  - Modify daily maintenance to schedule auto-complete jobs for next 7-14 days
  - Create job execution function (~50 lines)
  - Update rebuild function to also rebuild auto-complete jobs (~30 lines)
  - Estimated: ~200-300 lines of code + 1 migration + testing
  - **Current solution works fine** (5-minute check interval with startup check)
  - Only implement if sub-minute precision needed or very frequent pod restarts

## 🚀 NEXT UP - Tier 1 Priorities

1. **Statistics Page Phase 2** - Health analytics (shed tracking, weight change rate, timeline) (see [📊 Statistics & Analytics](#-statistics--analytics))
2. **Advanced Notification Features** - Notification grouping, snooze, per-reptile preferences, email notifications (see [🔔 Notifications & Reminders](#notifications--reminders))
3. **Live Feeder Animal Care** - Track feeder insect colonies, gut loading schedules, hydration (see [🔧 Core Features](#-core-features))

---

## 🎯 High Priority

### 🔔 Notifications & Reminders
- [x] **Basic notification system** - ✅ COMPLETED (2025-12-04)
  - Per-schedule notification channel selection
  - Household-wide and personal channels
  - Visual bell icons in calendar views showing notification status
  - Test notification functionality with sample data
  - Support for Discord, Pushover, and Generic webhooks
  - Automatic schedule reminders and overdue alerts

- [x] **Notification template customization** - ✅ COMPLETED (2025-12-04)
  - Allow users to customize notification message templates
  - Template variables: reptile_name, schedule_name, schedule_type, food_category, supplement_name, time_window, notes
  - Different templates for reminders vs overdue alerts
  - Per-channel template overrides (e.g., shorter messages for Pushover)
  - Backend: Template copy endpoint in notification_templates.py
  - Frontend: Template editor in Settings > Templates tab with variable insertion

- [x] **Priority-based template matching** - ✅ COMPLETED (2025-12-08)
  - Create multiple templates per trigger type with automatic selection based on specificity
  - Filter templates by specific reptiles, schedules, schedule types, or food categories
  - Priority scoring ensures most specific template is always used (schedule > reptile > food category > schedule type > generic)
  - Database: Migration 0070 added filter columns to notification_templates table
  - Backend: New template matching algorithm with 6-level specificity scoring
  - Frontend: Filter form fields in template creation/edit with visual priority explanation

- [x] **Custom template groups** - ✅ COMPLETED (2025-12-08)
  - Organize templates into user-defined collections (e.g., "Luna's Templates", "Critical Alerts")
  - Group-level settings apply to all templates in the group:
    - **enabled**: Master on/off switch for entire group
    - **default_priority**: Modifier added to all template priorities (can be negative for higher priority)
    - **ignore_quiet_hours**: Bypass quiet hours for critical alert groups
    - **default_channel_ids**: Default notification channels for group
  - Visual group badges on templates with custom colors
  - Database: Migration 0071 created template_groups table and group_id column
  - Backend: Complete CRUD API at /api/template-groups/
  - Frontend: Group management modal with full CRUD, color picker, icons, and settings
  - Frontend: Collapsible help section explaining template matching priority system

- [ ] **Advanced notification features** - 🎯 HIGH PRIORITY
  - Notification grouping/digest (combine multiple reminders into single message)
  - Snooze functionality for reminders (15min, 30min, 1hr, 2hr options)
  - Per-reptile notification preferences (different channels per reptile)
  - Email notifications as alternative to webhooks
  - Notification history for external channels (log sent notifications)
  - Notification delivery reports (sent, failed, retried)

### Authentication & Session Management
- [x] **Fix session timeout issues** - ✅ COMPLETED - Sessions expire too quickly, shows blank pages instead of redirect
  - Should immediately redirect to login when session expires
  - Increase session timeout to minimum 24 hours
  - Backend: Check JWT token expiration settings
  - Frontend: Add session expiration detection and auto-redirect

### User Experience
- [x] **Dark mode improvements** - ✅ COMPLETED
  - Make dark mode the default
  - Apply dark mode to login page
  - Change login button text from "Login with authentik" to "Login with single sign-on"

- [x] **New user onboarding wizard** - ✅ COMPLETED
  - Option 1: Paste code to join existing household
  - Option 2: Create new household
  - Mandatory before accessing app
  - Beautiful two-option interface

- [ ] **Dashboard card improvements and optimization** - 🔧 MEDIUM PRIORITY
  - Audit existing dashboard cards for usefulness and relevance
  - Identify which cards provide the most value vs. which are redundant
  - Consider removing or redesigning less useful cards
  - Potential new card ideas:
    - Upcoming schedules (next 3-7 days preview)
    - Reptile health score/status indicators
    - Quick actions (one-click feeding/misting for common tasks)
    - Feeding cost tracking summary (if prices are tracked)
    - Temperature/humidity trends (if environmental logging is added)
  - Improve existing valuable cards:
    - Better data visualization
    - More actionable information
    - Clearer hierarchy and layout
  - User feedback: Some cards are "kind of useless"
  - Goal: Every card should provide clear value or quick actions

### Food & Supplement Management
- [x] **Food Management Page** - ✅ COMPLETED
  - Create/edit/delete food items
  - Manage nutritional values
- [x] **Extend to Supplements** - ✅ COMPLETED
  - Added supplements tab to Food Management page
  - Full CRUD operations for supplements
  - Nutritional data fields: Calcium (mg), Vitamin D3 (IU), Vitamin A (IU), Notes
  - Default supplement protection with force delete option
  - Common supplements: Calcium, Calcium with D3, Multivitamins
- [x] **Add frozen/dead animal food category** - ✅ COMPLETED
  - New category for frozen rodents (mice, rats, etc.)
  - For snakes and larger lizards
  - Track size (pinky, fuzzy, adult, etc.)
  - Added multiple categories: frozen_animal, live_rodent, fish_seafood, eggs, other
  - Added AnimalSize enum for tracking sizes (pinky, fuzzy, hopper, weaner, adult_small, etc.)

### Live Feeder Animal Care - 🎯 HIGH PRIORITY
- [ ] **Feeder colony inventory tracking**
  - Track live feeder insect colonies (crickets, dubia roaches, mealworms, hornworms, etc.)
  - Inventory management: current count, breeding colony size
  - Size tracking (small, medium, large) for growth progression
  - Purchase history and cost tracking
  - Mortality/die-off rate monitoring

- [ ] **Gut loading schedules and tracking**
  - Define gut loading schedules for different feeder types
  - Track what feeders are fed (fresh vegetables, commercial gut load, etc.)
  - Schedule reminders for gut loading before feeding reptiles
  - Best practices per feeder type (e.g., crickets need 24-48h gut loading)
  - Log gut loading completion

- [ ] **Hydration maintenance**
  - Water crystal schedules (when to add/replace)
  - Alternative hydration methods (fresh veggies, water gel, etc.)
  - Humidity requirements for specific feeder species
  - Reminder system for hydration tasks

- [ ] **Feeder breeding management** (Optional)
  - Track breeding colonies separately from feeder colonies
  - Egg/larvae production tracking
  - Growth cycle monitoring (egg → larvae → pupae → adult for beetles)
  - Breeding success rate

- [ ] **Integration with feeding logs**
  - Link feeder inventory to feeding events
  - Auto-decrement inventory when logging feedings
  - Alert when feeder stock is running low
  - Suggest purchase timing based on usage patterns

- [ ] **Implementation notes**
  - Database: `feeder_colonies` table (household_id, species, type, count, last_gut_loaded, last_hydrated)
  - Database: `gut_loading_schedules` table (feeder_type, food_type, frequency, notes)
  - Backend: CRUD endpoints for feeder management
  - Frontend: Feeder Management page (similar to Food Management)
  - Frontend: Gut loading log page
  - Frontend: Low stock alerts on dashboard

## 🔧 Core Features

### Reptile Management
- [x] **Species dropdown with free-text** - ✅ COMPLETED
  - Backend: GET /api/reptiles/species endpoint returns unique species list
  - Frontend: Custom autocomplete dropdown with filtering
  - Frontend: Free-text entry for new species supported
  - Backend: New species automatically added via existing POST endpoint

### Health & Weight Logging
- [x] **Enhanced health logging UI** - ✅ COMPLETED
  - Unified "Track" button with dropdown for Feeding and Health logging
  - Desktop: Gradient button with elegant dropdown menu
  - Mobile: Floating circular button in center of bottom nav with popup
  - Added shedding log type
  - Added bowel movement log type with consistency field (normal, soft, hard, watery, mucus)
  - Database migration and backend ready for photo upload capability (frontend deferred)
  - Improved UI organization with better styling and dark mode support
  - Record types: General Observation, Shedding, Bowel Movement, Vet Visit, Medication

- [ ] **Photo Upload & Gallery** - 🎯 HIGH PRIORITY (Tier 2)
  - Upload photos for health records, feedings, weight checks, shedding
  - Photo gallery per reptile sorted by date and event type
  - Before/after shed comparison view
  - Growth timeline with photo progression
  - Visual health tracking (scale rot, stuck shed, injuries)
  - Thumbnail previews in activity logs
  - Full-size photo viewer with zoom
  - Multiple photos per event
  - Implementation:
    - Backend: File upload endpoint with image validation and compression
    - Storage: S3-compatible or local file storage with path references
    - Database: health_records.photo_url already exists, extend to multiple photos
    - Database: feeding_logs, weight_logs, misting_logs photo support
    - Frontend: Image upload component with drag-drop
    - Frontend: Photo gallery page per reptile
    - Frontend: Lightbox viewer for full-size images

### Humidity & Environment
- [x] **Misting logs** - ✅ COMPLETED
  - Backend: Created misting_logs table with migration
  - Backend: Full CRUD API endpoints at /api/misting
  - Frontend: MistingLog page with date/time picker
  - Frontend: Added to Track button dropdown (desktop & mobile)
  - Note: "Last Misted" dashboard display still pending

- [ ] **Environmental Data Tracking** - 🔧 MEDIUM PRIORITY (Tier 3)
  - **Temperature & humidity logging:**
    - Basking spot temperature (high temp area)
    - Cool side temperature (low temp area)
    - Ambient temperature
    - Humidity percentage
    - Time-based logging (morning/evening checks)
  - **Equipment tracking:**
    - UVB bulb installation date and wattage
    - UVB bulb age tracking with replacement reminders (6-12 months)
    - Heat lamp types and replacement tracking
    - Thermostat settings and adjustments
  - **Species-specific ideal ranges:**
    - Display recommended temp/humidity ranges per species
    - Visual indicators when readings are out of range
    - Dashboard widget showing current conditions
  - **Historical trends:**
    - Temperature/humidity graphs over time
    - Seasonal variation tracking
    - Correlation with health events
  - **Future: IoT sensor integration**
    - Optional integration with smart sensors
    - Automatic logging from connected devices
    - Real-time alerts for critical conditions
  - **Implementation:**
    - Database: `environmental_logs` table (reptile_id, log_date, basking_temp, cool_temp, humidity, notes)
    - Database: `equipment` table (reptile_id, equipment_type, install_date, replacement_due, notes)
    - Database: `species_environmental_ranges` table (species, min_basking, max_basking, min_cool, etc.)
    - Backend: CRUD endpoints for environmental logs and equipment
    - Frontend: Environmental logging page (similar to misting logs)
    - Frontend: Equipment management page
    - Frontend: Dashboard environmental widget

### Dashboard Enhancements
- [x] **Add more reptile info cards** - ✅ COMPLETED
  - Added last misting, last shed, and last feeding to reptile cards
  - Shows days since each event with color-coded icons
  - Added summary cards: Need Feeding, Fed This Week, Misted Today, Shed This Month
  - 4-column grid layout on desktop, 2 columns on mobile
  - Improved visual structure and readability

## 📅 Calendar & Scheduling

### Calendar Page
- [x] **Functional calendar with multiple views** - ✅ COMPLETED
  - Backend: Schedule model created (0009 migration)
  - Backend: Basic schedule support (schedule_type, frequency_days)
  - Frontend: Calendar component with Month/Week/Day views
  - Views: Monthly (default), Weekly, Daily with navigation
  - Display past events: feedings, misting, weigh-ins, health records
  - Clickable completed events link to detail pages
  - Mobile-responsive design

- [x] **Calendar filtering by reptile** - ✅ COMPLETED
  - Filter controls to show/hide schedules per reptile ✅
  - All reptiles shown by default ✅
  - Toggle buttons for each reptile (inline with header) ✅
  - Filter state persisted in localStorage ✅
  - Visual indicator showing which reptiles are filtered ✅
  - Apply filters to both scheduled events and completed activities ✅
  - Improved calendar UI with colored squares for events ✅
  - Click-to-expand modal for day details ✅
  - Legend inline with view switcher ✅

- [x] **Calendar filtering by activity category** - ✅ COMPLETED (2025-01-22)
  - Filter buttons for Feeding, Misting, Health, and Supplement activities
  - Placed between title and action buttons for vertical space savings
  - Category state persisted in localStorage
  - All categories visible by default
  - Visual indicators showing active/inactive filters
  - Compact layout matching reptile filters design

- [x] **Schedule time windows** - ✅ COMPLETED (2025-01-16)
  - Backend: Added `earliest_time`, `latest_time`, `time_window_enabled`, `reminder_minutes_before` to Schedule model
  - Backend: Created `schedule_completions` table to track individual occurrences
  - Backend: Automatic schedule matching system with scoring algorithm
  - Backend: Tracks completion status: `completed_on_time`, `completed_early`, `completed_late`, `missed`, `pending`
  - Backend: 30-minute tolerance window for flexible matching
  - Backend: Integrated into feeding, misting, and weight log routers
  - Frontend: Custom time pickers respecting user format preferences (12h/24h)
  - Frontend: Time window display in schedule management list
  - Frontend: Enhanced calendar modal with dashboard-style icons and colors
  - Frontend: Structured 4-column layout showing reptile, frequency, food, and time window
  - **Features:**
    - Set earliest time (when feeding window opens, e.g., after basking)
    - Set latest time (when feeding must be completed by)
    - Optional reminder minutes before deadline
    - Activities auto-assigned to matching schedules
    - Visual indicators with Clock icon throughout UI
    - Respects user time format preferences
  - **Use cases:**
    - Ensure feeding happens after basking for diurnal reptiles
    - Ensure feeding happens before lights/heat turns off
    - Critical medication timing
    - Foundation for future notification service

- [x] **Advanced scheduling system** - ✅ COMPLETED
  - Backend: Schedule model supports all advanced rules
    - Every X days ✅
    - Specific days of week (e.g., Mon, Wed, Fri) ✅
    - Monthly (specific day of month) ✅
    - Dependent schedules (e.g., supplements based on feeding schedule) ✅
  - Schedule types: feeding, misting, weighing, supplement ✅
  - Dependent scheduling rules:
    - Every occurrence of parent schedule ✅
    - Every Nth occurrence ✅
    - Specific days of week ✅
    - Once per day (first occurrence only) ✅
  - Frontend: Complete schedule creation/edit UI ✅
  - Frontend: Calendar displays calculated events ✅
  - Backend: Event calculation based on all rule types ✅
  - Backend: Supplement assignment to schedules ✅

- [x] **Schedule Templates system** - ✅ COMPLETED
  - Backend: ScheduleTemplate model with species/age filtering
  - Backend: Full CRUD API at /api/schedule-templates
  - Backend: Template duplication and application to reptiles
  - Backend: Export/import templates as JSON
  - Backend: Seeded ReptiFiles-curated templates for common species
  - Frontend: Complete ScheduleTemplates.jsx page
  - Frontend: Browse templates grouped by species and source
  - Frontend: Filter templates by reptile to show matches
  - Frontend: Apply multiple templates at once with customization
  - Frontend: Edit, duplicate, and delete templates
  - Frontend: Export/import functionality
  - Frontend: Integration with supplement rotation templates

- [ ] **Requirement-based Schedules** - 🎯 HIGH PRIORITY
  - New schedule type: "Requirement" mode (alongside existing "Fixed" mode)
  - Define feeding requirements instead of rigid calendar dates:
    - Frequency per week (e.g., 2x per week)
    - Minimum days between feedings (e.g., 2 days)
    - Maximum days between feedings (e.g., 4 days, optional)
    - Optional suggested days for soft reminders (e.g., Wed, Sun)
  - **Problem solved:** Current system marks schedules as "missed" even when feeding happened on different days
  - **Use case:** Leopard gecko needs 2 feedings/week with 2+ days between, but exact days (Mon/Thu vs Wed/Sun) don't matter
  - **Features:**
    - Weekly quota tracking: "2/2 feedings this week ✓" instead of instance-based completion
    - Validation: prevent over-feeding (warn if trying to feed too soon based on min_days_between)
    - Calendar display: weekly progress indicator, suggested days shown with dashed borders
    - Notifications: remind on suggested days if quota not met, or remind if approaching max_days_between
    - No "missed" status - only "requirement not met this week"
    - Any feeding automatically checks requirement schedules and increments counters
  - **Database changes:**
    - Add to schedules table: schedule_mode ('fixed' or 'requirement'), frequency_per_week, min_days_between, max_days_between, suggested_days (JSON array)
    - New completion tracking: weekly counters instead of instances for requirement schedules
  - **Backend changes:**
    - Modified schedule matching logic for requirement schedules
    - Weekly quota tracking and reset system
    - Validation logic for min/max days between feedings
    - Updated notifications for quota-based reminders
  - **Frontend changes:**
    - Schedule form: radio toggle between "Fixed" and "Requirement" modes
    - Requirement mode fields: frequency/week input, min/max days inputs, suggested days picker
    - Calendar: weekly quota display for requirement schedules
    - Different visual treatment: dashed borders for suggested days vs solid for fixed schedules
  - **Implementation complexity:** Major feature requiring significant database, backend, and frontend changes
  - **Alternative interim solution:** Flexible completion windows (already implemented) can partially address this


## 📊 Statistics & Analytics

### Statistics Page - 🎯 CRITICAL PRIORITY (Tier 1)
**Why High Priority:** Uses existing data, high visual impact, easy to implement, medical value

- [x] **Phase 1 - Essential Charts** - ✅ COMPLETED (2025-01-15)
  - Weight growth chart combined with feeding data (dual-axis)
  - Weight data interpolation with visual distinction
  - Feeding frequency calendar heatmap (GitHub-style)
  - Summary cards: weight change, feeding count, misting count, health events
  - Chart library: Recharts

- [x] **Phase 1.5 - Statistics Settings & Customization** - ✅ COMPLETED
  - Full implementation in Settings > Display tab (Settings.jsx)
  - Settings stored in localStorage via utils/displaySettings.js
  - Statistics page automatically loads and applies settings

  **Implemented Features:**
  - ✅ Display tab in Settings page with comprehensive customization
  - ✅ Dashboard card management: show/hide, drag-to-reorder, resize (XS/S/M/L)
  - ✅ Statistics chart management: show/hide, drag-to-reorder, resize (XS/S/M/L)
  - ✅ Weight interpolation modes: Linear, Step, None (dots only) - per chart
  - ✅ Chart appearance settings: grid, legend, axis labels, height slider
  - ✅ Per-reptile custom statistics layouts (with global fallback)
  - ✅ Export/import all display settings as JSON
  - ✅ Reset functionality: individual sections or all settings
  - ✅ Settings persistence in localStorage
  - ✅ Native drag-and-drop (no external library needed)
  - ✅ Live preview: Statistics page updates when settings change
  - ✅ Food filtering in statistics (dropdown in weight/feeding chart)
  - ✅ Data type toggles (Weight, Feeding, Misting, Health) in Statistics page
  - ✅ Time range selector (7d, 30d, 90d, 180d, 365d, 730d) in Statistics page

  **Not Implemented (deferred to future phases):**
  - Weight units conversion (currently grams only)
  - Trend lines and moving averages
  - Heatmap intensity customization
  - Chart image export (PNG/SVG/PDF)
  - Color scheme customization

- [ ] **Phase 2 - Health Analytics** (1-2 weeks)
  - Shed frequency tracking (bar chart)
  - Health events timeline (visual timeline)
  - Weight change rate indicator (gaining/losing/stable)

- [ ] **Phase 3 - Advanced Analytics** (2-3 weeks)
  - Supplement adherence tracking (% of feedings with supplements)
  - Multi-reptile comparison charts
  - Feeding cost analysis (if prices tracked)
  - Export charts as images/PDF

- [ ] **Phase 4 - Predictive** (Future)
  - Growth predictions based on species norms
  - Next shed prediction
  - Health score algorithms

## 👥 Multi-User & Households

### Household System
- [x] **Backend: Household model** - ✅ COMPLETED
  - Create household table
  - Link users to households (many-to-many via household_members)
  - Link reptiles to households (household_id on reptiles table)
  - Backend API for household management

- [x] **Invitation system** - ✅ COMPLETED
  - Generate invitation codes/links
  - Backend: Invitation table (code, household_id, expires_at, max_uses)
  - Frontend: Invitation code input in Settings page
  - Backend: Validate and accept invitations
  - Invitation tracking (used_count, created_at)

- [x] **Household management endpoints** - ✅ COMPLETED
  - GET /api/households/me - List user's households
  - POST /api/households - Create new household
  - PUT /api/households/{id} - Update household name (owner only)
  - GET /api/households/{id}/members - List household members
  - DELETE /api/households/{id}/members/{user_id} - Remove member (owner only)
  - POST /api/households/{id}/leave - Leave household

- [x] **Invitation management endpoints** - ✅ COMPLETED
  - POST /api/invitations - Create invitation
  - POST /api/invitations/accept - Accept invitation by code
  - GET /api/invitations/household/{id} - List household invitations
  - DELETE /api/invitations/{id} - Revoke invitation (owner only)

### User Roles & Permissions
- [x] **Basic access control** - ✅ COMPLETED
  - Current roles implemented: Owner, Feeder, Viewer
  - Permission hierarchy: VIEWER (1) < FEEDER (2) < OWNER (3)
  - Backend: Role-based authorization in permissions.py
  - Household members automatically get FEEDER access to household reptiles
  - Direct access via reptile_access table still supported

- [x] **Granular access control expansion** - ✅ COMPLETED
  - Added Admin and Caretaker roles
  - Updated permissions matrix: VIEWER < CARETAKER < OWNER < ADMIN
  - Per-user role management UI in Settings > Users tab
  - Household creators automatically become admins
  - Role assignment dropdown (admin-only)

### Settings - Household Tab
- [x] **Comprehensive household management UI** - ✅ COMPLETED
  - Tabbed interface with Overview, Users, and Invitations tabs
  - Overview tab:
    - View household info (name, creation date)
    - Quick stats (member count, active invites)
    - Edit household name (admin only)
    - Create invitation button
    - Leave household button
  - Users tab:
    - Combined Members and Roles functionality
    - List all household members with count badge
    - Show name, email, role badge, join date
    - Role assignment dropdown (admin only)
    - Remove member button (admin only, cannot remove self)
    - Role permissions reference section
    - Non-admin notice
  - Invitations tab:
    - List all invitations with status (active/expired/maxed out)
    - Show invitation code, usage count, expiry date
    - Copy code/link functionality
    - Revoke invitation button (admin only)
  - Household selector dropdown for multi-household users
  - Create and join household forms integrated

### Schedule Assignment to Household Members - 🎯 HIGH PRIORITY (Tier 2)
**Complexity:** MEDIUM (1-2 weeks) | **Value:** High for multi-user households

Assign specific household members as responsible for completing schedules, improving accountability and workload distribution.

**Database Changes:**
- [ ] Migration: Add `assigned_to_user_id` column to schedules table (nullable, foreign key to users, SET NULL on delete)
- [ ] Migration: Add index on assigned_to_user_id for fast filtering
- [ ] Consider: Add `completed_by_user_id` to track who actually completed (or use existing activity logs)

**Backend Implementation:**
- [ ] Update Schedule model with `assigned_to` relationship (User model)
- [ ] Update ScheduleCreate/ScheduleUpdate schemas to include `assigned_to_user_id`
- [ ] Add ScheduleWithAssignment schema including assigned user details (name, email)
- [ ] Add filtering endpoints:
  - GET /api/schedules/assigned-to-me (current user's assigned schedules)
  - GET /api/schedules/assigned-to/{user_id} (admin only)
  - Query param: `?assigned_to={user_id}` on existing schedule list endpoints
- [ ] Validation: Ensure assigned user is member of household
- [ ] Handle edge case: User leaving household (SET NULL on assignment)
- [ ] Handle edge case: User losing reptile access (validation on assignment)

**Frontend - Schedule Management:**
- [ ] Add "Assigned To" dropdown in ScheduleForm (create/edit)
  - Options: "No one (household-wide)", current user (Me), or any household member
  - Only show household members with appropriate permissions (Caretaker+)
  - Show user name and role badge
- [ ] Display assigned user in ScheduleDetails view
  - Show avatar/initials and name
  - Show "Assigned to: [Name]" badge
  - If completed by different user, show both: "Assigned to: Alice, Completed by: Bob"
- [ ] Show assigned user in Calendar schedule list (active schedules section)
  - User initials badge next to schedule name
  - Tooltip on hover showing full name

**Frontend - Calendar & Dashboard:**
- [ ] Visual indicators in calendar views
  - Add small user initials badge on calendar events
  - Optional: Different border colors per user
  - Tooltip showing "Assigned to: [Name]"
- [ ] Add "My Schedules" filter toggle in Calendar header
  - Button: "Show My Schedules Only" vs "Show All Schedules"
  - Filter state persisted in localStorage
  - Works alongside existing reptile and category filters
- [ ] Dashboard: "My Upcoming Schedules" section
  - Card showing next 3-7 schedules assigned to current user
  - Quick links to "Log Now" for pending schedules
  - Shows time remaining until deadline

**Frontend - Assignment Management:**
- [ ] Bulk assignment interface (optional, lower priority)
  - Select multiple schedules from list
  - "Assign To" dropdown to assign all at once
  - Useful for dividing workload when setting up new schedules
- [ ] Template-level assignment
  - When applying schedule templates, option to assign all to specific user
  - "Assign these schedules to:" dropdown in apply modal
  - Simplifies bulk setup for specific caretaker

**Notifications Integration:**
- [ ] Add assignment notification option in NotificationSettings
  - Checkbox: "Notify me when a schedule is assigned to me"
  - Send in-app notification when schedule assigned/reassigned
- [ ] Add "assigned user only" notification mode
  - Per-schedule toggle: "Only notify assigned user"
  - When enabled, only assigned user receives reminders
  - Useful for preventing notification spam in large households
  - If no one assigned, notify all household members (fallback)
- [ ] Notification for non-completion (optional, lower priority)
  - If assigned user doesn't complete by deadline, notify admin/owner
  - Configurable per-schedule or globally
  - Helps identify workload issues

**Statistics & Reporting:**
- [ ] Add "Assignments" section in Settings > Household > Users tab
  - Show current assignment count per user
  - "Active Assignments This Week" count
  - Visual workload distribution (e.g., pie chart or bar graph)
- [ ] Completion rate per user (optional)
  - Track completion rate: assigned schedules vs completed on time
  - Show in household member list
  - Helps identify who needs reminders or support

**Use Cases:**
1. **Split feeding responsibilities:** Alice feeds on Mon/Wed, Bob feeds on Tue/Thu
2. **Specialized tasks:** Expert handler assigned to difficult feedings
3. **Workload visibility:** See who has too many assignments this week
4. **Accountability:** Clear responsibility for each task
5. **Targeted notifications:** Only relevant person gets reminded
6. **Training:** Assign simple tasks to new household members, complex tasks to experienced ones

**Edge Cases & Validation:**
- ✅ User leaving household: SET NULL on assigned_to_user_id (schedule becomes household-wide)
- ✅ User losing reptile access: Validate on assignment, prevent assignment to users without access
- ✅ Anyone can complete: Any household member can complete assigned schedules (flexibility)
- ✅ Assignment visibility: All members see assignments (transparency)
- ❌ Restricted completion: Don't implement "only assigned user can complete" (too restrictive)

**Implementation Priority:**
1. **Phase 1 (Core):** Database, backend API, schedule form assignment UI
2. **Phase 2 (Visibility):** Calendar indicators, "My Schedules" filter, assigned user display
3. **Phase 3 (Advanced):** Bulk assignment, notifications, workload statistics

**Estimated Effort:**
- Database & Backend: 2-3 days
- Frontend Core (Phase 1-2): 4-5 days
- Frontend Advanced (Phase 3): 3-4 days
- Testing & Edge Cases: 2 days
- **Total: 1.5-2 weeks**

### Settings - OIDC Configuration
- [ ] **OIDC settings UI** (Advanced)
  - Currently configured via environment variables
  - GUI alternative for easier setup
  - Fields: Provider URL, Client ID, Client Secret, Redirect URI
  - Backend: Store encrypted OIDC config in database
  - Security: Restrict to household owner only

## 📦 Data Management & Export

### Backup & Restore System - 🎯 HIGH PRIORITY (Tier 2)
- [ ] **Full household data export**
  - Export entire household data as single JSON/ZIP file
  - Include: household info, all reptiles, foods, supplements, schedules
  - Include: all historical data (feedings, weights, health records, mistings)
  - Include: user preferences and settings
  - Include: notification channels and templates
  - Option to export with or without photos (file size consideration)
  - Encrypted export option for sensitive data
  - Progress indicator for large exports

- [ ] **Full household data import/restore**
  - Import from exported backup file
  - Conflict resolution for existing data (skip, merge, overwrite)
  - Preview import contents before applying
  - Selective import (choose which reptiles, foods, schedules to import)
  - Validation and error handling for corrupted/invalid backups
  - Dry-run mode to preview changes without applying
  - Import from other instances/deployments

- [ ] **Data export & reports** - 📊 MEDIUM PRIORITY (Tier 3)
  - Export reptile history to PDF (vet visits, medication tracking)
  - Weight growth charts (printable)
  - Feeding summary reports
  - Health timeline export
  - CSV export for advanced users (Excel/Google Sheets compatible)
  - Custom date range selection
  - Per-reptile or all-reptiles export options

- [ ] **Implementation**
  - Backend: GET /api/export/household/{id} endpoint with streaming response
  - Backend: POST /api/import/household endpoint with multipart/form-data
  - Backend: File format versioning for compatibility (v1, v2, etc.)
  - Backend: Schema validation on import
  - Frontend: Export button in Settings > Household tab with progress bar
  - Frontend: Import page with drag-drop file upload
  - Frontend: Preview modal showing import contents before confirming
  - File format: JSON with schema versioning for future compatibility
  - Use Cases:
    - Migrate to new server/instance
    - Share household setup with another user
    - Backup before major changes
    - Disaster recovery
    - Data portability between deployments

## 📚 Documentation

### Deployment Guide
- [ ] **Docker deployment documentation**
  - Step-by-step setup guide
  - PostgreSQL cluster setup options
  - Environment variable reference
  - Docker Compose example
  - Take inspiration from [Bookwyrm documentation](https://docs.joinbookwyrm.com/)
  - Include common troubleshooting

### User Guide
- [ ] **End-user documentation**
  - Getting started guide
  - Feature walkthrough
  - Best practices for reptile care tracking

## 🐛 Bug Fixes & Technical Debt

### Active Bugs
- [x] **Weight log read-only view shows "Unknown reptile"** - ✅ FIXED (2025-10-25)
  - Issue: When viewing a weight record in read-only mode (/health-log/weight/{id}), it shows "Unknown" for the reptile name
  - Works correctly in edit mode and activity log
  - Root cause: Backend GET /api/weight/{id} uses WeightLogSchema response model instead of WeightLogWithReptile
  - Backend already loads reptile relationship with selectinload(WeightLog.reptile) at line 80
  - Fix: Changed response_model from WeightLogSchema to WeightLogWithReptile at line 69 in backend/app/routers/weight.py

### Architecture Questions
- [ ] **Review container architecture**
  - Why are there two separate containers?
  - Should they be consolidated into one?
  - Document reasoning or refactor

- [x] **Review Kubernetes setup** - ✅ SIMPLIFIED (2025-10-25)
  - Why 2 kustomizations (db + app)?
  - Using cloudnative-pg17 cluster - is separate DB kustomization needed?
  - Simplify if possible
  - **Resolution:** Merged database and app kustomizations into single kustomization
    - Moved database externalsecret into app directory
    - Deleted separate database kustomization and directory
    - Single kustomization now handles both externalsecret and helmrelease
    - Dependencies (cloudnative-pg-cluster-v17, authentik) moved to single kustomization
    - Cleaner structure with one kustomization instead of two

### Code Quality
- [ ] **Error boundaries** (React)
- [ ] **Loading skeletons** instead of spinners
- [ ] **Toast notifications** library integration
- [ ] **Better form validation** (client + server side)

## 📱 Progressive Web App (Future)

- [ ] **PWA manifest**
- [ ] **Service worker** for offline support
- [ ] **Cache API responses**
- [ ] **Push notifications** (optional)

## ✅ Recently Completed

### December 2025 - Notification Template Enhancements (2025-12-08)
- [x] **Priority-based template matching system** - ✅ COMPLETED (2025-12-08)
  - Create unlimited templates per trigger type with automatic intelligent selection
  - Filter templates by specific reptiles, schedules, schedule types, or food categories
  - 6-level specificity scoring ensures most specific template is always used
  - Example: "Luna's Morning Feeding" template > "Luna's feeding templates" > "All feeding templates" > "Generic template"
  - Database: Migration 0070 added `reptile_id`, `schedule_id`, `schedule_type_filter`, `food_category_filter`, `priority`, `applies_to_description` columns
  - Backend: New template matching functions with priority-based selection algorithm
  - Backend: Updated all notification sender functions to pass context for filter matching
  - Frontend: Filter form fields in template creation/edit modal
  - Frontend: Visual filter badges on templates (color-coded: green=reptile, blue=schedule, yellow=type, orange=food)
  - Frontend: Help section explaining template matching priority system

- [x] **Custom template groups** - ✅ COMPLETED (2025-12-08)
  - Organize notification templates into user-defined collections for better management
  - Create groups with custom names, icons, colors, and sort order
  - Group-level settings apply to all templates in the group:
    - **enabled**: Master on/off switch for entire group (disable all templates at once)
    - **default_priority**: Modifier added to all template priorities (negative values = higher priority)
    - **ignore_quiet_hours**: Bypass quiet hours for critical alert groups
    - **default_channel_ids**: Default notification channels for group templates
  - Database: Migration 0071 created `template_groups` table with group settings
  - Database: Added `group_id` column to `notification_templates` (nullable, SET NULL on delete)
  - Backend: Complete CRUD API at `/api/template-groups/` with validation
  - Backend: TemplateGroup model with relationships to templates and users
  - Frontend: "Manage Groups" button opens group management modal
  - Frontend: Full CRUD interface for creating/editing groups with color picker and settings
  - Frontend: Group selection dropdown in template creation/edit modal
  - Frontend: Color-coded group badges on templates showing group assignment
  - Frontend: Collapsible help section with show/hide button
  - **Use Cases:**
    - Reptile-specific groups: "Luna's Templates" with custom icon and color
    - Priority-based groups: "Critical Alerts" with -50 priority modifier and quiet hours bypass
    - Organizational groups: "Weekly Reminders", "Emergency Alerts", etc.
  - Comprehensive documentation in NOTIFICATION_SYSTEM.md and NOTIFICATION_TEMPLATE_REFACTOR_PLAN.md

### December 2025 - Display Profiles System (2025-12-07)
- [x] **Display Profiles for Dashboard and Statistics Pages** - ✅ COMPLETED (2025-12-07)
  - Save, manage, and switch between different dashboard and statistics layouts
  - Create named profiles from current settings with one click
  - Quick profile switching to change entire layout instantly
  - Update active profile with Save button when making changes
  - Rename, duplicate, and delete profiles (except Default)
  - Export individual profiles as shareable JSON files
  - Import profiles from exported files with custom naming
  - Automatic Default profile creation preserving existing customizations
  - Integration with existing import/export functionality
  - **In-app modal dialogs** for all profile operations (no browser popups)
    - Confirmation dialogs for delete, update, duplicate operations
    - Input modals for rename and import with Enter key support
    - Warning/error modals with appropriate styling
    - Modal backdrop with click-outside-to-close disabled
  - **Built-in Profiles:**
    - Standard: Balanced layout (L, L, M, XS, L)
    - Compact: Space-efficient with activity first (L, M, XS, M, XS)
    - Both profiles auto-created and cannot be deleted
  - **Technical Implementation:**
    - Profile storage in localStorage with automatic built-in profiles
    - ProfileManager component with inline editing and in-app modals
    - Profile object structure: ID, name, dashboard_cards, statistics_charts, chart_settings
    - Import/export format detection (profile vs. full settings)
    - Backwards compatible with existing display customization
    - Per-reptile statistics settings preserved when switching profiles
  - **Documentation:** Comprehensive developer guide in frontend/DISPLAY_PROFILES.md
  - **Use Cases:**
    - Detailed vs. Simple views for different contexts
    - Breeding Season vs. Maintenance focus
    - Mobile vs. Desktop optimized layouts
    - Multiple household members with different preferences
  - Frontend: `/src/utils/displaySettings.js` - 11 new profile management functions
  - Frontend: `/src/components/ProfileManager.jsx` - Full profile UI component
  - Frontend: `/src/pages/Settings.jsx` - Integration into Display tab

### December 2025 - Mobile UI Optimizations (2025-12-07)
- [x] **Mobile-optimized Settings Display tab** - ✅ COMPLETED (2025-12-07)
  - Dashboard and Statistics layout configuration sections fully optimized for mobile
  - **Two-row responsive layout** for card/chart configuration:
    - Row 1: Reorder controls + visibility toggle + label
    - Row 2: Interpolation dropdown (when applicable) + size buttons (XS, S, M, L)
  - **Mobile-friendly reordering** with up/down arrow buttons:
    - Replaces drag-and-drop on mobile (which conflicts with page scrolling)
    - Stacked ChevronUp/ChevronDown buttons for each item
    - Buttons auto-disable at list boundaries (top/bottom)
    - Desktop retains drag-and-drop with GripVertical handle
  - **Optimized responsive headers** for all sections:
    - Dashboard Layout: Header + Reset button stack on mobile
    - Statistics Layout: Dropdown + Reset button stack/wrap on mobile
    - Per-reptile settings info box stacks vertically on mobile
  - **Compact mobile controls**:
    - Smaller icons and buttons on mobile (16px vs 18px)
    - Reduced padding and gaps for better space efficiency
    - Interpolation dropdown narrower on mobile (w-24 vs sm:min-w-[100px])
    - Hidden dividers on mobile to save space
    - "Dots Only" shortened to "Dots" for space
  - **Updated instructions** to clarify drag (desktop) vs arrows (mobile)
  - Fixes horizontal overflow and makes all settings accessible on mobile
  - Frontend: `/src/pages/Settings.jsx` - Full mobile responsive redesign

- [x] **Restored disabled-by-default dashboard cards** - ✅ COMPLETED (2025-12-07)
  - Weekly Summary, Health Summary, and Schedule Summary cards restored
  - Cards appear in Settings > Display > Dashboard Layout
  - All cards disabled by default (visible: false)
  - Users can enable them via visibility toggle in settings
  - Cards automatically merged into existing users' settings
  - Frontend: `/src/utils/displaySettings.js` - Uncommented default cards
  - Note: Card implementations still TODO in Dashboard.jsx

### December 2025 - Bug Fixes & UI Improvements (2025-12-07)
- [x] **Fixed notification template variable substitution** - ✅ COMPLETED (2025-12-07)
  - Notifications were showing literal `{schedule_name}` and `{reptile_name}` instead of actual values
  - Root cause: Python's `format_map()` raised KeyError for missing template variables
  - Created `SafeDict` class that returns empty string for missing keys instead of raising KeyError
  - Templates now gracefully handle optional variables (e.g., `{food_category}` only in feeding schedules)
  - Fixes Discord, Pushover, Generic webhooks, and In-App notifications

- [x] **Fixed schedule deletion UI issues** - ✅ COMPLETED (2025-12-07)
  - Users saw "Failed to delete schedule" popup even though deletion succeeded
  - Schedule remained visible until manual page refresh
  - Root cause: Axios treated 204 No Content response as error, preventing UI refresh
  - Added `validateStatus` to axios config to accept all 2xx responses as success
  - UI now refreshes immediately after deletion without manual refresh
  - Added schedule name to confirmation dialog: "Are you sure you want to delete schedule 'XXX'?"
  - Shows success confirmation after deletion

- [x] **Fixed default food pre-selection** - ✅ COMPLETED (2025-12-07)
  - Default food wasn't filling when opening feeding page or changing reptile dropdown
  - Root cause 1: useEffect missing `reptiles` dependency, didn't run when data loaded
  - Root cause 2: `insectItems.length === 0` check prevented re-filling when changing reptiles
  - Removed length check, added `reptiles` to dependencies
  - Added logic to clear items if no default is configured
  - Fixes both opening feed page (from URL or schedule instance) and changing reptile

- [x] **Fixed interval schedule instance creation** - ✅ COMPLETED (2025-12-07)
  - Creating new interval schedule crashed with "NoneType + timedelta" error
  - Root cause: Trying to add timedelta to `None` for first instance (no previous completion)
  - Updated `create_interval_schedule_instance()` to handle `None` as `last_completion_date`
  - Uses today's date as starting point for new interval schedules
  - Fixed type hint to `Optional[py_date]` for clarity

- [x] **Fixed datetime shadowing bug** - ✅ COMPLETED (2025-12-07)
  - Schedule creation crashed with UnboundLocalError for datetime variable
  - Root cause: Redundant `from datetime import datetime, timezone` inside function shadowed module import
  - Removed redundant import (already imported at module level)
  - Schedule creation now works correctly

### December 2025 - Food Favorites & Default Food Selection (2025-12-06)
- [x] **Food Favorites System** - ✅ COMPLETED (2025-12-06)
  - Two-tier favorites system: global favorites (star) and per-reptile favorites (heart)
  - Database: Migration 0061 created reptile_food_favorites table for per-reptile favorites
  - Database: Added is_favorite column to foods table for global favorites
  - Database: Added show_favorites_first column to users table for user preference
  - Backend: PATCH /api/foods/{id}/toggle-favorite endpoint for global favorites
  - Backend: POST/DELETE /api/reptiles/{id}/favorite-foods/{food_id} for per-reptile favorites
  - Backend: Foods list endpoint supports reptile_id query param to include is_reptile_favorite status
  - Frontend: Smart sorting in food dropdowns (reptile favorites → global favorites → alphabetical)
  - Frontend: Quick add/remove heart buttons in feeding log for instant favoriting
  - Frontend: Star icons in Food Management page for global favorites
  - Frontend: Visual indicators (❤️ emoji for reptile favorites, ⭐ for global favorites)
  - Frontend: Per-reptile favorites management in ReptileDetail favorites tab
  - User preference toggle to enable/disable automatic favorite sorting
  - Reduces cognitive load when selecting from large food lists

- [x] **Default Food Pre-Selection** - ✅ COMPLETED (2025-12-06)
  - Set default foods per reptile for automatic pre-selection when logging feedings
  - Database: Migration 0062 added default_insect_id and default_prepared_id to reptiles table
  - Database: Foreign key constraints to foods table with SET NULL on delete
  - Backend: Updated Reptile model with default food columns and relationships
  - Backend: Updated schemas to include default_insect_id and default_prepared_id
  - Frontend: Default food configuration UI in ReptileDetail favorites tab
  - Frontend: Green-themed section with dropdowns for setting defaults per category
  - Frontend: Auto-selection logic in FeedingLog useEffect when reptile is selected
  - Only pre-selects if in create mode and food type toggle is enabled
  - Streamlines repetitive feeding logs for reptiles with consistent diets

### December 2025 - Auto-Complete Schedules & UX Improvements (2025-12-05)
- [x] **Auto-Complete Schedules** - ✅ COMPLETED (2025-12-05)
  - Enable auto-complete per schedule for repetitive daily tasks (e.g., salad feeding, misting)
  - Configurable delay hours after time window or end of day before auto-completing
  - Database migration adds auto_complete_enabled, auto_complete_hours_after to schedules table
  - Database migration adds auto_completed flag to schedule_completions table
  - Backend scheduler function checks every 30 minutes for instances to auto-complete
  - Manual override API endpoints to mark auto-completed instances as skipped or missed
  - Frontend: Schedule form with auto-complete settings (checkbox + hours input)
  - Frontend: Instance detail page shows robot icon and special UI for auto-completed instances
  - Frontend: "Mark as Skipped" and "Mark as Missed" buttons for manual correction
  - Reduces burden of logging every single occurrence of daily repetitive tasks

- [x] **Calendar View Persistence** - ✅ COMPLETED (2025-12-05)
  - Dashboard calendar view (1d/3d/7d) persists across sessions via localStorage
  - Main calendar view (1d/3d/7d/30d) persists across sessions via localStorage
  - Separate storage keys for dashboard and calendar preferences
  - Mobile/desktop constraints respected when loading saved preferences

- [x] **Bulk API Performance Optimization** - ✅ COMPLETED (2025-12-06)
  - Created `/api/bulk/dashboard` endpoint - returns all dashboard data in 1 request
  - Created `/api/bulk/calendar` endpoint - returns all calendar data in 1 request
  - Reduced Dashboard page from ~38 API requests to 1 request (5-10x faster loading)
  - Reduced Calendar page from ~21 API requests to 1 request (5-10x faster loading)
  - Backend uses efficient database queries with eager loading to avoid N+1 queries
  - Frontend updated to use bulk endpoints with proper data transformation
  - Significant performance improvement especially on slower connections

- [x] **Flexible Completion Window & Smart Re-matching** - ✅ COMPLETED (2025-12-06)
  - Per-schedule flexible completion window settings for date tolerance
  - Database migration 0059: Added `flexible_completion_enabled` and `flexible_completion_days` to schedules table
  - Backend: Updated schedule_matcher.py to use schedule-specific window settings (defaults to 0 for exact matching)
  - Backend: Replaces global DATE_WINDOW_DAYS constant with per-schedule configuration
  - Frontend: Schedule form allows configuring flexible completion window per schedule
  - Frontend: FeedingLog.jsx shows when activity completed a schedule with flexible window (e.g., "2 days after scheduled date")
  - Frontend: ScheduleInstanceDetail.jsx displays flexible window indicator with days offset
  - Smart re-matching on activity deletion:
    - When deleting activity that completed a schedule, system searches for other activities from same day
    - Automatically re-assigns found activities to the now-pending instance
    - Prevents orphaned activities and maintains schedule completion accuracy
    - Implemented for feedings, mistings, and weight logs
  - Allows completing schedules within ±X days of scheduled date (e.g., feed on Monday for Tuesday's schedule)
  - User-configurable per schedule: some schedules can be strict (0 days), others flexible (2-7 days)
  - Calendar and instance views show when completion happened on different date with visual indicators

### December 2025 - Schedule Instance System (2025-12-05)
- [x] **Schedule Instance System** - ✅ COMPLETED (2025-12-05)
  - Pre-generation of schedule occurrences with unique IDs for each instance
  - Pre-calculated supplements attached to instances based on feeding rotation rules
  - Automatic completion tracking when activities are logged (feeding/misting/weighing)
  - Schedule instances marked as completed when matched to logged activities
  - Instance detail page with completion information and navigation
  - "Log Now" buttons for pending instances that pre-fill all form data
  - Pre-filling works for all tracking types (feeding, misting, weight, health)
  - Instance generation configurable via INSTANCE_GENERATION_DAYS_AHEAD setting (default: 60 days)
  - Backend: ScheduleInstance model with status tracking (pending, completed, missed, skipped)
  - Backend: Instance generation triggered on schedule create/update
  - Backend: Automatic instance completion in schedule_matcher.py
  - Backend: Instance lookup and status updates for all activity types
  - Frontend: ScheduleInstanceDetail.jsx page with optimized layout
  - Frontend: Supplements displayed inline in main status card
  - Frontend: Completion details show time (not just date) and bold quantities for countable items
  - Frontend: Pre-filling from instance_id parameter in all logging forms
  - Foundation for improved notification targeting and history tracking

### December 2025 - Care Schedules & Recommendations (2025-12-04)
- [x] **Care Schedules & Recommendations** - ✅ COMPLETED (2025-12-04)
  - Species-based feeding and supplement guidelines
  - Automated schedule creation based on reptile species and age
  - Care recommendations with source references (ReptiFiles, etc.)
  - Integration with existing scheduling system

- [x] **Schedule Template Notification Settings** - ✅ COMPLETED (2025-12-04)
  - Global notification settings when applying templates
  - Enable notifications for all schedules with one click
  - Select notification channels globally (Discord, Pushover, In-App, etc.)
  - Set global reminder time for all schedules
  - Per-schedule notification override option
  - Customize individual schedule notifications when needed
  - Override channels and reminder times per schedule
  - Seamless integration with existing template application flow

### December 2025 - Discord Notification Formatting & Template Improvements (2025-12-05)
- [x] **Discord notification link formatting** - ✅ COMPLETED (2025-12-05)
  - Removed clickable URL from embed title (user feedback: preferred Tautulli style)
  - Added separate "View Details" section at bottom with clickable link
  - Made schedule_link available as Discord field checkbox option
  - Made schedule_url available as message template variable for all channels
  - Configurable link text and label via discord_config

- [x] **Fixed duplicate content in Discord embeds** - ✅ COMPLETED (2025-12-05)
  - Issue: message_template content showing in description AND in Discord fields
  - Solution: When discord_config has include_fields, only use first line as brief description
  - Prevents information duplication (content appeared twice)
  - Fields now contain the detailed information exclusively
  - Clean Tautulli-like presentation with summary + structured fields

- [x] **Template editor UI improvements** - ✅ COMPLETED (2025-12-05)
  - Added schedule_link to available Discord embed field options
  - Added schedule_url to available template variables (schedule_reminder, overdue_alert, custom)
  - User-friendly interface for adding links without manual JSON editing
  - Checkbox selection for Discord embed fields
  - Click-to-insert variable buttons for message templates

### December 2025 - Timezone Handling & Scheduler Fixes (2025-12-05)
- [x] **CRITICAL: Fix scheduler never triggering on correct day** - ✅ COMPLETED (2025-12-05)
  - Fixed get_next_occurrence_date() to include today in search (was starting from tomorrow)
  - Changed range(1, 8) to range(0, 8) for days_of_week schedules
  - Notifications now trigger on the correct day of week
  - This was the root cause of all notification failures

- [x] **Full per-user timezone support** - ✅ COMPLETED (2025-12-05)
  - Added timezone column to users table (migration 0052)
  - Frontend Settings page fetches and saves timezone to database
  - PATCH /api/auth/me endpoint to update user timezone with validation
  - Restructured scheduler to loop through users first (not schedules first)
  - Reminder times now calculated in each user's timezone, converted to UTC for comparison
  - Supports automatic DST handling via Python's zoneinfo module
  - Notification links now use FRONTEND_URL env var instead of hardcoded domain
  - Users can now enter schedule times in their local timezone

### December 2025 - Schedule UI Improvements & Supplement Display (2025-12-05)
- [x] **Supplement rotation display in schedule views** - ✅ COMPLETED (2025-12-05)
  - Added supplement rotation information to ScheduleDetails page
  - Shows applicable supplements calculated from feeding rotations
  - Displays frequency notes (e.g., "Every 2 feedings" or "On Mon, Wed, Fri")
  - Matches Calendar page supplement calculation logic
  - Works for all schedule rule types (every_x_days, days_of_week, monthly)
  - Dashboard calendar modal shows supplements in event details

- [x] **Bell icon notification indicators** - ✅ COMPLETED (2025-12-05)
  - Added bell icons to Dashboard calendar modal for notification-enabled schedules
  - Matches existing Calendar page daily view behavior
  - Visual consistency across all calendar interfaces
  - Bell icons shown next to time window or time slot information

- [x] **ScheduleDetails layout improvements** - ✅ COMPLETED (2025-12-05)
  - Changed from strict 2-column grid to asymmetric layout
  - Left column (wider): Schedule Information card
  - Right column (narrower): Stacked Frequency, Time Window, and Notifications cards
  - Notes card spans full width at bottom
  - Better visual balance and space utilization
  - Uses CSS Grid `lg:grid-cols-[2fr_1fr]` for responsive layout

- [x] **Fixed frontend build errors** - ✅ COMPLETED (2025-12-05)
  - Fixed missing closing div tag in ScheduleDetails.jsx
  - Fixed SQL migration error (measurements table already exists check)
  - Both backend and frontend deployments now succeed

### December 2025 - Notification System Enhancements & Bug Fixes (2025-12-04)
- [x] **Template-Driven Discord Notifications** - ✅ COMPLETED (2025-12-04)
  - Resolved inconsistency where Discord used hardcoded formatting while other channels used templates
  - Added `discord_config` JSON column to notification_templates table for Discord-specific settings
  - Discord embed customization options:
    - Custom embed border color (color picker with hex input)
    - Selectable fields to display (scheduled_date, schedule_type, notes, time_window, food_category, missed_date)
    - Custom footer text
  - Templates now work consistently across all notification channels (Discord, Pushover, Generic, In-App)
  - Backwards compatible: templates without discord_config fall back to hardcoded formatting
  - Features:
    - Template-driven embed title and description
    - Configurable embed color (default: blue for reminders, red for overdue)
    - Checkbox selection for which fields to include in embed
    - Custom footer text per template
  - Backend:
    - Migration 0050: Added discord_config column with sensible defaults for system templates
    - Updated _create_discord_embed() to accept template parameter and use discord_config
    - Modified send_webhook_notification() and scheduler to pass templates through
  - Frontend:
    - Discord Embed Settings section in template editor (shown for Discord/All channels)
    - Visual color picker with hex input field
    - Grid of checkboxes for field selection
    - Footer text input with placeholder
    - Green-styled variable buttons for better visibility
    - Variable insertion at cursor position (not end of text)

- [x] **Quiet Hours & Critical Notification Override** - ✅ COMPLETED (2025-12-04)
  - Implemented quiet hours to suppress non-critical notifications during specified time range
  - Critical notification types (health events, system messages) bypass quiet hours
  - Features:
    - Enable/disable quiet hours in Settings > Notifications tab
    - Set start and end times (UTC) with support for overnight periods (e.g., 22:00-08:00)
    - Visual helper showing configured quiet hours range
    - Critical notifications always delivered regardless of quiet hours
  - Backend:
    - Migration 0048: Added `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end` to notification_settings
    - Updated NotificationSettings model and schemas
    - Implemented `is_within_quiet_hours()` function in scheduler with critical type checking
    - Added quiet hours checks in `check_schedule_reminders()`, `check_overdue_schedules()`, and `create_in_app_notification()`
    - Handles overnight quiet hours (span midnight) correctly
  - Frontend:
    - Added quiet hours UI section in NotificationsTab_new.jsx
    - Checkbox to enable/disable quiet hours
    - Time pickers for start and end times
    - Displays friendly range text (e.g., "22:00 to 08:00 (overnight)")

- [x] **Template Preview with Sample Data** - ✅ COMPLETED (2025-12-04)
  - Added preview functionality for notification templates before saving/using
  - Features:
    - "Preview" button on all templates (system and custom)
    - Modal showing rendered template with sample data
    - Displays both title and message with variable substitution
    - Shows template metadata (trigger type, channel type, template type)
    - Sample data matches test notification structure
  - Implementation:
    - Added `getSampleData()` function with realistic reptile/schedule data
    - Added `renderTemplate()` function to replace template variables
    - Added preview modal UI in NotificationTemplatesTab.jsx
    - Preview button styled with purple theme for visibility

- [x] **In-app notification centre** - ✅ COMPLETED (2025-12-04)
  - Implemented built-in notification system as a manageable notification channel
  - System-created in-app channel for all users (automatically created, cannot be deleted)
  - Users can enable/disable and assign to schedules like other channels
  - Features:
    - Notification bell icon in navigation bar with unread count badge
    - Dropdown notification list showing last 10 notifications
    - Mark as read / Mark all as read functionality
    - Full notification history page with filtering by read status and type
    - Click notifications to navigate to related pages
    - 30-second polling for real-time updates
  - Backend:
    - Created `user_notifications` table and API endpoints
    - Migration 0046: Created notification storage with enum types
    - Migration 0047: Added `is_system` column and auto-created in-app channels
    - Scheduler integration to create in-app notifications for reminders and overdue alerts
    - Made migrations idempotent to handle deployment failures gracefully
  - Frontend:
    - NotificationBell component with unread count and dropdown
    - NotificationDropdown component with recent notifications
    - NotificationHistory page with filtering and pagination
    - Friendly channel type names (shows "In-App" instead of "in_app")
    - Updated ScheduleForm to show friendly names when selecting channels

- [x] **Notification template customization** - ✅ COMPLETED
  - Added ability to customize system notification templates via Settings > Templates tab
  - Users can click "Customize" on system templates to create editable copies
  - Custom templates take priority over system templates
  - Backend: Added `/api/notification-templates/{id}/copy` endpoint
  - Frontend: Updated NotificationTemplatesTab with copy functionality and improved UI
  - Added food_category and supplement_name variables to template system

- [x] **Fixed schedule notification bugs** - ✅ COMPLETED
  - Fixed duplicate completion records causing false overdue notifications
  - Solution: Update existing PENDING completions instead of creating new ones
  - Backend: Updated schedule_matcher.py for all log types (feeding, misting, weighing)

- [x] **Dashboard calendar view improvements** - ✅ COMPLETED
  - Fixed 1-day and 3-day views to start from current date instead of week start
  - Calendar.jsx and Dashboard.jsx now correctly display today + upcoming days

- [x] **Notification supplement info** - ✅ COMPLETED
  - Added supplement info to feeding schedule notifications
  - Queries FeedingRotations to show active supplements
  - Shows supplement names in both reminders and overdue alerts

- [x] **Fixed schedule notification channel errors** - ✅ COMPLETED
  - Fixed SQLAlchemy MissingGreenlet error when updating schedule notification channels
  - Issue: Lazy loading during property assignment caused async errors
  - Solution: Added eager loading with `selectinload()` and `await db.refresh()` before channel assignment
  - Backend: Updated schedules.py to properly load notification_channels relationship

- [x] **Notification channel household-wide persistence** - ✅ COMPLETED
  - Fixed issue where household_wide radio button wasn't persisting selection
  - Added `household_wide` field to `NotificationChannelUpdate` Pydantic schema
  - Backend: Updated schemas.py to allow updating household_wide status

- [x] **Test notification improvements** - ✅ COMPLETED
  - Added supplement_name to test notification context
  - Test notifications now show all data that real notifications include
  - Provides accurate preview of notification appearance

- [x] **Calendar notification indicators** - ✅ COMPLETED
  - Added bell icon indicators throughout all calendar views
  - Visual indicators show which schedules have notifications enabled
  - Locations: Month view, Week view, 3-day view, Day view, Active Schedules section
  - Bell icons styled with blue color for consistency
  - Tooltip text includes notification status in month view

- [x] **Form reset bug fixes** - ✅ COMPLETED
  - Fixed issue where log forms wouldn't reset when navigating from view to create mode
  - Issue: React Router doesn't remount component when navigating from `/feed/:id` to `/feed`
  - Solution: Added useEffect hooks watching `id` parameter to reset form state
  - Applied to: FeedingLog.jsx, HealthLog.jsx, MistingLog.jsx
  - Forms now properly clear and reset to defaults when clicking "Log Feeding" while viewing an existing log

### October 2025 - Dashboard Weight Chart Improvements (2025-10-25)
- [x] **Dashboard weight chart complete overhaul** - ✅ COMPLETED
  - Fixed date range to extend through current date with proper padding
  - Added 1-day padding before first measurement for better Y-axis spacing
  - Increased right margin to 30px and added XAxis padding for better date visibility
  - Fixed overlapping interpolated lines by using separate data keys (_interpolated vs _extrapolated)
  - Solid lines now connect actual measurement points cleanly
  - Dashed extrapolated lines only appear before first and after last measurements
  - Fixed gaps between extrapolated lines and measurement dots
  - Set extrapolated values on first/last measurement dates for seamless connection
  - Added user-friendly tooltip names (e.g., "Spyro (estimated)" instead of "spyro_extrapolated")
  - Fixed legend to show each reptile name only once with clean "Estimated" indicator
  - Used legendType="none" to prevent duplicate legend entries
  - Multi-reptile support with proper color coding
  - Respects interpolation mode setting (linear/step) for extrapolation only

### January 2025 - Reptile List Household Grouping & Filtering (2025-01-25)
- [x] **Household-based reptile organization** - ✅ COMPLETED
  - Backend: Added `ReptileWithHousehold` schema with household information
  - Backend: Updated GET /api/reptiles endpoint to load household relationship
  - Frontend: Group reptiles by household on Reptiles page
  - Frontend: Visual household sections with headers and reptile counts
  - Frontend: Filter toggles to show/hide specific households
  - Frontend: Eye/EyeOff icons to indicate visibility state
  - Frontend: Gradient dividers for visual separation
  - Backend: Uses existing household backref relationship from Household model
  - Sorts households alphabetically with "No Household" last
  - Only shows filter buttons when multiple households exist

- [x] **Hide/Archive reptile feature** - ✅ COMPLETED
  - Database: Added `is_active` boolean field to reptiles table (migration 0020)
  - Backend: Updated Reptile model with `is_active` field (default True, indexed)
  - Backend: Updated schemas to include `is_active` in ReptileBase and ReptileUpdate
  - Backend: GET /api/reptiles filters inactive reptiles by default
  - Backend: Added `include_inactive` query parameter to show all reptiles
  - Frontend: Hide/Unhide button in ReptileDetail page
  - Frontend: Visual state indication (Eye icon = hidden, EyeOff = visible)
  - Frontend: Confirmation dialog when hiding/unhiding
  - Hidden reptiles excluded from: Reptiles list, Dashboard, Calendar, Statistics
  - Can still access hidden reptiles via direct URL
  - Non-destructive alternative to deletion for inactive pets

### January 2025 - Statistics Settings & Customization (2025-01-25)
- [x] **Phase 1.5 - Statistics Settings & Customization** - ✅ COMPLETED
  - Full implementation in Settings > Display tab
  - Settings stored in localStorage via utils/displaySettings.js
  - Statistics page automatically loads and applies settings
  - **Implemented Features:**
    - Display tab in Settings page with comprehensive customization UI
    - Dashboard card management: show/hide, drag-to-reorder, resize (XS/S/M/L)
    - Statistics chart management: show/hide, drag-to-reorder, resize (XS/S/M/L)
    - Weight interpolation modes: Linear, Step, None (dots only) - configurable per chart
    - Chart appearance settings: grid, legend, axis labels, height slider (200-600px)
    - Per-reptile custom statistics layouts with global fallback
    - Export/import all display settings as JSON file
    - Reset functionality for individual sections or all settings
    - Settings persistence in localStorage (per-user, per-browser)
    - Native drag-and-drop implementation (no external library)
    - Live preview: Statistics page updates when returning from Settings
    - Food filtering in statistics (dropdown in weight/feeding correlation chart)
    - Data type toggles (Weight, Feeding, Misting, Health) in Statistics header
    - Time range selector (7d, 30d, 90d, 180d, 365d, 730d) in Statistics page
  - **Not Implemented (deferred to future phases):**
    - Weight units conversion (currently grams only)
    - Trend lines and moving averages
    - Heatmap intensity customization
    - Chart image export (PNG/SVG/PDF)
    - Color scheme customization per user/reptile

### January 2025 - Statistics Page Enhancements & Bug Fixes (2025-01-22)
- [x] **Dashboard weight graph improvements** - ✅ COMPLETED
  - Added connectNulls prop to connect weight lines across date gaps
  - Fixed color consistency between "Your Reptiles" and "Recent Activity"
  - Weight lines now continuous even with missing data points

- [x] **Statistics page weight visualization overhaul** - ✅ COMPLETED
  - Fixed layout issues with dropdown menu taking full width
  - Implemented proper weight interpolation between measurements (linear)
  - Added forward extrapolation (flat line from last known weight to today)
  - Added backward extrapolation (flat line from first known weight to earlier feedings)
  - Visual distinction between known and estimated weight:
    - Solid blue line for actual and interpolated weight (between measurements)
    - Dashed light blue line for extrapolated weight (before first/after last measurement)
    - Large blue dots highlighting actual measurement points
  - User-friendly legend: "Known weight", "Estimated weight", "Weighed"
  - Chart extends to today's date regardless of last measurement
  - Smooth line connections at all transition points (solid-to-dashed boundaries)
  - Shows feedings even before first weight measurement

- [x] **Feeding log redirect fix** - ✅ COMPLETED
  - Feeding creation now redirects to read-only view (/feed/{id})
  - Previously redirected to home page
  - Matches behavior of weight logging

- [x] **Calendar category filtering** - ✅ COMPLETED
  - Added filter buttons for Feeding, Misting, Health, Supplement
  - Compact layout for vertical space savings
  - Filter state persisted in localStorage
  - All categories shown by default

### January 2025 - Supplement Rotation Template System & UI Improvements (2025-01-07)
- [x] **Supplement rotation templates** - ✅ COMPLETED
  - Full migration from supplement schedule templates to supplement rotation templates
  - Backend: New `supplement_rotation_templates` table (migration 0037)
  - Backend: Deleted old supplement schedule templates from database (migration 0038)
  - Backend: SupplementRotationTemplate model with species/age/UVB filtering
  - Backend: API router at `/api/supplement-rotation-templates` with list, filter, match, and apply endpoints
  - Backend: Seeded 25+ rotation templates for bearded dragons, leopard geckos, crested geckos
  - Frontend: Integrated rotation templates into ScheduleTemplates page
  - Frontend: Rotations appear alongside schedule templates in same ReptiFiles groups
  - Frontend: Apply modal supports both schedules and rotations together
  - Frontend: Editable rotation parameters (trigger mode, frequency, schedule days)
  - Frontend: Display "supplement rotation" instead of "supplement_rotation" in UI
  - Frontend: Auto-fill reptile and life stage in apply modal from view modal selection
  - Frontend: Enhanced editing - change schedule rule types, edit feeding counts, edit frequency
  - Exclusive supplement mode (only highest priority applies per feeding)
  - Calcium powder application to ALL feedings (insects and salads) for bearded dragons
  - Support for complex patterns (calcium daily, multivitamin weekly, calcium with D3 bi-weekly)

- [x] **Template modal UI improvements** - ✅ COMPLETED (2025-01-07)
  - Moved Edit and Duplicate buttons to template modal header alongside title
  - Buttons positioned at same height as template title for better layout
  - Responsive design: shows icon + text on larger screens, icon-only on mobile
  - Removed duplicate buttons from bottom of modal
  - Improved visual hierarchy and space utilization

- [x] **Dashboard recent activity spacing fix** - ✅ COMPLETED (2025-01-07)
  - Increased prominent value column width from 48px to 64px
  - Fixed spacing issues with 2-decimal weight values (e.g., "59.43g")
  - Prevents weight values from running into reptile names

- [x] **Schedule-based supplement rotation triggers** - ✅ COMPLETED (2025-01-16)
  - Two trigger modes: feeding_count (every N feedings) and schedule_based (specific days)
  - Day-of-week rotation support for time-based supplements (e.g., multivitamin 2x/week)
  - Migration 0016 adds trigger_mode, schedule_days_of_week fields
  - Backend rotation calculator with day-of-week checking and date parameter
  - Frontend trigger mode selector and day-of-week picker with user preference support
  - Multiple supplements per feeding support (priority-based display order)
  - Schedule-based preview showing realistic 2-week schedule from actual calendar schedules
  - Preview queries feeding schedules and evaluates schedule rules for accurate display

- [x] **First day of week preference** - ✅ COMPLETED (2025-01-16)
  - User preference for calendar first day (Sunday/Monday)
  - Auto-detection from browser locale (US/Americas → Sunday, Europe/Asia → Monday)
  - Affects all calendar views (month/week), statistics heatmap, and rotation pickers
  - Helper functions: getDayNames(), getDayNumbers(), getUserFirstDayOfWeek()
  - Calendar grid calculations and week grouping respect preference

- [x] **Calendar completion status improvements** - ✅ COMPLETED (2025-01-16)
  - Completed events now merge with their scheduled items (no duplicates)
  - Intelligent matching with food category normalization (Food model singular → schedule plural)
  - Scheduled items show green checkmark and completion timestamp
  - Completed timestamps use user's time format preference (24h/12h)
  - Clicking completed schedules links to feeding/misting detail views
  - Manual entries without schedules still show separately

### January 2025 - Schedule Time Windows & Calendar Enhancements
- [x] **Schedule time windows system** - ✅ COMPLETED (2025-01-16)
  - Full time window support for schedules (earliest time, latest time)
  - Automatic activity-to-schedule matching with intelligent scoring algorithm
  - Schedule completion tracking (on_time, early, late, missed, pending)
  - Custom time pickers respecting 12h/24h user preferences
  - Enhanced calendar modal with dashboard-style design
  - 4-column horizontal layout for better space utilization
  - Visual indicators with Clock icons throughout UI
  - 30-minute tolerance window for realistic usage patterns
  - Foundation for future notification system

### January 2025 - Household Management & Bug Fixes
- [x] **Comprehensive household management system** - ✅ COMPLETED
  - Backend endpoints for household CRUD, member management, invitation system
  - Frontend tabbed UI in Settings page
  - Member list with roles and remove functionality
  - Invitation list with status tracking and revoke functionality
  - Leave household functionality with safeguards
  - Edit household name (owner only)

- [x] **Fixed household permissions system** - ✅ COMPLETED (2025-01-15)
  - Fixed check_reptile_access() to use actual household roles instead of hardcoded CARETAKER
  - Fixed get_user_reptiles() to use actual household roles
  - Fixed is_owner() to check household membership for OWNER/ADMIN roles
  - Household owners can now edit reptiles and feedings as expected
  - Permission hierarchy properly respected: VIEWER < CARETAKER < OWNER < ADMIN

- [x] **Fixed household member access to reptiles** - ✅ COMPLETED
  - Updated permissions.py to check household membership
  - Household members automatically get FEEDER access
  - New reptiles auto-assign to creator's household

- [x] **Fixed date format issues** - ✅ COMPLETED (2025-01-15)
  - Replaced HTML5 date input with custom DateInput component
  - Respects user's date format preference (DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, YYYY-MM-DD)
  - Converts between display format and ISO format for backend
  - Auto-detects browser locale for smart default format
  - Fixed issue where dates were interpreted as MM/DD/YYYY regardless of display

- [x] **Fixed user interface issues** - ✅ COMPLETED (2025-01-15)
  - Fixed user name overflow in sidebar (bottom left)
  - Added proper text truncation with ellipsis
  - Improved layout constraints for long names

- [x] **Statistics Page Phase 1** - ✅ COMPLETED (2025-01-15)
  - Implemented comprehensive statistics endpoint
  - Combined weight and feeding chart with dual Y-axes
  - Linear interpolation for sparse weight data with visual distinction
  - GitHub-style feeding frequency calendar heatmap
  - Summary cards showing weight change, feeding count, health events
  - Filter toggles for different data types
  - Time range selector (30, 60, 90, 180, 365, 730 days)

- [x] **Calendar schedule management** - ✅ COMPLETED (2025-01-15)
  - Added collapsible "Manage Schedules" section to calendar page
  - List view of all active schedules with details
  - Edit and delete functionality for schedules
  - Human-readable schedule frequency formatting
  - Empty state with call-to-action
  - Full edit support: added /schedule-edit/:id route
  - ScheduleForm loads and updates existing schedules
  - Allow changing reptile when editing schedule
  - Backend validates permissions on both old and new reptile

- [x] **Fixed supplement modal bug** - ✅ COMPLETED (2025-01-15)
  - Added missing X icon import in FoodManagement.jsx
  - Fixed blank page when clicking supplements

- [x] **Feeding heatmap improvements** - ✅ COMPLETED (2025-01-15)
  - Fixed calendar heatmap layout and alignment issues
  - Proper week grouping with padding for partial weeks
  - Day labels in left column, weeks as vertical columns
  - Constrained heatmap width to content size (about 1/3 card width)
  - GitHub-style contribution graph now displays correctly

- [x] **Statistics UI improvements** - ✅ COMPLETED (2025-01-15)
  - Moved filter toggles to header row for compact layout
  - Icon-only buttons with tooltips (Weight, Feeding, Misting, Health)
  - Color-coded active states matching data types
  - Removed separate filter card, all controls now in header

- [x] **Fixed session timeout** - ✅ COMPLETED
  - Updated ACCESS_TOKEN_EXPIRE_MINUTES from 15 to 1440 (24 hours)
  - Fixed in both backend config.py and helmrelease.yaml

- [x] **Fixed invitation acceptance errors** - ✅ COMPLETED
  - Added duplicate membership check
  - Proper error messages for already-joined households

- [x] **Fixed migration issues** - ✅ COMPLETED
  - Reorganized migrations with baseline
  - Fixed async/await in household routers
  - Fixed import errors (require_authenticated_user → get_current_user)

### Earlier Completions
- [x] **Edit/Delete feeding records** - ✅ COMPLETED
  - Implemented in reptile detail page
  - Allows editing date, time, and notes
  - Allows deleting feeding records with confirmation

- [x] **Settings page with date/time formatting** - ✅ COMPLETED
  - 12h/24h time format preference
  - Date format options
  - Timezone selection
  - Custom time pickers respect settings

- [x] **Food Management Page** - ✅ COMPLETED
  - Full CRUD operations
  - Category filtering
  - Nutritional data fields
  - Delete protection for defaults (with force option)

- [x] **Health & Weight logging page** - ✅ COMPLETED
  - Weight tracking with notes
  - Health record logging
  - Pre-select reptile from detail page

- [x] **Calendar placeholder page** - ✅ COMPLETED (needs functionality)
- [x] **Statistics placeholder page** - ✅ COMPLETED (needs functionality)

---

---

## 🎓 Feature Assessment & Recommendations

### Current Application Functionality
The Reptile Tracker currently provides:

**Core Tracking:**
- Individual reptile profiles (name, species, morph, date of birth, etc.)
- Feeding logs with food items, quantities, and supplements
- Weight tracking with historical data
- Health records (observations, shedding, bowel movements, vet visits, medications)
- Misting/humidity logs
- Dashboard with summary cards and reptile status indicators

**Data Management:**
- Custom food library with nutritional data
- Supplement library with dosage tracking
- Multi-food feeding support (e.g., "3 crickets + 2 mealworms")
- Per-item supplement application

**Multi-User & Organization:**
- Household system for shared reptile management
- Role-based permissions (Admin, Owner, Caretaker, Viewer)
- Invitation system for adding household members
- OIDC/SSO authentication

**User Experience:**
- Calendar view (month/week/day) showing historical events
- Mobile-responsive design with bottom navigation
- Dark mode by default
- Custom date/time format preferences
- New user onboarding wizard

### 🌟 High-Impact Feature Recommendations

#### 1. **Care Schedules & Recommendations** - 🎯 HIGHEST PRIORITY
**Why:** This transforms the app from a logging tool into an active care assistant
- **Recommended Feeding Schedule**
  - Based on species, age, and size
  - Frequency (e.g., "Juvenile bearded dragon: daily", "Adult ball python: every 7-10 days")
  - Food type recommendations (prey size for age/weight)
  - Link to source/care sheet (e.g., reptifiles.com, morphmarket care guides)
  - User can override/customize schedule

- **Supplement Schedule Automation**
  - Based on species and feeding schedule
  - Example: "Calcium without D3 every feeding, Calcium with D3 once per week, Multivitamin twice per month"
  - Auto-suggest supplements when logging feeding

- **Implementation:**
  - Database: `care_guidelines` table (species, age_range, feeding_frequency, source_url)
  - Backend: GET /api/care-guidelines/{species} endpoint
  - Frontend: Show recommendations on reptile detail page
  - Frontend: "Use recommended schedule" button to auto-create schedules

#### 2. **Smart Notifications & Reminders** - 🎯 HIGH PRIORITY
**Why:** Ensures reptiles don't go without care, especially for multi-reptile households
- Feeding reminders based on schedule
- Weight check reminders (monthly/weekly depending on age)
- Missed misting alerts (for tropical species)
- Upcoming vet appointment reminders
- Implementation: Browser notifications (PWA) or email digest

#### 3. **Photo Gallery & Visual Progress Tracking** - 🔧 MEDIUM PRIORITY
**Why:** Visual proof of growth, shedding issues, health concerns
- Photo upload for each log type (feeding, health, weight, shedding)
- Photo gallery per reptile sorted by date
- Before/after shed photos
- Growth comparison (photo timeline)
- Implementation: Backend already has photo_url field in health_records

#### 4. **Environmental Data Tracking** - 🔧 MEDIUM PRIORITY
**Why:** Temperature and humidity are critical for reptile health
- **Ambient conditions logging:**
  - Basking spot temperature
  - Cool side temperature
  - Humidity percentage
  - UVB bulb age tracking (replacement reminders)
- **Ideal ranges per species:**
  - Display recommended ranges on dashboard
  - Alert when out of range (if manual logging)
  - Optional: IoT sensor integration (future)

#### 5. **Breeding & Genetics Tracker** - 📊 LOW PRIORITY (Specialized)
**Why:** Valuable for breeders, but niche use case
- Breeding pairs tracking
- Egg laying/incubation logs
- Clutch tracking (hatch dates, success rate)
- Morph genetics calculator (for certain species)
- Only implement if user base requests it

#### 6. **Veterinary & Medical Records** - 🔧 MEDIUM PRIORITY
**Why:** Centralized medical history for vet visits
- **Enhanced vet visit logs:**
  - Vet clinic info (name, phone, address)
  - Diagnosis, treatment plan
  - Medication prescriptions with dosage/schedule
  - Follow-up appointment dates
  - Attach lab results/documents
- **Medication reminders:**
  - Active medication list with schedule
  - Mark doses as given
  - Alert when running low

#### 7. **Species Care Sheets** - 📚 MEDIUM PRIORITY
**Why:** Educational resource for new owners
- Built-in care sheets for common species
- Categories: habitat setup, feeding, temperature/humidity, common health issues
- Link to external resources (reputable sites)
- Community contributions (moderated)

#### 8. **Data Export & Reports** - 📊 MEDIUM PRIORITY
**Why:** Useful for vet visits, breeding records, insurance claims
- Export reptile history to PDF
- Weight growth charts (printable)
- Feeding summary reports
- Health timeline
- CSV export for advanced users

#### 9. **Complete Backup & Restore System** - 📦 HIGH PRIORITY
**Why:** Data portability, migration between instances, disaster recovery
- **Full Export Functionality:**
  - Export entire household data as a single JSON/ZIP file
  - Includes: household info, all reptiles, foods, supplements, schedules
  - Includes: all historical data (feedings, weights, health records, mistings)
  - Includes: user preferences and settings
  - Option to export with or without photos (large file size consideration)
  - Encrypted export option for sensitive data
- **Full Import/Restore Functionality:**
  - Import from exported backup file
  - Conflict resolution for existing data (skip, merge, or overwrite)
  - Preview import contents before applying
  - Selective import (choose which reptiles, foods, etc. to import)
  - Validation and error handling for corrupted/invalid backups
- **Use Cases:**
  - Migrate to new server/instance
  - Share household setup with another user
  - Backup before major changes
  - Disaster recovery
  - Data portability between deployments
- **Implementation:**
  - Backend: GET /api/export/household/{id} endpoint
  - Backend: POST /api/import/household endpoint with multipart/form-data
  - Frontend: Export button in Settings with progress indicator
  - Frontend: Import page with drag-drop file upload
  - File format: JSON with schema versioning for future compatibility

### 🚫 Features to Avoid (Low Value/High Complexity)
- Social features (sharing, forums) - out of scope
- Marketplace/buying features - different app domain
- Live video streaming of enclosures - too complex
- AI diagnosis - medical liability concerns
- Real-time sensor dashboards - requires hardware integration (future PWA feature)

### 📋 Recommended Priority Order (UPDATED - December 2025)

**Tier 1 - CRITICAL (Implement Immediately - Next 2-4 weeks):**
1. **Statistics Page Phase 2** - Health analytics, shed tracking, weight change rate, timeline
2. **Advanced Notification Features** - Grouping/digest, snooze, per-reptile preferences
3. **Live Feeder Animal Care** - Gut loading, hydration, inventory tracking for feeder insects

**Tier 2 - HIGH VALUE (Next 1-2 months):**
4. **Photo Upload & Gallery** - Visual health tracking and progress photos (backend ready)
5. **Complete Backup & Restore System** - Full household export/import for data portability
6. **Schedule Assignment to Household Members** - Assign schedules to specific users, workload distribution, targeted notifications
7. **Statistics Page Phase 3** - Advanced analytics, supplement adherence, export charts

**Tier 3 - IMPORTANT (Next 2-3 months):**
8. **Environmental Data Tracking** - Temperature/humidity logging with ideal ranges, UVB bulb tracking
9. **Enhanced Vet Records** - Medical documentation, medication tracking with reminders
10. **Data Export & Reports** - PDF export for vet visits

**Tier 4 - ADVANCED (Future - 3+ months):**
11. **Species Care Sheets** - Built-in educational resources
12. **Statistics Phase 4** - Predictive analytics, growth projections
13. **Breeding Tracker** - If requested by user base
14. **PWA Features** - Offline mode, push notifications, install prompt

**Completed in December 2025:**
- ✅ **Care Schedules & Recommendations** - Species-based feeding/supplement guidelines
- ✅ **Template-Driven Discord Notifications** - Consistent templates across all channels
- ✅ **Quiet Hours & Critical Notifications** - Time-based notification suppression
- ✅ **In-App Notification Centre** - Built-in notification system with history

**Why These Priorities:**
- **Statistics Phase 2:** Extends existing implementation, high medical value
- **Advanced Notifications:** Builds on solid notification foundation, improves user experience
- **Feeder Animal Care:** Unique feature that complements reptile tracking perfectly
- **Photo Upload:** Backend ready, high user engagement, visual proof of care
- **Backup/Export:** Critical for data portability and disaster recovery
- **Schedule Assignment:** Addresses real pain point for multi-user households, improves accountability and workload distribution

---

## Priority Legend
- 🎯 High Priority - Critical for core functionality
- 🔧 Core Features - Important features for MVP
- 📅 Calendar & Scheduling - Time-based features
- 📊 Analytics - Data visualization and reporting
- 👥 Multi-User - Collaboration features
- 📚 Documentation - Guides and docs
- 🐛 Bug Fixes - Technical improvements
- 📱 PWA - Progressive Web App features (future)
