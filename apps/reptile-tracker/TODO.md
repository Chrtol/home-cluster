# Reptile Tracker - Todo List

## 🚀 NEXT UP - Tier 1 Priorities
1. **Statistics Page Phase 1** - Weight charts & feeding frequency (see [📊 Statistics & Analytics](#-statistics--analytics))
2. **Care Schedules & Recommendations** - Species-based guidelines (see recommendations below)

---

## 🎯 High Priority

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

### Humidity & Environment
- [x] **Misting logs** - ✅ COMPLETED
  - Backend: Created misting_logs table with migration
  - Backend: Full CRUD API endpoints at /api/misting
  - Frontend: MistingLog page with date/time picker
  - Frontend: Added to Track button dropdown (desktop & mobile)
  - Note: "Last Misted" dashboard display still pending

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

- [ ] **Advanced scheduling system** - 🎯 NEXT PRIORITY
  - Backend: Extend schedule model for advanced rules
    - Every X days (already supported)
    - Specific days of week (e.g., Mon, Wed, Fri)
    - Monthly (specific day of month)
    - Dependent schedules (e.g., supplements based on feeding schedule)
  - Schedule types: feeding, misting, weighing, supplement
  - Dependent scheduling examples:
    - "Multivitamin every 2nd feeding"
    - "Calcium with D3 every Monday feeding"
    - "Calcium without D3 on all other feedings"
  - Frontend: Schedule creation UI with smart rules
  - Frontend: Visual schedule preview on calendar
  - Backend: Calculate next occurrence based on rules
  - Backend: Support for supplement assignment to feeding schedules

## 📊 Statistics & Analytics

### Statistics Page - 🎯 CRITICAL PRIORITY (Tier 1)
**Why High Priority:** Uses existing data, high visual impact, easy to implement, medical value

- [ ] **Phase 1 - Essential Charts** (1-2 weeks)
  - Weight growth chart (line graph per reptile)
  - Feeding frequency calendar heatmap
  - Summary cards: days since last feeding/misting/shed
  - Chart library: Recharts or Chart.js

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

### Settings - OIDC Configuration
- [ ] **OIDC settings UI** (Advanced)
  - Currently configured via environment variables
  - GUI alternative for easier setup
  - Fields: Provider URL, Client ID, Client Secret, Redirect URI
  - Backend: Store encrypted OIDC config in database
  - Security: Restrict to household owner only

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

### Architecture Questions
- [ ] **Review container architecture**
  - Why are there two separate containers?
  - Should they be consolidated into one?
  - Document reasoning or refactor

- [ ] **Review Kubernetes setup**
  - Why 2 kustomizations (db + app)?
  - Using cloudnative-pg17 cluster - is separate DB kustomization needed?
  - Simplify if possible

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

### January 2025 - Household Management & Bug Fixes
- [x] **Comprehensive household management system** - ✅ COMPLETED
  - Backend endpoints for household CRUD, member management, invitation system
  - Frontend tabbed UI in Settings page
  - Member list with roles and remove functionality
  - Invitation list with status tracking and revoke functionality
  - Leave household functionality with safeguards
  - Edit household name (owner only)

- [x] **Fixed household member access to reptiles** - ✅ COMPLETED
  - Updated permissions.py to check household membership
  - Household members automatically get FEEDER access
  - New reptiles auto-assign to creator's household

- [x] **Fixed date format issues** - ✅ COMPLETED
  - Created custom DateInput component
  - Respects user's date format preference (DD/MM/YYYY, MM/DD/YYYY, etc.)
  - Converts between display format and ISO format for backend

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

### 🚫 Features to Avoid (Low Value/High Complexity)
- Social features (sharing, forums) - out of scope
- Marketplace/buying features - different app domain
- Live video streaming of enclosures - too complex
- AI diagnosis - medical liability concerns
- Real-time sensor dashboards - requires hardware integration (future PWA feature)

### 📋 Recommended Priority Order (UPDATED)

**Tier 1 - CRITICAL (Implement Immediately - Next 2-4 weeks):**
1. **Statistics Page Phase 1** - Weight charts, feeding frequency heatmaps (uses existing data!)
2. **Care Schedules & Recommendations** - Species-based feeding/supplement guidelines with sources

**Tier 2 - HIGH VALUE (Next 1-2 months):**
3. **Statistics Page Phase 2** - Health analytics, shed tracking, timeline
4. **Smart Notifications & Reminders** - Feeding alerts, weight check reminders
5. **Photo Upload & Gallery** - Visual health tracking and progress photos

**Tier 3 - IMPORTANT (Next 2-3 months):**
6. **Statistics Page Phase 3** - Advanced analytics, supplement adherence, export
7. **Environmental Data Tracking** - Temperature/humidity logging with ideal ranges
8. **Enhanced Vet Records** - Medical documentation, medication tracking with reminders
9. **Data Export & Reports** - PDF export for vet visits

**Tier 4 - ADVANCED (Future - 3+ months):**
10. **Species Care Sheets** - Built-in educational resources
11. **Statistics Phase 4** - Predictive analytics, growth projections
12. **Breeding Tracker** - If requested by user base
13. **PWA Features** - Offline mode, push notifications, install prompt

**Why Statistics Moved to Tier 1:**
- All data already exists in database
- High visual impact and user delight factor
- Medical value (weight charts for vets)
- Foundation for future analytics features
- Relatively quick to implement with modern chart libraries
- Validates the value of consistent data logging

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
