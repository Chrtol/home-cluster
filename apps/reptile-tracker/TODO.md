# Reptile Tracker - Todo List

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
- [ ] **Add more reptile info cards**
  - Last misting date/time
  - Last shed date/time
  - Days since last feeding
  - Days since last shed
  - Review visual structure/layout for readability

## 📅 Calendar & Scheduling

### Calendar Page
- [ ] **Replace placeholder with functional calendar**
  - Display previous feedings on calendar
  - Filter by reptile (default: show all)
  - Visual indicators for different event types

- [ ] **Feeding scheduler**
  - Create recurring feeding schedules (every X days, specific weekdays)
  - Assign supplements to scheduled feedings
  - Examples:
    - Multivitamin: twice a month
    - Calcium with D3: once a week
    - Calcium without D3: all other feedings
  - Backend: Scheduling table and logic
  - Frontend: Scheduling UI with calendar integration

## 📊 Statistics & Analytics

### Statistics Page
- [ ] **Replace placeholder with data visualization**
  - Feeding frequency graphs (per reptile, overall)
  - Weight tracking charts (growth over time)
  - Supplement usage tracking
  - Shedding frequency analysis
  - Misting frequency
  - Export data to CSV/PDF

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

- [ ] **Granular access control expansion** - 🔜 FUTURE
  - Add Admin and Caretaker roles
  - Refine permissions matrix
  - Per-user role management UI

### Settings - Household Tab
- [x] **Comprehensive household management UI** - ✅ COMPLETED
  - Tabbed interface with Overview, Members, and Invitations tabs
  - Overview tab:
    - View household info (name, creation date)
    - Quick stats (member count, active invites)
    - Edit household name (owner only)
    - Create invitation button
    - Leave household button
  - Members tab:
    - List all household members
    - Show name, email, role, join date
    - Remove member button (owner only, cannot remove other owners)
  - Invitations tab:
    - List all invitations with status (active/expired/maxed out)
    - Show invitation code, usage count, expiry date
    - Copy code/link functionality
    - Revoke invitation button (owner only)
  - Household selector dropdown for multi-household users
  - Create and join household forms integrated

- [ ] **Advanced user management** - 🔜 FUTURE
  - Edit user roles (currently roles are fixed at join time)
  - View last active timestamp
  - User activity logs

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

## Priority Legend
- 🎯 High Priority - Critical for core functionality
- 🔧 Core Features - Important features for MVP
- 📅 Calendar & Scheduling - Time-based features
- 📊 Analytics - Data visualization and reporting
- 👥 Multi-User - Collaboration features
- 📚 Documentation - Guides and docs
- 🐛 Bug Fixes - Technical improvements
- 📱 PWA - Progressive Web App features (future)
