---
phase: 35
plan: 02
subsystem: frontend
tags: [react-query, modal, cache-invalidation, ux]
dependency_graph:
  requires: [35-01]
  provides: [global-create-modal, header-cache-invalidation]
  affects: [apps/reptile-tracker/frontend/src/App.jsx, apps/reptile-tracker/frontend/src/components/QuickStatsHeader.jsx]
tech_stack:
  added: []
  patterns: [useQuery-for-dashboard-stats, queryClient-invalidation-on-submit, close-on-navigation]
key_files:
  created: []
  modified:
    - apps/reptile-tracker/frontend/src/contexts/CreateLogModalContext.jsx
    - apps/reptile-tracker/frontend/src/App.jsx
    - apps/reptile-tracker/frontend/src/pages/Dashboard.jsx
    - apps/reptile-tracker/frontend/src/components/modals/CreateLogModal.jsx
    - apps/reptile-tracker/frontend/src/components/QuickStatsHeader.jsx
    - apps/reptile-tracker/frontend/src/components/UserStreakDisplay.jsx
decisions:
  - "CreateLogModalContext now manages state directly (no registration pattern)"
  - "CreateLogModalManager renders modal at App.jsx level, inside CreateLogModalProvider"
  - "Dashboard.jsx delegates to context's openCreateLog instead of local state"
  - "useLocation + prevPathRef pattern closes modal on URL change"
  - "Query keys use ['dashboard', 'quickStats'] and ['dashboard', 'userStreak'] prefixes"
  - "invalidateQueries(['dashboard']) in CreateLogModal invalidates both header queries"
metrics:
  duration: 5m
  completed: 2026-06-08
---

# Phase 35 Plan 02: Header Stats Refresh Summary

Global CreateLogModal mounted at App.jsx level for any-page access, header stats converted to React Query with cache invalidation triggering immediate refresh after task completion.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Simplify CreateLogModalContext and mount modal in App.jsx | 71ea6a8d2 | Removed registration pattern, added CreateLogModalManager, Dashboard uses context |
| 2 | Add close-on-navigation to CreateLogModal | a6e6f3b41 | useLocation + prevPathRef pattern closes modal on URL change |
| 3 | Convert QuickStatsHeader and UserStreakDisplay to React Query | b8e6b3a1f | useQuery with cache invalidation, CreateLogModal invalidates on submit |

## Implementation Details

### CreateLogModal at App Level (D-01, D-02)

Refactored CreateLogModalContext.jsx to manage state directly:
```javascript
const [open, setOpen] = useState(false);
const [logType, setLogType] = useState('feeding');
const [reptileId, setReptileId] = useState(null);
const [prefillData, setPrefillData] = useState(null);

const openCreateLog = useCallback((type, reptile = null, prefill = null) => {
  setLogType(type || 'feeding');
  setReptileId(reptile);
  setPrefillData(prefill);
  setOpen(true);
}, []);
```

App.jsx now renders CreateLogModalManager at the Layout level:
```jsx
<Route element={
  <CreateLogModalProvider>
    <Layout user={user} onLogout={handleLogout} />
    <CreateLogModalManager />
  </CreateLogModalProvider>
}>
```

### Close on Navigation (D-03)

CreateLogModal.jsx uses useLocation to detect URL changes:
```javascript
const location = useLocation();
const prevPathRef = useRef(location.pathname);

useEffect(() => {
  if (prevPathRef.current !== location.pathname && open) {
    onOpenChange?.(false);
  }
  prevPathRef.current = location.pathname;
}, [location.pathname, open, onOpenChange]);
```

### React Query Cache Invalidation (D-04, D-05, D-06)

QuickStatsHeader.jsx converted to useQuery:
```javascript
const { data: weeklyInstances = [], isLoading: loading } = useQuery({
  queryKey: ['dashboard', 'quickStats'],
  queryFn: fetchQuickStats,
  refetchInterval: 5 * 60 * 1000,
});
```

UserStreakDisplay.jsx converted to useQuery with invalidation:
```javascript
const { data: streak, isLoading: loading, isError: error } = useQuery({
  queryKey: ['dashboard', 'userStreak'],
  queryFn: fetchUserStreak,
  refetchInterval: 5 * 60 * 1000,
});

// In task-completed event handler:
queryClient.invalidateQueries({ queryKey: ['dashboard'] });
```

CreateLogModal.jsx invalidates dashboard queries after submission:
```javascript
// After successful API response
queryClient.invalidateQueries({ queryKey: ['dashboard'] });
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] CreateLogModalContext.jsx no longer has registerOpener/unregisterOpener exports
- [x] CreateLogModalContext.jsx manages open, logType, reptileId, prefillData state
- [x] CreateLogModalContext.jsx exports openCreateLog and closeCreateLog
- [x] App.jsx imports and renders CreateLogModal inside CreateLogModalProvider
- [x] Dashboard.jsx no longer uses useCreateLogModalRegistration
- [x] Dashboard.jsx no longer renders CreateLogModal
- [x] CreateLogModal imports useLocation and has prevPathRef
- [x] CreateLogModal has useEffect that closes modal on pathname change
- [x] QuickStatsHeader.jsx uses useQuery with queryKey ['dashboard', 'quickStats']
- [x] QuickStatsHeader.jsx no longer uses useState for weeklyInstances or manual setInterval
- [x] UserStreakDisplay.jsx uses useQuery with queryKey ['dashboard', 'userStreak']
- [x] UserStreakDisplay.jsx task-completed listener calls invalidateQueries
- [x] CreateLogModal.jsx imports useQueryClient and calls invalidateQueries after submission

## Self-Check: PASSED

All files verified to exist:
- `apps/reptile-tracker/frontend/src/contexts/CreateLogModalContext.jsx` - FOUND
- `apps/reptile-tracker/frontend/src/App.jsx` - FOUND
- `apps/reptile-tracker/frontend/src/pages/Dashboard.jsx` - FOUND
- `apps/reptile-tracker/frontend/src/components/modals/CreateLogModal.jsx` - FOUND
- `apps/reptile-tracker/frontend/src/components/QuickStatsHeader.jsx` - FOUND
- `apps/reptile-tracker/frontend/src/components/UserStreakDisplay.jsx` - FOUND

All commits verified:
- `71ea6a8d2` - FOUND
- `a6e6f3b41` - FOUND
- `b8e6b3a1f` - FOUND
