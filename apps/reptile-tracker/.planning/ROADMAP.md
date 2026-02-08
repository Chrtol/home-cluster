# Roadmap: v1.1 UI Overhaul

**Milestone:** v1.1
**Phases:** 7-12 (continuing from v1.0)
**Created:** 2026-02-07

## Overview

```
Phase 7:  Foundation          -> Design system, shadcn/ui, tokens
Phase 8:  Dashboard           -> Single pane of glass redesign
Phase 9:  Reptile Pages       -> List and detail pages
Phase 10: Calendar & Stats    -> Calendar quick-view, statistics improvements
Phase 11: Forms & Tables      -> Feed logging, food table, pickers
Phase 12: Polish & Mobile     -> Consistency pass, mobile optimization
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
**Plans:** 14/14 complete
**Verification:** 54/54 must-haves verified. See 08-VERIFICATION.md.

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

**Success:** Dashboard shows all reptile statuses at a glance, all features work correctly, matches mockup

---

## Phase 9: Reptile Pages

**Goal:** Redesign reptile list and detail pages

**Requirements:** REPT-01, REPT-02, REPT-03, REPT-04

**Deliverables:**
- [ ] Denser reptile list grid
- [ ] Improved detail page header
- [ ] Compact tab content styling
- [ ] Photo gallery improvements

**Success:** Reptile pages feel consistent with new dashboard design

---

## Phase 10: Calendar & Statistics

**Goal:** Improve calendar quick-view and statistics visualization

**Requirements:** CAL-01, CAL-02, CAL-03, STAT-01, STAT-02, STAT-03

**Deliverables:**
- [ ] Calendar: quick day summary header
- [ ] Calendar: denser event display
- [ ] Calendar: improved filters
- [ ] Statistics: compact stat cards
- [ ] Statistics: better chart styling
- [ ] Statistics: improved filters

**Success:** Calendar shows today/week at a glance, statistics feel polished

---

## Phase 11: Forms & Tables

**Goal:** Redesign forms and tables with new components

**Requirements:** FORM-01, FORM-02, FORM-03, FORM-04, FORM-05

**Deliverables:**
- [ ] Feed logging form redesign
- [ ] Food table with visual hierarchy
- [ ] Health log compact view
- [ ] Misting log compact view
- [ ] Schedule template modals
- [ ] All forms using new date/time pickers

**Success:** Forms feel beautiful, tables have clear hierarchy

---

## Phase 12: Polish & Mobile

**Goal:** Consistency pass and mobile optimization

**Requirements:** NAV-03, NAV-04

**Deliverables:**
- [ ] Mobile navigation updates
- [ ] Consistent page headers
- [ ] Responsive breakpoint audit
- [ ] Animation/transition polish
- [ ] Loading states consistency
- [ ] Error states consistency

**Success:** Desktop and mobile feel equally polished, consistent visual language

---

## Dependencies

```
Phase 7 (Foundation) -> All other phases depend on this
Phase 8 (Dashboard)  -> Can start after Phase 7
Phase 9 (Reptile)    -> Can start after Phase 7, parallel with Phase 8
Phase 10 (Cal/Stat)  -> Can start after Phase 7
Phase 11 (Forms)     -> Depends on Phase 7 (pickers)
Phase 12 (Polish)    -> After all other phases complete
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| shadcn/ui integration issues | Phase 7 is foundation-only, validates approach early |
| Breaking existing functionality | Each phase maintains backward compatibility |
| Scope creep | Settings/Onboarding explicitly excluded |
| Mobile complexity | Dedicated phase (12) for mobile focus |

---
*Last updated: 2026-02-08*
