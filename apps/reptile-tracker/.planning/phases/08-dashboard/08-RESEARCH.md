# Phase 8: Dashboard - Research

**Researched:** 2026-02-08
**Domain:** React dashboard redesign with widget modularity
**Confidence:** HIGH

## Summary

This research covers implementing a comprehensive dashboard redesign following the "single pane of glass" pattern where all critical information is visible without scrolling. The existing codebase already has a mature widget modularity system powered by localStorage persistence and display profiles, which new widgets must integrate with seamlessly.

The tech stack (React 18.3, Tailwind CSS 3.4, Recharts 2.12, Framer Motion 12) is well-suited for this phase. The existing dashboard already implements drag-and-drop reordering, profile management, and widget customization through the displaySettings.js utility system.

**Primary recommendation:** Build new widgets (reptile status cards, timeline, trends) as self-contained components that integrate with the existing dashboard card system. Leverage existing patterns for size control (XS/S/M/L), visibility toggles, ordering, and profile management rather than creating parallel systems.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reptile Status Cards:**
- Auto-trigger compact mode when count exceeds threshold (6+)
- Compact mode: Collapsed cards showing only avatar + name + status indicator, expand on hover/click
- Card click behavior: body opens quick-view/expands inline, name/avatar navigates to detail page
- Task chips: Click to quick-log that task
- Last activity: Always show "last fed: Xd ago" even without scheduled feedings
- Weight trend: Shows change since last measurement (not rolling average)
- Overdue styling: Amber border + red overdue chip (match mockup)
- Card ordering: Support inline drag-to-reorder directly on dashboard
- No photo fallback: Show species icon/emoji based on reptile type
- Age display: Show actual age since birth/hatch date
- Status indicator dot: Tasks only — green (done), amber (due), red (overdue)
- Many tasks (5+): Show first 3 task chips + "+X more" count

**Today's Schedule Timeline:**
- Grouping: By time slot (not by reptile)
- Quick-log action: Inline quick-log form with option to open full logging view
- Leverage existing schedule instance auto-fill (supplements, food category, etc.)
- Completed tasks: Collapse into expandable section at top ("2 completed")
- Task types: Filterable by type (feedings, misting, etc.), filter settings persisted per user
- Auto-scroll: Scroll timeline to current time when dashboard loads
- All done state: Show celebratory message ("All done for today!")
- Hover details: Show tooltip with notes, supplements, last logged info
- Border interaction: Status border is visual only — actions via Log button

**Sidebar & Header:**
- Track button: Keep current behavior
- Sidebar collapsible: Yes, icon-only mode on desktop with toggle
- Header stats ("3 due, 2 done"): Display only, no click action
- Mobile navigation: Keep current behavior
- Greeting: Time-based ("Good morning/afternoon/evening, [Name]")
- Notification bell: Keep current behavior
- Keyboard shortcut: Cmd/Ctrl + K opens Track menu (global shortcut)

**Widget Modularity:**
- Full modularity: All new widgets follow existing add/hide/resize/reorder pattern
- Customization access: Edit mode toggle button to enter customization mode
- Reset layout: Available in edit mode
- Widget sizes: Keep current XS/S/M/L width system with dynamic height
- Preference storage: User profile (database) — syncs across devices
- Widget gallery: Visual gallery with previews when adding widgets
- Per-widget config: Widgets can have individual settings
- Widget settings access: Only accessible in edit mode
- Animations: Minimal animations for add/remove/reorder
- Presets: Preserve existing Standard/Compact/Mobile presets

### Claude's Discretion

- Multiple widget instances (e.g., two Recent Activity widgets with different filters) — decide based on what makes sense
- Exact compact mode threshold (how many reptiles triggers compact)
- Quick-view panel vs inline expand implementation choice

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Component framework | Already in use, provides hooks for state/effects needed for dashboard |
| Tailwind CSS | 3.4.15 | Utility-first styling | Already configured with dark mode, mockup uses Tailwind patterns |
| Recharts | 2.12.7 | Charts and visualizations | Already in use for weight charts, supports sparklines via minimal LineChart configuration |
| Framer Motion | 12.33.0 | Animations | Already in use, AnimatePresence handles add/remove widget animations |
| date-fns | 3.6.0 | Date manipulation | Already in use for time calculations, formatting |
| Lucide React | 0.437.0 | Icons | Already in use for UI icons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | 1.7.7 | HTTP client | API calls for reptile data, schedules, activity logs |
| react-router-dom | 6.25.1 | Navigation | Navigate to reptile detail pages, handle URL state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage | Backend sync | User already has database preference storage; localStorage for temporary UI state only |
| Custom drag-drop | dnd-kit/react-dnd | Existing codebase uses native HTML5 drag API successfully; no need to add library |
| Framer Motion | React Spring | Framer Motion already integrated, smaller learning curve for maintainers |

**Installation:**
No new packages required — all dependencies already present in package.json.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── pages/
│   └── Dashboard.jsx              # Main dashboard page (exists)
├── components/
│   ├── dashboard/                 # NEW: Dashboard-specific components
│   │   ├── ReptileStatusCard.jsx
│   │   ├── TodayScheduleTimeline.jsx
│   │   ├── WeeklyTrendsSummary.jsx
│   │   ├── QuickLogForm.jsx
│   │   ├── WidgetGallery.jsx
│   │   └── EditModeControls.jsx
│   ├── Layout.jsx                 # Sidebar/header (exists, needs updates)
│   └── ReptileAvatar.jsx          # Already exists
├── utils/
│   ├── displaySettings.js         # Widget config system (exists)
│   └── dateFormatting.js          # Date utilities (exists)
```

### Pattern 1: Widget-Based Dashboard Cards

**What:** Each dashboard section is a widget that integrates with the existing displaySettings system.

**When to use:** For all new dashboard features (reptile cards, timeline, trends).

**Example:**
```javascript
// displaySettings.js - Add new widget definitions
const DEFAULT_DASHBOARD_CARDS = [
  // Existing cards...
  {
    id: 'reptile_status_cards',
    label: 'Reptile Status Cards',
    visible: true,
    order: 1,
    size: 'large',
    type: 'content',
    config: {
      compactThreshold: 6,
      showAge: true,
      showWeight: true
    }
  },
  {
    id: 'today_timeline',
    label: "Today's Schedule",
    visible: true,
    order: 2,
    size: 'medium',
    type: 'content',
    config: {
      filterTypes: ['feeding', 'misting', 'health'],
      autoScrollToCurrent: true
    }
  },
  // More cards...
];

// Dashboard.jsx - Render based on settings
const dashboardCards = getDashboardCardSettings();
const visibleCards = dashboardCards
  .filter(card => card.visible)
  .sort((a, b) => a.order - b.order);

return (
  <div className="grid gap-4">
    {visibleCards.map(card => {
      switch(card.id) {
        case 'reptile_status_cards':
          return <ReptileStatusCards key={card.id} config={card.config} size={card.size} />;
        case 'today_timeline':
          return <TodayTimeline key={card.id} config={card.config} size={card.size} />;
        // More cases...
      }
    })}
  </div>
);
```

Source: Existing displaySettings.js pattern in codebase (lines 21-31, 334-396)

### Pattern 2: Responsive Size Mapping

**What:** Map size values (XS/S/M/L) to Tailwind grid columns that adapt to screen size.

**When to use:** For all widget containers to ensure consistent sizing behavior.

**Example:**
```javascript
// Utility function
const getSizeClasses = (size) => {
  const sizeMap = {
    xs: 'col-span-12 sm:col-span-6 lg:col-span-3',    // 1/4 on desktop
    small: 'col-span-12 sm:col-span-6 lg:col-span-6', // 1/2 on desktop
    medium: 'col-span-12 lg:col-span-9',              // 3/4 on desktop
    large: 'col-span-12'                              // Full width
  };
  return sizeMap[size] || sizeMap.large;
};

// Usage in component
<div className={`${getSizeClasses(card.size)} card`}>
  {/* Widget content */}
</div>
```

Source: [Tailwind Grid responsive patterns](https://codeparrot.ai/blogs/mastering-responsive-layouts-with-tailwind-grid-in-react)

### Pattern 3: Auto-Collapse with Threshold Detection

**What:** Automatically switch card display mode when item count exceeds threshold.

**When to use:** For reptile status cards to handle many reptiles gracefully.

**Example:**
```javascript
function ReptileStatusCards({ config, size }) {
  const [reptiles, setReptiles] = useState([]);
  const [isCompact, setIsCompact] = useState(false);
  const threshold = config?.compactThreshold || 6;

  useEffect(() => {
    // Fetch reptiles
    fetchReptiles().then(data => {
      setReptiles(data);
      setIsCompact(data.length >= threshold);
    });
  }, [threshold]);

  return (
    <div className="grid gap-3">
      {isCompact ? (
        <CompactReptileCards reptiles={reptiles} />
      ) : (
        <FullReptileCards reptiles={reptiles} />
      )}
    </div>
  );
}
```

Source: User requirements + existing dashboard card patterns

### Pattern 4: Inline Drag Reordering

**What:** Native HTML5 drag-and-drop using onDragStart, onDragOver, onDrop handlers with React state.

**When to use:** For reordering reptile cards directly on dashboard (supplements settings-based reordering).

**Example:**
```javascript
function DraggableReptileCard({ reptile, index, onReorder }) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorder(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      className={`cursor-move ${draggedIndex === index ? 'opacity-50' : ''}`}
    >
      {/* Card content */}
    </div>
  );
}
```

Source: [Native React drag-drop pattern](https://medium.com/nerd-for-tech/simple-drag-and-drop-in-react-without-an-external-library-ebf1c1b809e), existing Settings.jsx implementation (lines 560-583)

### Pattern 5: Global Keyboard Shortcuts

**What:** Centralized keyboard event handling with useEffect cleanup.

**When to use:** For Cmd/Ctrl+K Track menu shortcut.

**Example:**
```javascript
// Layout.jsx
function Layout({ user, onLogout }) {
  const [trackMenuOpen, setTrackMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setTrackMenuOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Rest of component...
}
```

Source: [React keyboard shortcuts best practices](https://devtrium.com/posts/how-keyboard-shortcut), [global handler pattern](https://github.com/greena13/react-hotkeys)

### Pattern 6: Auto-Scroll to Current Time

**What:** useEffect + scrollIntoView on mount to position timeline at current time slot.

**When to use:** Today's Schedule timeline initial render.

**Example:**
```javascript
function TodayTimeline({ config }) {
  const currentTimeRef = useRef(null);

  useEffect(() => {
    if (config?.autoScrollToCurrent && currentTimeRef.current) {
      // Scroll to current time slot after render
      requestAnimationFrame(() => {
        currentTimeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      });
    }
  }, [config?.autoScrollToCurrent]);

  return (
    <div className="overflow-y-auto max-h-96">
      {timeSlots.map(slot => (
        <div
          key={slot.id}
          ref={isCurrentSlot(slot) ? currentTimeRef : null}
          className="border-l-2"
        >
          {/* Time slot content */}
        </div>
      ))}
    </div>
  );
}
```

Source: Standard React scroll pattern + [scroll timeline patterns](https://www.npmjs.com/package/react-timeline-animation)

### Pattern 7: Persistent Filter Preferences

**What:** localStorage + useState to save user's filter choices per widget.

**When to use:** Today's Schedule timeline task type filters.

**Example:**
```javascript
function TodayTimeline({ config }) {
  const [activeFilters, setActiveFilters] = useState(() => {
    const saved = localStorage.getItem('timeline_filters');
    return saved ? JSON.parse(saved) : ['feeding', 'misting', 'health'];
  });

  useEffect(() => {
    localStorage.setItem('timeline_filters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  const toggleFilter = (type) => {
    setActiveFilters(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const filteredTasks = tasks.filter(task =>
    activeFilters.includes(task.type)
  );

  // Render with filters...
}
```

Source: [localStorage persistence patterns](https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/), existing codebase displaySettings.js

### Pattern 8: Minimal Add/Remove Animations

**What:** Framer Motion AnimatePresence with layout animations for smooth widget transitions.

**When to use:** Adding/removing widgets in edit mode.

**Example:**
```javascript
import { motion, AnimatePresence } from 'framer-motion';

function WidgetContainer({ widgets }) {
  return (
    <AnimatePresence mode="popLayout">
      {widgets.map(widget => (
        <motion.div
          key={widget.id}
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {/* Widget content */}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
```

Source: [Framer Motion AnimatePresence guide](https://medium.com/@triplem656/effortless-react-list-animations-a-guide-to-framer-motions-animatepresence-27a9cea4d058), existing Framer Motion 12.33.0 in package.json

### Anti-Patterns to Avoid

- **Profile system bypass:** Don't create separate storage for new widgets — integrate with existing displaySettings.js system
- **Inline styles:** Avoid style props; use Tailwind classes consistently with mockup design tokens
- **Parallel state systems:** Don't duplicate widget visibility/order tracking — use getDashboardCardSettings() as single source of truth
- **Over-animation:** Keep transitions under 300ms; mockup emphasizes data density over flashy transitions
- **Color-only status:** Don't rely solely on colored dots — always pair with icons/text for accessibility

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Widget system | Custom config storage | Existing displaySettings.js | Already handles add/hide/resize/reorder/profiles/export/import (lines 1-859) |
| Drag-drop reordering | Custom pointer tracking | Native HTML5 drag API | Settings page already implements successfully (lines 560-583); mobile has arrow buttons |
| Chart sparklines | Custom SVG rendering | Recharts LineChart | Minimal config, existing library, supports responsive containers |
| Profile management | New profile system | Existing ProfileManager component | Already handles Standard/Compact/Mobile presets with desktop/mobile switching |
| Date formatting | Custom formatters | date-fns + dateFormatting.js | Respects user timezone/format preferences from settings |
| Keyboard shortcuts | Event listener soup | Centralized handler in Layout | Single registration point prevents conflicts, easier cleanup |

**Key insight:** This codebase already has a production-grade widget modularity system (displaySettings.js). The primary challenge is integrating new widgets into this existing system, not building a new customization framework.

## Common Pitfalls

### Pitfall 1: Breaking Display Profile Compatibility

**What goes wrong:** Adding new widgets without updating all three default profiles (Standard, Compact, Mobile) causes inconsistent behavior when switching profiles.

**Why it happens:** displaySettings.js initializes profiles on first use; new widgets only appear in fresh profiles, not existing ones.

**How to avoid:**
- Update DEFAULT_DASHBOARD_CARDS in displaySettings.js first
- Test profile switching (Standard ↔ Compact ↔ Mobile) with new widgets
- Ensure profile migration logic adds new cards to existing profiles (lines 490-586)

**Warning signs:** Profile switch causes new widgets to disappear; export/import breaks on new widgets.

### Pitfall 2: LocalStorage Size Limits

**What goes wrong:** Storing large amounts of widget config data (especially per-reptile settings) can exceed 5-10MB localStorage limits.

**Why it happens:** Each reptile's status card config, timeline filters, chart data gets persisted individually.

**How to avoid:**
- Store only configuration (threshold values, filter states), not data (reptile lists, schedules)
- Use config objects sparingly in DEFAULT_DASHBOARD_CARDS
- Consider database sync for cross-device persistence (user already has preference storage)

**Warning signs:** QuotaExceededError in console; settings changes not saving; slow dashboard loads.

### Pitfall 3: Auto-Scroll Breaking Drag-Drop

**What goes wrong:** Auto-scrolling timeline interferes with drag-drop gesture recognition.

**Why it happens:** Scroll repositioning during onDragOver triggers early drag termination.

**How to avoid:**
- Run auto-scroll only once on mount, not during user interaction
- Disable auto-scroll when drag is active: `if (!isDragging) scrollToCurrentTime()`
- Use requestAnimationFrame to defer scroll until after initial render

**Warning signs:** Drag gesture drops immediately; console errors about synthetic events; timeline jumps during drag.

### Pitfall 4: Status Color-Only Indicators

**What goes wrong:** Red/amber/green status dots fail accessibility requirements; colorblind users can't distinguish states.

**Why it happens:** Mockup shows colored dots prominently; easy to forget icon/text pairing.

**How to avoid:**
- Always pair colored indicators with icons (checkmark, clock, alert)
- Include text labels ("Done", "Due", "Overdue") alongside or on hover
- Test with grayscale mode or colorblind simulation

**Warning signs:** No icon/text with color; 3:1 contrast ratio violations; user testing reveals confusion.

Source: [Status indicator accessibility guidelines](https://carbondesignsystem.com/patterns/status-indicator-pattern/), [WCAG color requirements](https://webaim.org/articles/contrast/)

### Pitfall 5: Mobile Drag-Drop Expectations

**What goes wrong:** Desktop drag-drop pattern doesn't work on mobile; users can't reorder cards.

**Why it happens:** Touch events don't trigger HTML5 drag API consistently across browsers.

**How to avoid:**
- Existing pattern: show up/down arrow buttons on mobile (Settings.jsx lines 670-687)
- Keep drag handles hidden on mobile: `className="hidden sm:block"`
- Test touch interactions separately from mouse interactions

**Warning signs:** Cards won't drag on mobile; gestures trigger scroll instead; touch events not registering.

### Pitfall 6: Time-Based Greeting Race Condition

**What goes wrong:** "Good morning/afternoon/evening" greeting shows wrong time period briefly on load.

**Why it happens:** Initial render uses server time or stale state before user timezone loads.

**How to avoid:**
- Use getUserTimezone() from dateFormatting.js immediately
- Don't show greeting until timezone is loaded: `{timezone && <Greeting />}`
- Cache timezone in localStorage so it's available on first render

**Warning signs:** Greeting flashes wrong value; timezone undefined errors; server time used instead of user time.

### Pitfall 7: Widget Config Mutation

**What goes wrong:** Directly mutating widget config objects causes React state bugs and profile corruption.

**Why it happens:** Config objects from getDashboardCardSettings() are shared references.

**How to avoid:**
- Always spread/clone before modifying: `const updated = { ...card, visible: !card.visible }`
- Use saveDashboardCardSettings() after every change
- Don't pass config objects as mutable props

**Warning signs:** Changes don't persist; multiple widgets change together; profile switching corrupts settings.

## Code Examples

Verified patterns from official sources:

### Reptile Status Card Grid with Auto-Compact

```javascript
// ReptileStatusCards.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import ReptileAvatar from '../ReptileAvatar';

export default function ReptileStatusCards({ config, size }) {
  const [reptiles, setReptiles] = useState([]);
  const [isCompact, setIsCompact] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const threshold = config?.compactThreshold || 6;

  useEffect(() => {
    const fetchReptiles = async () => {
      const res = await axios.get('/api/reptiles');
      setReptiles(res.data);
      setIsCompact(res.data.length >= threshold);
    };
    fetchReptiles();
  }, [threshold]);

  const handleReorder = (fromIndex, toIndex) => {
    const reordered = [...reptiles];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setReptiles(reordered);
    // Optional: persist order to backend or localStorage
  };

  const getSizeClasses = () => {
    const sizeMap = {
      xs: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      small: 'grid-cols-1 sm:grid-cols-2',
      medium: 'grid-cols-1 lg:grid-cols-3',
      large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2'
    };
    return sizeMap[size] || sizeMap.large;
  };

  return (
    <div className={`grid gap-3 ${getSizeClasses()}`}>
      {reptiles.map((reptile, index) => (
        <ReptileCard
          key={reptile.id}
          reptile={reptile}
          index={index}
          isCompact={isCompact}
          config={config}
          onReorder={handleReorder}
          isDragging={draggedIndex === index}
          onDragStart={() => setDraggedIndex(index)}
          onDragEnd={() => setDraggedIndex(null)}
        />
      ))}
    </div>
  );
}

function ReptileCard({
  reptile,
  index,
  isCompact,
  config,
  onReorder,
  isDragging,
  onDragStart,
  onDragEnd
}) {
  const handleDragStart = (e) => {
    onDragStart();
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('index'));
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onReorder(fromIndex, index);
    }
  };

  const getStatusColor = () => {
    if (reptile.overdueTasks > 0) return 'border-status-overdue';
    if (reptile.dueTasks > 0) return 'border-status-due';
    return 'border-accent-600';
  };

  if (isCompact) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          handleDragStart(e);
          e.dataTransfer.setData('index', index);
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        className={`
          relative p-3 rounded-xl border-2 ${getStatusColor()}
          bg-surface-800 hover:border-accent-500
          cursor-move transition-all
          ${isDragging ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <ReptileAvatar
            reptile={reptile}
            size="md"
            showStatusDot={true}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">
              {reptile.name}
            </h3>
            <p className="text-xs text-gray-400">
              {reptile.species}
            </p>
          </div>
          <StatusIndicatorDot tasks={reptile.tasks} />
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <div
      draggable
      onDragStart={(e) => {
        handleDragStart(e);
        e.dataTransfer.setData('index', index);
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={`
        relative p-4 rounded-xl border-2 ${getStatusColor()}
        bg-surface-800 hover:border-accent-500
        cursor-pointer transition-all
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <div className="flex gap-3 mb-3">
        <ReptileAvatar
          reptile={reptile}
          size="lg"
          showStatusDot={true}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-white">{reptile.name}</h3>
            {config?.showAge && (
              <span className="text-xs text-gray-500">
                {reptile.age}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-2">{reptile.species}</p>

          {/* Quick stats */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span>🍽️</span>
              <span className="text-gray-400">
                {reptile.lastFed ? `${reptile.daysSinceLastFed}d ago` : 'Never'}
              </span>
            </div>
            {config?.showWeight && reptile.lastWeight && (
              <div className="flex items-center gap-1">
                <span>⚖️</span>
                <span className="text-gray-400">{reptile.lastWeight}g</span>
                {reptile.weightChange && (
                  <span className={`text-[10px] ${
                    reptile.weightChange > 0 ? 'text-accent-400' : 'text-status-due'
                  }`}>
                    {reptile.weightChange > 0 ? '↑' : '↓'}
                    {Math.abs(reptile.weightChange)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's tasks */}
      {reptile.todayTasks && reptile.todayTasks.length > 0 && (
        <div className="pt-3 border-t border-surface-600">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {reptile.todayTasks.slice(0, 3).map(task => (
              <TaskChip
                key={task.id}
                task={task}
                onClick={() => handleQuickLog(task)}
              />
            ))}
            {reptile.todayTasks.length > 3 && (
              <span className="px-1.5 py-0.5 rounded bg-surface-600 text-gray-400">
                +{reptile.todayTasks.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIndicatorDot({ tasks }) {
  const overdue = tasks.filter(t => t.status === 'overdue').length;
  const due = tasks.filter(t => t.status === 'due').length;
  const done = tasks.filter(t => t.status === 'done').length;

  const color = overdue > 0
    ? 'bg-status-overdue'
    : due > 0
    ? 'bg-status-due'
    : 'bg-status-done';

  return (
    <div className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-500">
        {overdue > 0 && `${overdue} overdue`}
        {due > 0 && !overdue && `${due} due`}
        {done > 0 && !due && !overdue && `${done} done`}
      </span>
    </div>
  );
}

function TaskChip({ task, onClick }) {
  const statusStyles = {
    done: 'bg-status-done/20 text-status-done',
    due: 'bg-surface-600 text-gray-400',
    overdue: 'bg-status-overdue/20 text-status-overdue'
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        px-1.5 py-0.5 rounded text-xs
        ${statusStyles[task.status]}
        hover:opacity-80 transition-opacity
      `}
    >
      {task.status === 'done' && '✓ '}
      {task.name}
      {task.time && ` ${task.time}`}
    </button>
  );
}
```

Source: Mockup design patterns + existing Dashboard.jsx + Tailwind responsive grids

### Today's Schedule Timeline with Auto-Scroll

```javascript
// TodayScheduleTimeline.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { formatTime } from '../utils/dateFormatting';

export default function TodayScheduleTimeline({ config, size }) {
  const [schedules, setSchedules] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set(['completed']));
  const [activeFilters, setActiveFilters] = useState(() => {
    const saved = localStorage.getItem('timeline_filters');
    return saved ? JSON.parse(saved) : ['feeding', 'misting', 'health'];
  });
  const currentTimeRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const fetchSchedules = async () => {
      const res = await axios.get('/api/schedules/today');
      setSchedules(res.data);
    };
    fetchSchedules();
  }, []);

  useEffect(() => {
    localStorage.setItem('timeline_filters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  useEffect(() => {
    if (config?.autoScrollToCurrent && currentTimeRef.current && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        currentTimeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      });
    }
  }, [schedules, config?.autoScrollToCurrent]);

  const toggleFilter = (type) => {
    setActiveFilters(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const filteredSchedules = schedules.filter(s =>
    activeFilters.includes(s.type)
  );

  const groupedByTime = filteredSchedules.reduce((acc, schedule) => {
    const timeSlot = getTimeSlot(schedule.scheduledTime);
    if (!acc[timeSlot]) acc[timeSlot] = [];
    acc[timeSlot].push(schedule);
    return acc;
  }, {});

  const completedTasks = filteredSchedules.filter(s => s.completed);
  const upcomingTasks = filteredSchedules.filter(s => !s.completed);
  const allDone = upcomingTasks.length === 0 && completedTasks.length > 0;

  return (
    <div className="space-y-3">
      {/* Filter buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {['feeding', 'misting', 'health'].map(type => (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className={`
              px-3 py-1 rounded-lg text-xs font-medium
              transition-colors
              ${activeFilters.includes(type)
                ? 'bg-primary text-white'
                : 'bg-surface-700 text-gray-400 hover:bg-surface-600'
              }
            `}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto max-h-96 space-y-2"
      >
        {/* Completed section */}
        {completedTasks.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => toggleGroup('completed')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300"
            >
              <span className={`transform transition-transform ${
                expandedGroups.has('completed') ? 'rotate-90' : ''
              }`}>
                ▶
              </span>
              <span>{completedTasks.length} completed</span>
            </button>
            {expandedGroups.has('completed') && (
              <div className="ml-6 mt-2 space-y-1">
                {completedTasks.map(task => (
                  <TimelineTask key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* All done celebration */}
        {allDone && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-lg font-semibold text-accent-400">
              All done for today!
            </p>
            <p className="text-sm text-gray-500">
              Great job taking care of your reptiles
            </p>
          </div>
        )}

        {/* Upcoming time slots */}
        {Object.entries(groupedByTime)
          .filter(([_, tasks]) => tasks.some(t => !t.completed))
          .map(([timeSlot, tasks]) => {
            const isCurrentSlot = isCurrentTimeSlot(timeSlot);
            const incompleteTasks = tasks.filter(t => !t.completed);

            return (
              <div
                key={timeSlot}
                ref={isCurrentSlot ? currentTimeRef : null}
                className={`
                  pl-3 border-l-2 transition-colors
                  ${isCurrentSlot
                    ? 'border-status-due'
                    : incompleteTasks.some(t => t.isOverdue)
                    ? 'border-status-overdue'
                    : 'border-surface-600'
                  }
                `}
              >
                <div className="text-[10px] text-gray-500 mb-1">
                  {timeSlot}
                </div>
                <div className="space-y-1">
                  {incompleteTasks.map(task => (
                    <TimelineTask key={task.id} task={task} />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function TimelineTask({ task }) {
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [hovering, setHovering] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex items-center gap-2 py-1">
        <img
          src={task.reptile.avatar}
          alt={task.reptile.name}
          className="w-4 h-4 rounded"
        />
        <span className="text-xs text-gray-300 flex-1">
          {task.reptile.name} - {task.name}
        </span>

        {task.completed ? (
          <span className="text-status-done text-xs">✓</span>
        ) : (
          <button
            onClick={() => setShowQuickLog(!showQuickLog)}
            className="text-xs px-2 py-0.5 rounded bg-accent-600 hover:bg-accent-500 text-white"
          >
            Log
          </button>
        )}
      </div>

      {/* Hover tooltip */}
      {hovering && task.notes && (
        <div className="absolute left-0 top-full mt-1 z-10 p-2 bg-surface-700 rounded shadow-lg text-xs text-gray-300 max-w-xs">
          <div className="font-semibold mb-1">Notes:</div>
          <div>{task.notes}</div>
          {task.supplements && (
            <div className="mt-1 text-gray-400">
              Supplements: {task.supplements.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Inline quick log form */}
      {showQuickLog && (
        <QuickLogForm
          task={task}
          onClose={() => setShowQuickLog(false)}
          onSubmit={async (data) => {
            await axios.post(`/api/schedules/${task.id}/log`, data);
            setShowQuickLog(false);
            // Refresh schedules
          }}
        />
      )}
    </div>
  );
}

function QuickLogForm({ task, onClose, onSubmit }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        notes,
        completedAt: new Date().toISOString(),
        // Auto-fill from schedule instance
        supplements: task.defaultSupplements,
        foodCategory: task.defaultFoodCategory
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 ml-6 p-3 bg-surface-700 rounded-lg">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Quick notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any observations?"
            className="input w-full text-xs"
          />
        </div>

        {/* Show auto-filled data */}
        {task.defaultSupplements && (
          <div className="text-xs text-gray-500">
            Supplements: {task.defaultSupplements.join(', ')}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary text-xs"
          >
            {loading ? 'Logging...' : 'Log'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              // Navigate to full log view
              window.location.href = `/feed?scheduleId=${task.id}`;
            }}
            className="text-xs text-accent-400 hover:text-accent-300"
          >
            Open full form
          </button>
        </div>
      </form>
    </div>
  );
}

function getTimeSlot(time) {
  const hour = new Date(time).getHours();
  if (hour < 7) return '00:00 - 06:59';
  if (hour < 12) return '07:00 - 11:59';
  if (hour < 18) return '12:00 - 17:59';
  return '18:00 - 23:59';
}

function isCurrentTimeSlot(slot) {
  const now = new Date();
  const hour = now.getHours();
  const [start, end] = slot.split(' - ').map(t => {
    const [h] = t.split(':');
    return parseInt(h);
  });
  return hour >= start && hour <= end;
}
```

Source: Existing Dashboard.jsx patterns + mockup timeline design + schedule instance auto-fill

### Sparkline Weight Trends

```javascript
// WeeklyTrendsSummary.jsx
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export default function WeeklyTrendsSummary({ config, size }) {
  const [trends, setTrends] = useState([]);

  useEffect(() => {
    const fetchTrends = async () => {
      const res = await axios.get('/api/reptiles/weight-trends', {
        params: { days: 90 }
      });
      setTrends(res.data);
    };
    fetchTrends();
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Weight Trends</h2>

      {trends.map(trend => (
        <div key={trend.reptileId} className="flex items-center gap-3">
          <img
            src={trend.avatar}
            alt={trend.name}
            className="w-6 h-6 rounded"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-300">{trend.name}</span>
              <span className="text-xs font-medium text-white">
                {trend.currentWeight}g
              </span>
            </div>
            {/* Sparkline */}
            <ResponsiveContainer width="100%" height={16}>
              <LineChart data={trend.data}>
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <span className={`text-xs ${
            trend.changePercent > 0 ? 'text-accent-400' : 'text-status-due'
          }`}>
            {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
          </span>
        </div>
      ))}
    </div>
  );
}
```

Source: [Recharts minimal LineChart](https://recharts.org/en-US/examples/SimpleLineChart) + mockup sparkline design

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External drag-drop libraries | Native HTML5 drag API + pointer events | 2026 | Simpler, more React-friendly, better mobile support with fallback UI |
| Framer Motion v11 | Framer Motion v12 (Motion) | January 2026 | No breaking changes, improved layout animations, rebranded as "Motion" |
| Single global profile | Desktop + mobile profiles | Existing codebase | Users can have different layouts per device type |
| Imperative scrollIntoView | requestAnimationFrame + smooth behavior | Modern browsers | Prevents layout thrashing, smoother animations |
| Color-only status | Color + icon + text pattern | WCAG 2.1 | Accessibility requirement, 3:1 contrast ratio for non-text |

**Deprecated/outdated:**
- react-dnd, dnd-kit: Codebase uses native API successfully; external libraries add complexity
- Redux for widget state: localStorage + displaySettings.js handles persistence without boilerplate
- Separate mobile/desktop components: Tailwind responsive classes handle layout adaptation

## Open Questions

1. **Database sync for widget preferences**
   - What we know: User already has backend preference storage; localStorage works for temporary state
   - What's unclear: Should widget order/visibility sync via database API or stay client-only?
   - Recommendation: Keep widget config in localStorage (fast, works offline); sync display profile selections to database (cross-device consistency)

2. **Multiple widget instances**
   - What we know: System supports adding/hiding widgets by ID; could allow duplicate IDs with unique keys
   - What's unclear: Does user need two "Recent Activity" widgets with different filters, or is one with configurable filters enough?
   - Recommendation: Start with single instance per widget type with per-widget config; add multi-instance support if users request specific use case

3. **Compact mode threshold**
   - What we know: User wants auto-trigger at 6+ reptiles; existing card can be user-configurable
   - What's unclear: Should threshold be global setting or per-widget config?
   - Recommendation: Per-widget config (part of widget settings in edit mode); default 6, allow user to customize

4. **Quick-view panel vs inline expand**
   - What we know: Both patterns work; mockup shows inline expansion feel
   - What's unclear: Performance implications with many cards (12+ reptiles)?
   - Recommendation: Inline expand for ≤12 reptiles (simpler, matches mockup); side panel for >12 (prevents card overflow); test performance with real data

## Sources

### Primary (HIGH confidence)

- Existing codebase:
  - `/frontend/src/utils/displaySettings.js` - Complete widget system (859 lines)
  - `/frontend/src/pages/Dashboard.jsx` - Current dashboard implementation
  - `/frontend/src/pages/Settings.jsx` - Widget customization UI
  - `/frontend/src/components/Layout.jsx` - Sidebar/header structure
  - `/frontend/package.json` - Confirmed library versions
  - `.planning/mockups/dashboard-v1.1-concept.html` - Visual design reference

### Secondary (MEDIUM confidence)

- [React Design Patterns 2026](https://www.patterns.dev/react/react-2026/) - Component architecture patterns
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode) - Official dark mode implementation
- [Tailwind Grid Responsive Layouts](https://codeparrot.ai/blogs/mastering-responsive-layouts-with-tailwind-grid-in-react) - Grid system patterns
- [Recharts Documentation](https://recharts.org/) - Chart library API
- [Framer Motion AnimatePresence](https://medium.com/@triplem656/effortful-react-list-animations-a-guide-to-framer-motions-animatepresence-27a9cea4d058) - Add/remove animations
- [React Drag-Drop Native API](https://medium.com/nerd-for-tech/simple-drag-and-drop-in-react-without-an-external-library-ebf1c1b809e) - HTML5 drag patterns
- [React Keyboard Shortcuts](https://devtrium.com/posts/how-keyboard-shortcut) - Global shortcut handling
- [localStorage Persistence Patterns](https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/) - State persistence best practices
- [Status Indicator Accessibility](https://carbondesignsystem.com/patterns/status-indicator-pattern/) - Color + icon requirements
- [WCAG Contrast Requirements](https://webaim.org/articles/contrast/) - 3:1 non-text contrast standard

### Tertiary (LOW confidence)

- React timeline libraries - specific to timeline component (validated against existing Dashboard patterns)
- Bryntum/Mobiscroll schedulers - commercial solutions (not needed; building custom with existing patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, versions confirmed
- Architecture: HIGH - Existing displaySettings.js provides proven patterns to follow
- Pitfalls: HIGH - Based on codebase analysis + accessibility standards
- Code examples: MEDIUM - Synthesized from mockup + existing patterns + library docs

**Research date:** 2026-02-08
**Valid until:** ~30 days (stable stack; no breaking changes expected in dependencies based on changelog review)
