# Frontend Implementation TODO

The frontend structure has been created but needs the following components to be fully implemented:

## Components to Create

### Layout Components
- `src/components/Layout.jsx` - Main layout with navigation
- `src/components/Navigation.jsx` - Nav bar with mobile menu
- `src/components/Header.jsx` - Page header component

### Page Components
- `src/pages/Login.jsx` - Login page with OIDC button
- `src/pages/AuthCallback.jsx` - OAuth callback handler
- `src/pages/Dashboard.jsx` - Dashboard overview
- `src/pages/ReptileList.jsx` - Grid/list of all reptiles
- `src/pages/ReptileDetail.jsx` - Detailed reptile view with tabs
- `src/pages/FeedingLog.jsx` - Quick feeding log interface

### Feature Components
- `src/components/FeedingForm.jsx` - Form with +/- counter buttons
- `src/components/SaladPicker.jsx` - Bring-app style grid selector
- `src/components/WeightChart.jsx` - Recharts line chart
- `src/components/Calendar.jsx` - Calendar view using react-calendar
- `src/components/ReptileCard.jsx` - Card component for reptile display
- `src/components/FeedingHistory.jsx` - List of feeding logs
- `src/components/StatsSummary.jsx` - Statistics dashboard

### Services
- `src/services/api.js` - Axios API client
- `src/services/auth.js` - Authentication service
- `src/services/reptiles.js` - Reptile CRUD operations
- `src/services/feedings.js` - Feeding operations
- `src/services/stats.js` - Statistics fetching

### Hooks
- `src/hooks/useReptiles.js` - Fetch and manage reptiles
- `src/hooks/useFeedings.js` - Fetch and manage feedings
- `src/hooks/useFoods.js` - Fetch foods and supplements
- `src/hooks/useStats.js` - Fetch statistics

## Key Features to Implement

### 1. Feeding Form (+/- Buttons)
```jsx
// Large touch-friendly buttons for counting insects while feeding
<div className="flex items-center gap-4">
  <button className="counter-button bg-red-500 text-white">-</button>
  <input type="number" value={count} className="text-center text-3xl w-20" />
  <button className="counter-button bg-green-500 text-white">+</button>
</div>
```

### 2. Salad Component Picker (Bring-app style)
```jsx
// Grid of checkboxes with images/icons for quick selection
<div className="grid grid-cols-3 gap-4">
  {saladComponents.map(component => (
    <button
      key={component.id}
      className={`card p-4 ${selected ? 'ring-2 ring-primary-500' : ''}`}
    >
      <div className="text-4xl mb-2">{component.icon}</div>
      <div className="text-sm">{component.name}</div>
    </button>
  ))}
</div>
```

### 3. Weight Chart
```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

<LineChart data={weightData}>
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="weight" stroke="#22c55e" />
</LineChart>
```

### 4. Calendar View
```jsx
import Calendar from 'react-calendar'

<Calendar
  tileContent={({ date }) => {
    const feeding = feedingsOnDate(date)
    return feeding ? <div className="text-xs">🦎</div> : null
  }}
/>
```

### 5. Mobile-First Design
- Use Tailwind's responsive classes (`sm:`, `md:`, `lg:`)
- Bottom navigation for mobile
- Swipe gestures for navigation
- Large tap targets (min 44x44px)
- Sticky headers for easy access

### 6. Progressive Web App (PWA)
- Add service worker for offline support
- Create manifest.json for install prompt
- Cache API responses
- Background sync for feedings

## Implementation Priority

1. **Critical Path** (MVP):
   - Login/Auth (Login.jsx, AuthCallback.jsx)
   - Layout with navigation
   - Reptile list and detail pages
   - Basic feeding form with counter
   - API services

2. **Phase 2**:
   - Salad picker component
   - Weight tracking with chart
   - Calendar view
   - Statistics dashboard

3. **Phase 3**:
   - Health records
   - Notifications settings
   - Access control management
   - PWA features

## Testing
- Test on mobile devices (iOS Safari, Android Chrome)
- Test touch interactions
- Test offline mode
- Test with multiple users

## Notes
- Use React Query or SWR for data fetching and caching
- Consider adding Zustand or Context for global state
- Add error boundaries for better error handling
- Implement loading skeletons for better UX
