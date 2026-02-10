# Roadmap: v1.1 UI Overhaul

**Milestone:** v1.1
**Phases:** 7-13 (continuing from v1.0)
**Created:** 2026-02-07

## Overview

```
Phase 7:  Foundation          -> Design system, shadcn/ui, tokens
Phase 8:  Dashboard           -> Single pane of glass redesign
Phase 9:  Reptile Pages       -> List and detail pages
Phase 10: Calendar & Stats    -> Calendar quick-view, statistics improvements
Phase 11: Forms & Tables      -> Feed logging, food table, pickers
Phase 12: Polish & Mobile     -> Consistency pass, mobile optimization
Phase 13: Activity History    -> Activity history page, "View all" from dashboard
```

---

## Phase 7: Foundation Complete

**Goal:** Establish new design system foundation with shadcn/ui

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04

**Status:** Complete (2026-02-08)
**Plans:** 3/3 complete

Plans:
- [x] 07-01-PLAN.md -- shadcn/ui setup, path aliases, design tokens, CSS variables
- [x] 07-02-PLAN.md -- Core components (Button, Card, Input, Badge), ReptileNameWithAvatar, Framer Motion
- [x] 07-03-PLAN.md -- DatePicker and TimePicker with user format preference

**Deliverables:**
- [x] Design tokens (colors, spacing, typography) in Tailwind config
- [x] shadcn/ui installed and configured
- [x] DatePicker and TimePicker components working
- [x] Updated color palette (warm darks, earth accents)
- [x] Base component styles (buttons, cards, inputs)

**Verification:** 16/16 must-haves verified. See 07-VERIFICATION.md.

**Success:** New components render correctly, existing pages still work

---

## Phase 8: Dashboard Complete

**Goal:** Transform dashboard into single pane of glass showing all reptile statuses at a glance

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, NAV-01, NAV-02

**Status:** Complete (2026-02-08)
**Plans:** 16/16 complete

Plans:
- [x] 08-01-PLAN.md -- Compact sidebar with collapse toggle, header with greeting and quick stats, Cmd/Ctrl+K shortcut
- [x] 08-02-PLAN.md -- Reptile status cards widget with compact mode, drag reorder, task chips
- [x] 08-03-PLAN.md -- Today's schedule timeline with time grouping, filters, auto-scroll, quick-log
- [x] 08-04-PLAN.md -- Weight trends sparklines, week summary, recent activity, edit mode, widget gallery
- [x] 08-05-PLAN.md -- GAP CLOSURE: Fix QuickLogForm 404, task names, weight display, supplements
- [x] 08-06-PLAN.md -- GAP CLOSURE: Fix timeline time slot grouping, Ctrl+K shortcut on Windows
- [x] 08-07-PLAN.md -- GAP CLOSURE: Integrate Header, edit mode controls, widget gallery
- [x] 08-08-PLAN.md -- GAP CLOSURE: Visual polish (sparkline height, avatars, grid gaps, defaults)
- [x] 08-09-PLAN.md -- GAP CLOSURE R2: Visual fixes (avatar shape, header layout, grid gaps, timeline compact, widget avatars)
- [x] 08-10-PLAN.md -- GAP CLOSURE R2: Persistence and navigation (Customize saves to profile, avatar clickable)
- [x] 08-11-PLAN.md -- GAP CLOSURE R2: QuickLog enhancements (food selector, time picker, full form navigation)
- [x] 08-12-PLAN.md -- GAP CLOSURE R3: Bug fixes (time ranges, avatar data, locale, supplements serialization)
- [x] 08-13-PLAN.md -- GAP CLOSURE R3: Visual fixes (grid gap, timeline avatars, border color, now highlight)
- [x] 08-14-PLAN.md -- GAP CLOSURE R3: Functional (quantity +/-, task type icons, customize hide/reorder)
- [x] 08-15-PLAN.md -- GAP CLOSURE R4: QuickLog consistency (food category, favorites, escape key, Cmd+K)
- [x] 08-16-PLAN.md -- GAP CLOSURE R4: Layout fixes (grid gap with tall widgets, activity avatars)

**Deliverables:**
- [x] Compact sidebar matching mockup
- [x] Reptile status cards with photo, stats, today's tasks
- [x] Today's schedule timeline
- [x] Recent activity (compact)
- [x] Weight trends with sparklines
- [x] Week summary stats
- [x] Preserve modularity system (ProfileManager in Settings still works)
- [x] Header with greeting and quick stats
- [x] Edit mode with widget gallery
- [x] Working quick-log flow with food selection and time picker
- [x] Time ranges in timeline
- [x] Task type icons (feeding/misting/health)
- [x] Customize mode with hide and reorder
- [x] QuickLog from Today card same as Status Card (food category, favorites)
- [x] Keyboard shortcuts (Escape, Cmd+K)
- [x] Grid layout with items-start alignment

**Success:** Dashboard shows all reptile statuses at a glance, all features work correctly, matches mockup

---

## Phase 9: Reptile Pages Complete

**Goal:** Redesign reptile list and detail pages to match new dashboard design patterns

**Requirements:** REPT-01, REPT-02, REPT-03, REPT-04

**Status:** Complete (2026-02-09)
**Plans:** 4/4 complete

Plans:
- [x] 09-01-PLAN.md -- Denser reptile list grid with badge-style household filters
- [x] 09-02-PLAN.md -- Improved detail header with badge-based quick stats
- [x] 09-03-PLAN.md -- Compact tab content styling (feedings, health, weight, misting)
- [x] 09-04-PLAN.md -- Photo gallery density improvements and badge filters

**Deliverables:**
- [x] Denser reptile list grid (4 cols xl, 3 lg, 2 sm, 1 mobile)
- [x] Badge-style household filters (replacing Eye/EyeOff buttons)
- [x] Improved detail page header with quick stats badges
- [x] Compact tab content styling
- [x] Photo gallery with denser grid and badge category filters

**Verification:** 12/12 must-haves verified. See 09-VERIFICATION.md.

**Success:** Reptile pages feel consistent with new dashboard design

---

## Phase 10: Calendar & Statistics Complete

**Goal:** Improve calendar quick-view and statistics visualization

**Requirements:** CAL-01, CAL-02, CAL-03, STAT-01, STAT-02, STAT-03

**Status:** Complete (2026-02-09)
**Plans:** 3/3 complete

Plans:
- [x] 10-01-PLAN.md -- Calendar quick day summary header, denser event display, badge filters
- [x] 10-02-PLAN.md -- Statistics compact stat cards with trends, chart styling, badge filters
- [x] 10-03-PLAN.md -- GAP CLOSURE: Remove calendar header, improve badge outline, fix statistics active badges

**Deliverables:**
- [x] Calendar: denser event display (3 events before overflow)
- [x] Calendar: improved filters (badge-style chips)
- [x] Statistics: compact stat cards with trends (arrows + percentages)
- [x] Statistics: better chart styling (CustomTooltip, theme-aware colors)
- [x] Statistics: improved filters (badge-style, time range presets with filled active badges)
- [x] Badge: outline variant with muted subtle styling

**Verification:** 7/7 must-haves verified. See 10-VERIFICATION.md.

**Success:** Calendar shows today/week at a glance, statistics feel polished

---

## Phase 11: Forms & Tables Complete

**Goal:** Redesign forms and tables with react-hook-form, shadcn/ui Table and Dialog components

**Requirements:** FORM-01, FORM-02, FORM-03, FORM-04, FORM-05

**Status:** Complete (2026-02-09)
**Plans:** 4/4 complete

Plans:
- [x] 11-01-PLAN.md -- Install dependencies, shadcn/ui Form/Select/Textarea, redesign MistingLog and HealthLog
- [x] 11-02-PLAN.md -- shadcn/ui Table/Dialog/Tabs, redesign FoodManagement with visual hierarchy
- [x] 11-03-PLAN.md -- Redesign FeedingLog with react-hook-form, useFieldArray for dynamic items
- [x] 11-04-PLAN.md -- Redesign ScheduleTemplateForm, SupplementRotations, NotificationHistory

**Deliverables:**
- [x] Feed logging form redesign
- [x] Food table with visual hierarchy
- [x] Health log compact view
- [x] Misting log compact view
- [x] Schedule template modals
- [x] Supplement rotations streamlined UI
- [x] Notification history compact list
- [x] All forms using new date/time pickers

**Verification:** 10/10 must-haves verified. See 11-VERIFICATION.md.

**Success:** Forms feel beautiful, tables have clear hierarchy

---

## Phase 12: Polish & Mobile

**Goal:** Consistency pass and mobile optimization

**Requirements:** NAV-03, NAV-04

**Status:** In Progress
**Plans:** 10 plans

Plans:
- [ ] 12-01-PLAN.md -- Create consistency components (PageHeader, LoadingState, ErrorState, useMediaQuery)
- [ ] 12-02-PLAN.md -- Fix dashboard sidebar bugs (empty drop zone, completed section persistence)
- [ ] 12-03-PLAN.md -- Mobile navigation polish (44x44px touch targets, active:scale-95 feedback)
- [ ] 12-04-PLAN.md -- Apply consistency to pages batch 1 (ReptileList, FoodManagement, Statistics, Calendar, NotificationHistory, MistingLog, HealthLog)
- [ ] 12-05-PLAN.md -- Apply consistency to pages batch 2 (FeedingLog, ScheduleTemplates, SupplementRotations, ScheduleDetails, HouseholdSettings)
- [ ] 12-06-PLAN.md -- Final verification checkpoint
- [ ] 12-07-PLAN.md -- Keyboard shortcuts F/M/H in Track menu
- [ ] 12-08-PLAN.md -- Avatar border color consistency and ReptileNameWithAvatar audit
- [ ] 12-09-PLAN.md -- EmptyState component and application
- [ ] 12-10-PLAN.md -- Page transitions and focus indicator polish

**Deliverables:**
- [ ] Consistency components (PageHeader, LoadingState, ErrorState, EmptyState)
- [ ] useMediaQuery hook for responsive detection
- [ ] Mobile navigation with proper touch targets (44x44px minimum)
- [ ] Touch feedback on mobile nav items (active:scale-95)
- [ ] Dashboard sidebar bug fixes (empty drop zone in edit mode)
- [ ] Today card completed section state persistence
- [ ] All pages using consistent PageHeader component
- [ ] All pages using consistent LoadingState component
- [ ] Keyboard shortcuts F/M/H when Track menu is open
- [ ] Avatar border color propagation fixed across all widgets
- [ ] ReptileNameWithAvatar used in appropriate contexts
- [ ] EmptyState component for consistent empty data displays
- [ ] Smooth page transitions with Framer Motion
- [ ] Consistent focus-visible indicators for accessibility

**Dashboard Customization Bugs Fixed:**
- [ ] Sidebar zone shows empty drop zone when no cards (edit mode)
- [ ] Today card completed section remembers expanded/collapsed state
- [ ] WidgetGallery already supports zone selection (verified in research)

**Deferred to v1.2:**
- Column layout customization (Bug 4 from UAT)

**Success:** Desktop and mobile feel equally polished, consistent visual language

---

## Phase 13: Activity History

**Goal:** Create dedicated activity history page accessible from dashboard "View all" button

**Requirements:** ACT-01

**Status:** Not Started
**Plans:** TBD

Plans:
- [ ] 13-01-PLAN.md -- Activity history page with filters, pagination, and search

**Deliverables:**
- [ ] Activity history page (/activity or /history)
- [ ] Filter by activity type (feeding, misting, health, weight)
- [ ] Filter by reptile
- [ ] Date range filter
- [ ] Pagination or infinite scroll
- [ ] Dashboard "View all" button links to activity page

**Success:** Users can view complete activity history from dashboard

---

## Dependencies

```
Phase 7 (Foundation) -> All other phases depend on this
Phase 8 (Dashboard)  -> Can start after Phase 7
Phase 9 (Reptile)    -> Can start after Phase 7, parallel with Phase 8
Phase 10 (Cal/Stat)  -> Can start after Phase 7
Phase 11 (Forms)     -> Depends on Phase 7 (pickers)
Phase 12 (Polish)    -> After all other phases complete
Phase 13 (Activity)  -> After Phase 12
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| shadcn/ui integration issues | Phase 7 is foundation-only, validates approach early |
| Breaking existing functionality | Each phase maintains backward compatibility |
| Scope creep | Settings/Onboarding explicitly excluded |
| Mobile complexity | Dedicated phase (12) for mobile focus |

---
*Last updated: 2026-02-09*
