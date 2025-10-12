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

- [ ] **New user onboarding wizard**
  - Option 1: Paste code to join existing household
  - Option 2: Create new household + add first reptile
  - Tour of key pages: food items, health info, etc.

### Food & Supplement Management
- [x] **Food Management Page** - ✅ COMPLETED
  - Create/edit/delete food items
  - Manage nutritional values
- [ ] **Extend to Supplements**
  - Add supplement management to food page
  - Include calcium, calcium with D3, multivitamins
  - Allow editing dosage information

## 🔧 Core Features

### Reptile Management
- [ ] **Species dropdown with free-text** - ⚠️ PARTIALLY DONE
  - Backend: Store unique species in database
  - Frontend: Dropdown populated from existing species
  - Frontend: Allow free-text entry for new species
  - Backend: Auto-add new species to dropdown list

### Health & Weight Logging
- [ ] **Enhanced health logging UI**
  - Move button to sidebar/more prominent location
  - Add shedding log type
  - Add bowel movement log type with:
    - Consistency field (dropdown or scale)
    - Photo upload capability
  - Organize with tabs or sections for different log types

### Humidity & Environment
- [ ] **Misting logs**
  - Backend: Create misting table (reptile_id, misted_at, notes)
  - Backend: API endpoints for misting CRUD
  - Frontend: Misting log page/form
  - Frontend: Add "Last Misted" to dashboard

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
- [ ] **Backend: Household model**
  - Create household table
  - Link users to households (many-to-many)
  - Link reptiles to households
  - Backend API for household management

- [ ] **Invitation system**
  - Generate invitation codes/links
  - Backend: Invitation table (code, household_id, expires_at, max_uses)
  - Frontend: Invitation code input on signup/onboarding
  - Backend: Validate and accept invitations

### User Roles & Permissions
- [ ] **Granular access control**
  - Roles: Owner, Admin, Caretaker, Feeder, Viewer
  - Permissions matrix:
    - Owner: Full access, manage users
    - Admin: All data access, cannot delete household
    - Caretaker: View/edit health, weight, feeding
    - Feeder: View reptiles, log feedings only
    - Viewer: Read-only access
  - Backend: Role-based authorization middleware
  - Frontend: Conditional UI based on permissions

### Settings - Household Tab
- [ ] **Household management in settings**
  - Create tabbed settings interface
  - Household tab:
    - View household info
    - Generate invitation links
    - View active invitations
    - Manage household name/settings

- [ ] **Admin tab - User management**
  - List all users in household
  - Show user info (name, email, role, last active)
  - Edit user roles
  - Remove users from household
  - Require Owner role to access

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
