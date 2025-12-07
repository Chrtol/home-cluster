# Display Profiles System

## Overview

The Display Profiles system allows users to save, manage, and switch between different dashboard and statistics page layouts. This feature enables users to:

- Create multiple named profiles with different card/chart configurations
- Quickly switch between different layouts for different use cases
- Export and import individual profiles
- Update profiles with current settings
- Duplicate and rename profiles

## User Features

### Profile Management

**Location:** Settings > Display tab

#### Creating a Profile

1. Configure your dashboard and statistics pages to your preferred layout
2. Go to Settings > Display > Display Profiles section
3. Click "Create Profile" button
4. Enter a name for your profile
5. Select target from dropdown:
   - **Desktop & Mobile** - Set as active for both platforms
   - **Desktop only** - Set as active desktop profile
   - **Mobile only** - Set as active mobile profile
6. Click "Create"

Your current dashboard cards, statistics charts, chart appearance settings, and weight interpolation mode will be saved to the new profile.

#### Switching Profiles

1. Go to Settings > Display > Display Profiles section
2. Find the profile you want to use
3. Click "Desktop" button to set as desktop profile, or "Mobile" button to set as mobile profile
   - Active profiles are indicated with colored badges:
     - **Blue badge with Monitor icon** - Active for desktop (≥768px)
     - **Green badge with Smartphone icon** - Active for mobile (<768px)

All your dashboard and statistics settings will immediately change to match the selected profile.

**Dual Profile System:**
The system maintains separate active profiles for desktop and mobile views:
- **Desktop Profile**: Active when screen width is 768px or wider (default: Standard)
- **Mobile Profile**: Active when screen width is below 768px (default: Mobile)
- You can configure both desktop and mobile profiles independently from any device
- When you set a profile as mobile, its settings are applied so you can configure it from desktop
- This allows you to have different optimized layouts for desktop and mobile without manual switching

#### Updating a Profile

When you make changes to your dashboard or statistics layout and want to save those changes to the currently active profile:

1. Go to Settings > Display > Display Profiles section
2. Find the active profile (marked with "Active" badge)
3. Click the Save icon button
4. Confirm the update

The profile will be updated with your current settings.

#### Renaming a Profile

1. Find the profile in the list
2. Click the Edit icon (pencil)
3. Type the new name
4. Press Enter or click the checkmark icon

#### Duplicating a Profile

1. Find the profile you want to duplicate
2. Click the Copy icon
3. Enter a name for the duplicated profile
4. The new profile will be created with the same settings

#### Deleting a Profile

1. Find the profile you want to delete
2. Click the Trash icon
3. Confirm deletion

**Note:** Built-in profiles (Standard, Compact, and Mobile) cannot be deleted.

#### Exporting a Profile

1. Find the profile you want to export
2. Click the Download icon
3. A JSON file will be downloaded with the profile data

This file can be shared with others or used to backup individual profiles.

#### Importing a Profile

1. Click "Import Profile" button at the top of the Display Profiles section
2. Select a profile JSON file (exported from another instance or device)
3. Enter a name for the imported profile
4. Click OK

The profile will be added to your list of available profiles.

### Available Dashboard Cards

The system includes the following dashboard cards that can be shown/hidden and reordered:

**Current Dashboard Cards:**
- **Today Summary** - Summary statistics for today's activities (type: summary)
- **Weekly Calendar** - Calendar view with schedules and completed activities (type: content)
- **Weight Tracking** - Weight chart with feeding data overlay (type: content)
- **Your Reptiles** - Cards for each reptile with quick stats (type: content)
- **Recent Activity** - Timeline of recent feedings, health records, etc. (type: content)

**Card Customization:**
All cards can be:
- Shown or hidden using the eye icon
- Reordered via drag-and-drop on desktop (≥768px), or up/down arrows on mobile (<768px)
- Resized (XS, S, M, L sizes)
- Saved to different profiles

**Additional Dashboard Cards (disabled by default):**
- **Weekly Summary** - Weekly activity summary statistics (type: summary)
- **Health Summary** - Health-focused summary across reptiles (type: summary)
- **Schedule Summary** - Upcoming and overdue schedule items (type: summary)

These additional cards can be enabled in Settings > Display > Dashboard Layout.

### Use Cases for Multiple Profiles

**Built-in Profiles:**
- **Standard**: Balanced layout for desktop use with full-width calendar and activity
- **Compact**: Space-efficient layout prioritizing recent activity
- **Mobile**: Optimized for mobile devices with full-width cards and 1-day calendar

**Custom Profile Examples:**

**Example 1: Minimal Profile**
- Only Today Summary (L) and Reptile Cards (L)
- Perfect for quick daily checks on mobile

**Example 2: Weight Focus Profile**
- Today Summary (L)
- Weight Chart (L)
- Reptile Cards (S)
- Recent Activity (M)
- Weekly Calendar hidden
- Ideal during breeding season when monitoring weight closely

**Example 3: Mobile Optimized**
- All cards set to Large (full-width)
- Cards reordered by priority for one-handed scrolling
- Weight chart hidden to reduce scrolling

**Example 4: Desktop Multi-Column**
- Mix of XS, S, M sizes to create multi-column layout
- Maximizes screen real estate on wide monitors

## Technical Implementation

### Architecture

The Display Profiles system is built on top of the existing display settings infrastructure:

**File Structure:**
```
frontend/src/
├── utils/
│   └── displaySettings.js          # Profile management functions
├── components/
│   └── ProfileManager.jsx          # Profile UI component
└── pages/
    └── Settings.jsx                # Integration point
```

### Data Storage

Profiles are stored in `localStorage` with the following structure:

**Storage Keys:**
- `display_profiles` - Array of profile objects
- `active_desktop_profile_id` - ID of active profile for desktop (≥768px width)
- `active_mobile_profile_id` - ID of active profile for mobile (<768px width)

**Profile Object Structure:**
```javascript
{
  id: string,                        // Unique identifier
  name: string,                      // User-defined name
  dashboard_cards: array,            // Dashboard card configuration
  statistics_charts: array,          // Statistics chart configuration
  chart_settings: object,            // Chart appearance settings
  weight_interpolation_mode: string, // 'linear' | 'step' | 'none'
  created_at: ISO timestamp,
  updated_at: ISO timestamp,
  isDefault: boolean                 // True only for default profile
}
```

### Core Functions

**displaySettings.js exports:**

```javascript
// Profile Management
getDisplayProfiles()                // Get all profiles
getActiveProfileId()                // Get active profile ID (auto-detects desktop/mobile)
getActiveDesktopProfileId()         // Get desktop profile ID
getActiveMobileProfileId()          // Get mobile profile ID
getActiveProfile()                  // Get active profile object
setActiveProfileId(profileId, isMobile) // Set active profile for desktop or mobile
isMobileScreen()                    // Check if screen width < 768px
createProfileFromCurrent(name)      // Create new profile
applyProfile(profileId)             // Switch to a profile
updateProfileWithCurrent(profileId) // Update profile with current settings

// Profile Operations
renameProfile(profileId, newName)   // Rename a profile
duplicateProfile(profileId, newName)// Duplicate a profile
deleteProfile(profileId)            // Delete a profile (not built-in)

// Import/Export
exportProfile(profileId)            // Export single profile as JSON
importProfile(data, customName)     // Import profile from JSON

// Dashboard Cards
getDashboardCardSettings()          // Get current dashboard cards
saveDashboardCardSettings(cards)    // Save dashboard card configuration
isCalendarExtraSmall()              // Check if weekly calendar card is XS size

// Statistics Charts
getStatisticsChartSettings(reptileId) // Get statistics charts (global or per-reptile)
saveStatisticsChartSettings(charts, reptileId) // Save charts configuration
```

### Built-in Profiles

The system includes three built-in profiles that always exist:

**Standard Profile** (Default Desktop):
- Balanced layout for desktop use with full-width calendar and activity
- Today Summary: Large
- Weekly Calendar: Large
- Weight Tracking: Medium
- Your Reptiles: Extra Small
- Recent Activity: Large

**Compact Profile:**
- Space-efficient layout prioritizing recent activity
- Today Summary: Large
- Recent Activity: Medium
- Weekly Calendar: Extra Small
- Weight Tracking: Medium
- Your Reptiles: Extra Small

**Mobile Profile** (Default Mobile):
- Optimized for mobile devices with full-width cards
- Today Summary: Large
- Your Reptiles: Large
- Recent Activity: Large
- Weekly Calendar: Extra Small (1-day view only, 3d/7d buttons hidden)
- Weight Tracking: Large

All built-in profiles:
- Created automatically on first use
- Cannot be deleted (only custom profiles can be deleted)
- Can be updated with Save button when active
- Standard profile is the default active desktop profile for new users
- Mobile profile is the default active mobile profile for new users
- Used as fallback if active profile is deleted

### Integration with Existing Features

**Per-Reptile Statistics Settings:**
- Profiles store GLOBAL statistics settings only
- Per-reptile custom layouts are separate from profiles
- When switching profiles, per-reptile settings are preserved

**Export/Import Compatibility:**
- Full settings export (Settings > Display > Export Display Settings) exports everything including all profiles
- Individual profile export creates a smaller, portable profile file
- Import function automatically detects file type and handles accordingly

### Profile Export Format

**Individual Profile Export:**
```json
{
  "version": "1.0",
  "type": "display_profile",
  "exported_at": "2025-01-01T00:00:00.000Z",
  "profile": {
    "name": "Profile Name",
    "dashboard_cards": [...],
    "statistics_charts": [...],
    "chart_settings": {...},
    "weight_interpolation_mode": "linear"
  }
}
```

**Full Settings Export** (includes all profiles):
```json
{
  "version": "1.0",
  "exported_at": "2025-01-01T00:00:00.000Z",
  "settings": {
    "dashboard_cards": [...],
    "statistics_charts": [...],
    "chart_settings": {...},
    "weight_interpolation_mode": "linear",
    "timeFormat": "24h",
    "dateFormat": "YYYY-MM-DD",
    // ... other settings
  }
}
```

### State Management

**Profile Switching Flow:**
1. User clicks "Switch" on a profile
2. `applyProfile(profileId)` is called
3. System detects screen size using `isMobileScreen()` (checks if width < 768px)
4. Profile settings are loaded from `display_profiles` storage
5. Settings are written to individual localStorage keys:
   - `dashboard_cards`
   - `statistics_charts`
   - `chart_settings`
   - `weight_interpolation_mode`
6. Active profile ID is updated in `active_desktop_profile_id` or `active_mobile_profile_id` based on screen size
7. UI callback triggers component refresh
8. Dashboard and Statistics pages automatically load new settings

**Dual Profile System:**
The system maintains separate active profiles for desktop and mobile:
- `getActiveProfileId()` automatically returns the appropriate profile based on screen width
- When switching profiles, the system updates the correct storage key (desktop or mobile)
- If a profile is deleted and it's the active profile for either desktop or mobile, that platform falls back to its default (Standard for desktop, Mobile for mobile)
- This allows seamless transitions when resizing browser window or switching devices

### ProfileManager Component

**Props:**
- `onProfileChange(profileId)` - Callback when profile is switched

**Features:**
- Profile list with dual active indicators:
  - **Blue badge with Monitor icon** - Active desktop profile (≥768px)
  - **Green badge with Smartphone icon** - Active mobile profile (<768px)
- Separate "Desktop" and "Mobile" buttons to set active profiles for each platform
- Create new profile form with dropdown to select target (Desktop & Mobile, Desktop only, or Mobile only)
- Inline rename with Enter/Escape support
- In-app modal dialogs for all operations (no browser popups)
- File input for profile import
- Responsive design with mobile support

**Modal System:**
The ProfileManager uses a custom Modal component that replaces browser alert/confirm/prompt dialogs:
- **Confirmation modals** for delete, update operations
- **Input modals** for rename and import with auto-focus and Enter key support
- **Warning modals** for validation errors and file type mismatches
- **Danger styling** for destructive actions (red buttons for delete)
- **Type-based styling** (info, warning, danger, success) with colored icons
- Click outside modal does NOT close it (must use Cancel/X button)
- Keyboard support: Enter to confirm, Escape handled by child components

### Adding New Dashboard Cards

To add a new dashboard card option:

1. **Add to DEFAULT_DASHBOARD_CARDS** in `displaySettings.js`:
```javascript
{
  id: 'unique_card_id',
  label: 'Display Name',
  visible: false,           // Start hidden
  order: 10,                // Position in list
  size: 'medium',           // xs | small | medium | large
  type: 'content'           // summary | content
}
```

2. **Implement card in Dashboard.jsx**:
```javascript
{getDashboardCardSettings()
  .filter(card => card.visible && card.id === 'unique_card_id')
  .map(card => (
    <div key={card.id} className={cardSizeClasses[card.size]}>
      {/* Card content here */}
    </div>
  ))
}
```

3. **Add any special settings** (e.g., interpolation mode):
```javascript
{
  id: 'my_weight_chart',
  // ... other properties
  interpolationMode: 'linear'  // Only for weight-related charts
}
```

## Migration and Backwards Compatibility

### First-Time Profile Creation

When a user accesses the Display Profiles feature for the first time:
1. System checks for `display_profiles` in localStorage
2. If not found, creates Default profile with current settings
3. Sets Default profile as active
4. User's existing customizations are preserved

### Existing Settings

Users who have customized their dashboard/statistics before the profile system:
- Their settings are automatically migrated to the Default profile
- No manual migration required
- All existing functionality continues to work

## Performance Considerations

### Storage Size

- Each profile: ~5-15KB depending on number of cards/charts
- Recommended maximum: 20 profiles (~300KB total)
- localStorage limit: 5-10MB (browser dependent)

### Profile Switching

- Profile switching is near-instantaneous (< 50ms)
- No network requests involved
- Settings changes trigger component re-renders

### Memory Usage

- Minimal overhead (profiles stored as JSON in localStorage)
- Only active profile settings loaded into component state
- No profile caching in memory

## Testing

### Manual Testing Checklist

- [ ] Create a new profile with custom name
- [ ] Switch between profiles and verify layouts change
- [ ] Update active profile with new settings
- [ ] Rename a profile
- [ ] Duplicate a profile
- [ ] Export a profile and verify JSON format
- [ ] Import an exported profile
- [ ] Delete a custom profile (verify built-in profiles cannot be deleted)
- [ ] Delete active desktop profile (verify switches to Standard)
- [ ] Delete active mobile profile (verify switches to Mobile)
- [ ] Test profile switching on desktop and mobile screen sizes
- [ ] Test calendar view button hiding when calendar is XS size
- [ ] Verify profile settings persist after browser refresh
- [ ] Test with new optional dashboard cards enabled
- [ ] Test profile switching with per-reptile statistics settings

### Edge Cases

1. **Empty profile name** - Validation prevents creation
2. **Deleting active desktop profile** - Auto-switches to Standard
3. **Deleting active mobile profile** - Auto-switches to Mobile
4. **Corrupted localStorage** - Falls back to defaults
5. **Missing built-in profiles** - Auto-created on load
6. **Invalid import file** - Error message shown
7. **Resizing window** - Automatically switches between desktop and mobile profiles

## Responsive Features

### Mobile Optimization

**Settings Page Mobile Controls:**
The Display tab in Settings has been fully optimized for mobile devices (<768px):

- **Two-row responsive layout** for dashboard cards and statistics charts configuration:
  - **First row:** Drag handle (desktop) or up/down arrows (mobile), visibility toggle, and card/chart label
  - **Second row:** Interpolation dropdown (if applicable) and size buttons (XS/S/M/L)
- **Mobile-friendly reordering:**
  - **Desktop (≥768px):** Drag-and-drop with grip handle icon
  - **Mobile (<768px):** Up/down arrow buttons (ChevronUp/ChevronDown icons)
  - Touch-optimized buttons prevent conflict with page scrolling
  - First item has disabled up arrow, last item has disabled down arrow
- **Compact mobile controls:**
  - Reduced icon sizes (16px on mobile, 18px on desktop)
  - Smaller padding on buttons (`px-1.5` on mobile vs `px-2` on desktop)
  - Narrower interpolation dropdown on mobile (`w-24` vs `sm:min-w-[100px]` on desktop)
  - Shortened "Dots Only" to "Dots" for space efficiency
  - Controls aligned with `pl-6` on mobile for visual hierarchy
  - Hidden divider between controls on mobile

**Calendar View Restrictions:**
When the Weekly Calendar card is set to Extra Small (XS) size, the 3-day and 7-day view buttons are automatically hidden, leaving only the 1-day view. This prevents UI clutter and ensures optimal readability on compact layouts.

Implementation:
- `isCalendarExtraSmall()` function checks if calendar card size is 'xs'
- Dashboard conditionally renders view buttons based on this check
- Mobile profile defaults to XS calendar, automatically showing only 1-day view

**Dashboard Card Mobile Optimizations:**
- Recent Activity card uses responsive layout with inline timestamps and multi-line text clamping
- Calendar supplement text uses truncation with proper overflow handling
- All cards use responsive sizing classes and proper `min-w-0` for flex truncation

**Screen Size Detection:**
- System uses 768px breakpoint (Tailwind's `md` breakpoint)
- `window.innerWidth < 768` = mobile
- `window.innerWidth >= 768` = desktop
- Profiles automatically switch when window is resized across breakpoint
- Reordering method (drag vs arrows) determined by window width check

## Future Enhancements

Potential future improvements:

1. **Cloud Sync** - Sync profiles across devices via backend API
2. **Profile Templates** - Pre-built profiles for different use cases
3. **Profile Sharing** - Share profiles with household members
4. **Profile Scheduling** - Auto-switch profiles based on time/day or location
5. **Dashboard Themes** - Color schemes as part of profiles
6. **Card Layouts** - More granular control over card positioning
7. **Orientation Detection** - Separate profiles for portrait vs landscape on mobile
8. **Per-Device Profiles** - Remember different profiles for different devices

## Troubleshooting

### Profile not switching

**Symptom:** Clicking "Switch" doesn't change layout
**Solution:** Hard refresh browser (Ctrl+Shift+R), check browser console for errors

### Lost profiles

**Symptom:** Profiles disappeared after browser update
**Solution:** Check if localStorage was cleared, restore from exported backups

### Import fails

**Symptom:** "Invalid file format" error when importing
**Solution:** Verify JSON file structure matches export format, check for file corruption

### Built-in profiles missing

**Symptom:** No profiles available or missing Standard/Compact/Mobile profiles
**Solution:** System auto-creates all three built-in profiles, refresh page

### Profile not switching on mobile

**Symptom:** Profile switches on desktop but not on mobile device
**Solution:** Check browser width, system uses 768px breakpoint (Tailwind md). Clear localStorage and reload if issue persists.

## Developer Notes

### Code Style

- Use ES6+ syntax (arrow functions, destructuring, etc.)
- Follow existing naming conventions (`snake_case` for storage keys, `camelCase` for functions)
- Add JSDoc comments for all exported functions
- Handle errors gracefully (try/catch, fallbacks)

### localStorage Best Practices

- Always parse/stringify JSON data
- Check for `null` values before parsing
- Provide sensible defaults for missing data
- Use try/catch when reading from storage

### React Component Guidelines

- Use functional components with hooks
- Minimize re-renders (useCallback, useMemo where appropriate)
- Keep state local to component when possible
- Lift state only when necessary for parent communication

## See Also

- [Dashboard Customization Guide](../README.md#dashboard-customization)
- [Statistics Page Documentation](../README.md#statistics-page)
- [Settings Page Overview](../README.md#settings)
