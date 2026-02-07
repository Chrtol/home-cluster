---
phase: 07-foundation
plan: 01
subsystem: frontend-design-system
tags: [shadcn, theming, css-variables, tooling]

dependency_graph:
  requires: []
  provides:
    - shadcn/ui configuration with CSS variables mode
    - Path alias system (@/ imports)
    - Warm dark color palette design tokens
    - Semantic color system for components
  affects:
    - All future Phase 7 tasks (depends on shadcn/ui setup)
    - All future component development

tech_stack:
  added:
    - "shadcn/ui (new-york style, CSS variables mode)"
    - "clsx + tailwind-merge (class merging utilities)"
    - "class-variance-authority (component variants)"
  patterns:
    - "CSS variables for dynamic theming"
    - "Semantic color tokens (background, foreground, card, etc.)"
    - "Path aliases for clean imports"

key_files:
  created:
    - frontend/components.json
    - frontend/jsconfig.json
    - frontend/src/lib/utils.js
    - frontend/package-lock.json
  modified:
    - frontend/package.json
    - frontend/vite.config.js
    - frontend/tailwind.config.js
    - frontend/src/index.css

decisions:
  - decision: "Use CSS variables mode instead of Tailwind classes for theming"
    rationale: "Enables dynamic theme switching and easier customization"
    alternatives_considered: ["Tailwind utility classes only"]

  - decision: "Adopt warm dark palette as base theme"
    rationale: "Creates personality and warmth while maintaining data density"
    alternatives_considered: ["Pure neutral grays", "Light theme default"]

  - decision: "Use new-york style for shadcn/ui components"
    rationale: "More modern aesthetic, better for data-dense interfaces"
    alternatives_considered: ["default style (deprecated)"]

  - decision: "Maintain backward compatibility with legacy green primary scale"
    rationale: "Allows existing components to work during gradual migration"
    alternatives_considered: ["Break all existing components immediately"]

metrics:
  duration: "3min 8sec"
  tasks_completed: 3
  commits: 3
  files_changed: 8
  completed_date: "2026-02-07"
---

# Phase 7 Plan 1: Foundation - shadcn/ui Setup and Warm Dark Palette

**One-liner:** Established shadcn/ui with CSS variables mode, path aliases, and warm near-black color palette with semantic design tokens.

## Objective

Initialize the technical foundation for the v1.1 UI Overhaul by configuring shadcn/ui with CSS variables mode and establishing the warm dark color palette as design tokens.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Configure path aliases and install shadcn/ui dependencies | 59dbcf499 | jsconfig.json, vite.config.js, package.json, package-lock.json |
| 2 | Initialize shadcn/ui with CSS variables mode | cef4255c3 | components.json, src/lib/utils.js |
| 3 | Establish warm dark palette with CSS variables | 42fdcb3f4 | tailwind.config.js, src/index.css |

## What Was Built

### shadcn/ui Configuration
- Created `components.json` with new-york style and CSS variables mode enabled
- Configured path aliases (@/components, @/lib, @/ui, @/hooks)
- Set up non-RSC, JSX mode for React compatibility
- Used neutral base color for shadcn components

### Path Alias System
- Added `jsconfig.json` with @/* → ./src/* mapping
- Updated `vite.config.js` with resolve.alias configuration
- Installed @types/node for Node.js path module support
- Verified imports using @/ work correctly in build

### Design Token System
- Established HSL CSS variable system in `:root`
- Created semantic color tokens: background, foreground, card, popover, primary, secondary, muted, accent, destructive
- Added surface tokens for layering (surface, surface-elevated)
- Configured Tailwind to reference CSS variables via hsl()

### Warm Dark Color Palette
- Background: #14161a (220 13% 9%) - Very dark blue-gray with warmth
- Foreground: #f0e6d6 (36 45% 90%) - Warm off-white text
- Card/Surface: #181b20 (222 14% 11%) - Slightly elevated
- Borders: #2d3138 (220 13% 20%) - Subtle borders
- Primary: #16a34a (142 76% 36%) - Vibrant green from existing palette
- Muted: #a89a87 (36 25% 65%) - Warm muted text

### Backward Compatibility
- Updated legacy component classes (.btn-primary, .input-field, .card) to use semantic tokens
- Maintained primary.500-900 green scale for existing components
- Replaced dark:bg-gray-X with semantic token equivalents
- Ensured existing pages render correctly with new palette

## Dependencies Installed

```json
{
  "dependencies": {
    "clsx": "latest",
    "tailwind-merge": "latest",
    "class-variance-authority": "latest"
  },
  "devDependencies": {
    "@types/node": "latest"
  }
}
```

## Verification Results

- ✅ Build succeeds without errors (`npm run build`)
- ✅ Path aliases resolve correctly (@/ imports work)
- ✅ CSS variables present in `:root`
- ✅ Semantic colors available in Tailwind (bg-background, text-foreground, etc.)
- ✅ shadcn/ui CLI ready to add components
- ✅ No regressions in existing pages

## Deviations from Plan

None - plan executed exactly as written.

## Key Technical Details

**CSS Variables Format:**
```css
--background: 220 13% 9%;  /* HSL values without hsl() wrapper */
```

**Tailwind Usage:**
```javascript
background: "hsl(var(--background))"  /* Wraps in hsl() function */
```

This approach allows Tailwind's opacity modifiers to work: `bg-background/50` for 50% opacity.

**Path Alias Resolution:**
- jsconfig.json enables IDE autocomplete
- vite.config.js enables build-time resolution
- Both must be configured for full functionality

## Next Phase Readiness

**Blockers:** None

**Ready for:**
- Phase 7 Plan 2: Adding shadcn/ui components (Button, Card, etc.)
- Phase 8: Dashboard redesign with new components
- Any component development using the design token system

**Testing Notes:**
- Existing pages should maintain current appearance due to legacy class updates
- New components should use semantic tokens (bg-card, text-foreground, etc.)
- Primary green (#16a34a) remains the accent color

## Success Criteria Met

- ✅ shadcn/ui CLI can add components without errors
- ✅ Path alias @/ resolves correctly in imports
- ✅ CSS variables define warm dark palette
- ✅ Design tokens available in Tailwind classes
- ✅ components.json provides shadcn/ui configuration
- ✅ src/lib/utils.js exports cn() utility
- ✅ jsconfig.json configures @/* path alias
- ✅ tailwind.config.js extends theme with semantic colors
- ✅ src/index.css defines CSS variables for theming

## Self-Check: PASSED

**Files created:**
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/components.json
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/jsconfig.json
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/src/lib/utils.js
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/package-lock.json

**Files modified:**
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/package.json
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/vite.config.js
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/tailwind.config.js
- ✅ /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/frontend/src/index.css

**Commits verified:**
- ✅ 59dbcf499: chore(07-01): configure path aliases and install shadcn/ui dependencies
- ✅ cef4255c3: feat(07-01): initialize shadcn/ui with CSS variables mode
- ✅ 42fdcb3f4: feat(07-01): establish warm dark palette with CSS variables and semantic tokens
