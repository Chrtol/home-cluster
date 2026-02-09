import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { Home, List, Plus, Calendar, BarChart3, LogOut, Menu, X, Settings, Utensils, Activity, ChevronDown, Droplets, BookTemplate, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import NotificationBell from './NotificationBell'
import { cn } from '@/lib/utils'

// Page transition variants
const pageVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 }
}

const pageTransition = {
  duration: 0.15,
  ease: 'easeOut'
}

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [trackMenuOpen, setTrackMenuOpen] = useState(false)
  const [schedulesMenuOpen, setSchedulesMenuOpen] = useState(false)
  const [mobileSchedulesMenuOpen, setMobileSchedulesMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('sidebar_collapsed') === 'true'
  )

  // Load dark mode preference on mount (defaults to true/dark)
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode')
    const isDark = savedMode === null ? true : savedMode === 'true'
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Persist sidebar collapse state
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', sidebarCollapsed.toString())
  }, [sidebarCollapsed])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in input/textarea/contenteditable
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return
      }

      // Cmd+K (Mac) or Ctrl+K (Windows/Linux) - Toggle Track menu
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setTrackMenuOpen(prev => !prev)
      }

      // When Track menu is open, F/M/H navigate directly
      if (trackMenuOpen) {
        const key = e.key.toLowerCase()
        if (key === 'f') {
          e.preventDefault()
          setTrackMenuOpen(false)
          navigate('/feed')
        } else if (key === 'm') {
          e.preventDefault()
          setTrackMenuOpen(false)
          navigate('/misting-log')
        } else if (key === 'h') {
          e.preventDefault()
          setTrackMenuOpen(false)
          navigate('/health-log')
        }
      }

      // Escape - Close any open menus
      if (e.key === 'Escape') {
        setTrackMenuOpen(false)
        setSchedulesMenuOpen(false)
        setMobileSchedulesMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [trackMenuOpen])

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', showOnMobile: true },
    { path: '/reptiles', icon: List, label: 'Reptiles', showOnMobile: true },
    { path: '/foods', icon: Utensils, label: 'Foods', showOnMobile: false },
    { path: '/stats', icon: BarChart3, label: 'Statistics', showOnMobile: true },
  ]

  const schedulesItems = [
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/schedule-templates', icon: BookTemplate, label: 'Schedule Templates' },
    { path: '/supplement-rotations', icon: RefreshCw, label: 'Supplement Rotations' },
  ]

  const NavLink = ({ item, onClick, collapsed }) => {
    const isActive = location.pathname === item.path
    const Icon = item.icon
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2 rounded-lg transition-colors text-sm ${
          isActive
            ? 'bg-primary/20 text-primary-400'
            : 'text-muted-foreground hover:bg-secondary'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={16} />
        {!collapsed && <span className="font-medium">{item.label}</span>}
      </Link>
    )
  }

  const TrackButton = ({ onClose, collapsed, isOpen: externalIsOpen, setIsOpen: externalSetIsOpen }) => {
    // Use external state if provided (for keyboard shortcut connection), otherwise use internal
    const [internalIsOpen, setInternalIsOpen] = useState(false)
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
    const setIsOpen = externalSetIsOpen || setInternalIsOpen

    const handleOptionClick = (path) => {
      navigate(path)
      setIsOpen(false)
      if (onClose) onClose()
    }

    if (collapsed) {
      return (
        <div className="relative group">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-center p-2.5 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white transition-all shadow-lg hover:shadow-xl focus-ring"
            title="Track (⌘K)"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>

          {isOpen && (
            <div className="absolute top-0 left-full ml-2 bg-card rounded-lg shadow-xl border border-border overflow-hidden z-50 w-64">
              <button
                onClick={() => handleOptionClick('/feed')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/20 transition-colors border-b border-border"
              >
                <Utensils size={20} className="text-primary" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground">Log Feeding</div>
                  <div className="text-xs text-muted-foreground">Record food and supplements</div>
                </div>
                <span className="text-xs text-muted-foreground opacity-60">F</span>
              </button>
              <button
                onClick={() => handleOptionClick('/health-log')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-900/20 transition-colors border-b border-border"
              >
                <Activity size={20} className="text-green-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground">Log Health</div>
                  <div className="text-xs text-muted-foreground">Record health and weight data</div>
                </div>
                <span className="text-xs text-muted-foreground opacity-60">H</span>
              </button>
              <button
                onClick={() => handleOptionClick('/misting-log')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-900/20 transition-colors"
              >
                <Droplets size={20} className="text-blue-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground">Log Misting</div>
                  <div className="text-xs text-muted-foreground">Record misting and humidity</div>
                </div>
                <span className="text-xs text-muted-foreground opacity-60">M</span>
              </button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-medium text-sm shadow-lg hover:shadow-xl transition-all focus-ring"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Track</span>
          <span className="text-xs text-primary-200 ml-auto hidden xl:inline-block">⌘K</span>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-xl border border-border overflow-hidden z-50">
            <button
              onClick={() => handleOptionClick('/feed')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/20 transition-colors border-b border-border"
            >
              <Utensils size={20} className="text-primary" />
              <div className="text-left flex-1">
                <div className="font-semibold text-foreground">Log Feeding</div>
                <div className="text-xs text-muted-foreground">Record food and supplements</div>
              </div>
              <span className="text-xs text-muted-foreground opacity-60 hidden xl:inline">F</span>
            </button>
            <button
              onClick={() => handleOptionClick('/health-log')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-900/20 transition-colors border-b border-border"
            >
              <Activity size={20} className="text-green-400" />
              <div className="text-left flex-1">
                <div className="font-semibold text-foreground">Log Health</div>
                <div className="text-xs text-muted-foreground">Record health and weight data</div>
              </div>
              <span className="text-xs text-muted-foreground opacity-60 hidden xl:inline">H</span>
            </button>
            <button
              onClick={() => handleOptionClick('/misting-log')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-900/20 transition-colors"
            >
              <Droplets size={20} className="text-blue-400" />
              <div className="text-left flex-1">
                <div className="font-semibold text-foreground">Log Misting</div>
                <div className="text-xs text-muted-foreground">Record misting and humidity</div>
              </div>
              <span className="text-xs text-muted-foreground opacity-60 hidden xl:inline">M</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  const SchedulesMenu = ({ onClose, collapsed }) => {
    const isSchedulesActive = schedulesItems.some(item => location.pathname.startsWith(item.path))

    if (collapsed) {
      return (
        <div className="relative group">
          <button
            className={`w-full flex items-center justify-center px-3 py-2 rounded-lg transition-colors text-sm ${
              isSchedulesActive
                ? 'bg-primary/20 text-primary-400'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
            title="Schedules"
          >
            <Calendar size={16} />
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-0.5">
        <button
          onClick={() => setSchedulesMenuOpen(!schedulesMenuOpen)}
          className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
            isSchedulesActive
              ? 'bg-primary/20 text-primary-400'
              : 'text-muted-foreground hover:bg-secondary'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={16} />
            <span className="font-medium">Schedules</span>
          </div>
          <ChevronDown size={14} className={`transform transition-transform ${schedulesMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {schedulesMenuOpen && (
          <div className="ml-4 pl-4 border-l-2 border-border space-y-0.5">
            {schedulesItems.map(item => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-primary/20 text-primary-400'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon size={14} />
                  <div className="flex-1">
                    <div className="text-xs font-medium">{item.label}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-200 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-56'}`}>
        <div className="flex flex-col flex-1 min-h-0 bg-card border-r border-border">
          {/* Logo */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'} py-4 border-b border-border`}>
            <Link to="/" className="flex items-center gap-2">
              <div className="text-2xl">🦎</div>
              {!sidebarCollapsed && (
                <div>
                  <h1 className="text-sm font-semibold text-foreground">Reptile Tracker</h1>
                </div>
              )}
            </Link>
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-secondary transition-colors focus-ring"
                title="Collapse sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-2'} py-2 space-y-0.5 overflow-y-auto`}>
            {/* Prominent Track Button */}
            <div className="mb-2">
              <TrackButton collapsed={sidebarCollapsed} isOpen={trackMenuOpen} setIsOpen={setTrackMenuOpen} />
            </div>

            {navItems.map(item => (
              <NavLink key={item.path} item={item} collapsed={sidebarCollapsed} />
            ))}

            {/* Schedules Collapsible Menu */}
            <SchedulesMenu collapsed={sidebarCollapsed} />
          </nav>

          {/* User Section */}
          <div className="flex-shrink-0 border-t border-border">
            <div className={`${sidebarCollapsed ? 'p-2' : 'p-3'} space-y-2`}>
              {sidebarCollapsed ? (
                <>
                  <div className="flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="w-full flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors focus-ring"
                    title="Expand sidebar"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 px-2 py-1.5 min-w-0">
                  <div className="w-7 h-7 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                    <p className="text-xs font-medium text-foreground truncate max-w-full">
                      {user?.name || 'User'}
                    </p>
                  </div>
                  <Link
                    to="/settings"
                    className={`p-1 rounded-lg transition-colors ${
                      location.pathname === '/settings'
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                    title="Settings"
                  >
                    <Settings size={16} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🦎</span>
            <span className="font-bold text-foreground">Reptile Tracker</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-secondary focus-ring"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)}></div>
          <div className="absolute inset-y-0 right-0 w-64 bg-card border-l border-border shadow-xl">
            <div className="flex flex-col h-full">
              <div className="px-4 py-4 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-foreground">Menu</span>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 -mr-2 rounded-lg text-muted-foreground hover:bg-secondary active:scale-95 transition-all focus-ring"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-lg font-medium text-primary">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{user?.name || 'User'}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {/* Prominent Track Button */}
                <div className="mb-4">
                  <TrackButton onClose={() => setSidebarOpen(false)} isOpen={trackMenuOpen} setIsOpen={setTrackMenuOpen} />
                </div>

                {navItems.map(item => (
                  <NavLink key={item.path} item={item} onClick={() => setSidebarOpen(false)} />
                ))}

                {/* Schedules Collapsible Menu */}
                <SchedulesMenu onClose={() => setSidebarOpen(false)} />
              </nav>
              <div className="px-4 py-4 border-t border-border space-y-2">
                <Link
                  to="/settings"
                  onClick={() => setSidebarOpen(false)}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === '/settings'
                      ? 'bg-primary/20 text-primary-400'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <Settings size={20} />
                  <span className="font-medium">Settings</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-56'}`}>
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              transition={pageTransition}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe">
        <div className="flex items-center justify-around relative">
          {/* Dashboard */}
          <Link
            to="/"
            className={cn(
              "flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 py-2 flex-1",
              "active:scale-95 transition-transform",
              location.pathname === '/'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Home size={22} />
            <span className="text-xs mt-1 truncate">Dashboard</span>
          </Link>

          {/* Schedules (expandable) */}
          <button
            onClick={() => setMobileSchedulesMenuOpen(!mobileSchedulesMenuOpen)}
            className={cn(
              "flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 py-2 flex-1",
              "active:scale-95 transition-transform focus-ring",
              schedulesItems.some(item => location.pathname === item.path)
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Calendar size={22} />
            <span className="text-xs mt-1 truncate">Schedules</span>
          </button>

          {/* Center Track Button */}
          <button
            onClick={() => setTrackMenuOpen(!trackMenuOpen)}
            className="relative -mt-6 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white shadow-lg active:scale-95 transition-transform focus-ring"
          >
            <Plus size={28} strokeWidth={3} />
          </button>

          {/* Reptiles */}
          <Link
            to="/reptiles"
            className={cn(
              "flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 py-2 flex-1",
              "active:scale-95 transition-transform",
              location.pathname === '/reptiles'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <List size={22} />
            <span className="text-xs mt-1 truncate">Reptiles</span>
          </Link>

          {/* Statistics */}
          <Link
            to="/stats"
            className={cn(
              "flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 py-2 flex-1",
              "active:scale-95 transition-transform",
              location.pathname === '/stats'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <BarChart3 size={22} />
            <span className="text-xs mt-1 truncate">Statistics</span>
          </Link>
        </div>

        {/* Mobile Schedules Menu Popup */}
        {mobileSchedulesMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileSchedulesMenuOpen(false)} style={{ bottom: '64px' }}></div>
            <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-card rounded-lg shadow-2xl border border-border overflow-hidden">
              {schedulesItems.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileSchedulesMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-4 hover:bg-primary/20 active:scale-[0.98] transition-all border-b border-border last:border-b-0"
                  >
                    <Icon size={24} className="text-primary" />
                    <div className="text-left flex-1">
                      <div className="font-semibold text-foreground">{item.label}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}


        {/* Mobile Track Menu Popup */}
        {trackMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/40" onClick={() => setTrackMenuOpen(false)} style={{ bottom: '64px' }}></div>
            <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-card rounded-lg shadow-2xl border border-border overflow-hidden">
              <Link
                to="/feed"
                onClick={() => setTrackMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-4 hover:bg-primary/20 active:scale-[0.98] transition-all border-b border-border"
              >
                <Utensils size={24} className="text-primary" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground">Log Feeding</div>
                  <div className="text-xs text-muted-foreground">Record food and supplements</div>
                </div>
              </Link>
              <Link
                to="/health-log"
                onClick={() => setTrackMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-4 hover:bg-green-900/20 active:scale-[0.98] transition-all border-b border-border"
              >
                <Activity size={24} className="text-green-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground">Log Health</div>
                  <div className="text-xs text-muted-foreground">Record health and weight data</div>
                </div>
              </Link>
              <Link
                to="/misting-log"
                onClick={() => setTrackMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-4 hover:bg-blue-900/20 active:scale-[0.98] transition-all"
              >
                <Droplets size={24} className="text-blue-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground">Log Misting</div>
                  <div className="text-xs text-muted-foreground">Record misting and humidity</div>
                </div>
              </Link>
            </div>
          </>
        )}
      </nav>

      {/* Spacer for bottom nav on mobile */}
      <div className="h-16 lg:hidden"></div>
    </div>
  )
}