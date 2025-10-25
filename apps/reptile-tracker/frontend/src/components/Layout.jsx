import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { Home, List, Plus, Calendar, BarChart3, LogOut, Menu, X, Settings, Utensils, Activity, ChevronDown, Droplets, BookTemplate, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [trackMenuOpen, setTrackMenuOpen] = useState(false)
  const [schedulesMenuOpen, setSchedulesMenuOpen] = useState(false)

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

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/reptiles', icon: List, label: 'Reptiles' },
    { path: '/foods', icon: Utensils, label: 'Foods' },
    { path: '/stats', icon: BarChart3, label: 'Statistics' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  const schedulesItems = [
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/schedule-templates', icon: BookTemplate, label: 'Schedule Templates' },
    { path: '/supplement-rotations', icon: RefreshCw, label: 'Supplement Rotations' },
  ]

  const NavLink = ({ item, onClick }) => {
    const isActive = location.pathname === item.path
    const Icon = item.icon
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <Icon size={20} />
        <span className="font-medium">{item.label}</span>
      </Link>
    )
  }

  const TrackButton = ({ onClose }) => {
    const [isOpen, setIsOpen] = useState(false)

    const handleOptionClick = (path) => {
      navigate(path)
      setIsOpen(false)
      if (onClose) onClose()
    }

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 dark:from-primary-700 dark:to-primary-800 dark:hover:from-primary-600 dark:hover:to-primary-700 text-white transition-all shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center gap-3">
            <Plus size={22} className="font-bold" />
            <span className="font-bold text-lg">Track</span>
          </div>
          <ChevronDown size={18} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
            <button
              onClick={() => handleOptionClick('/feed')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
              <Utensils size={20} className="text-primary-600 dark:text-primary-400" />
              <div className="text-left">
                <div className="font-semibold text-gray-900 dark:text-white">Log Feeding</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Record food and supplements</div>
              </div>
            </button>
            <button
              onClick={() => handleOptionClick('/health-log')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
              <Activity size={20} className="text-green-600 dark:text-green-400" />
              <div className="text-left">
                <div className="font-semibold text-gray-900 dark:text-white">Log Health</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Record health and weight data</div>
              </div>
            </button>
            <button
              onClick={() => handleOptionClick('/misting-log')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Droplets size={20} className="text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <div className="font-semibold text-gray-900 dark:text-white">Log Misting</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Record misting and humidity</div>
              </div>
            </button>
          </div>
        )}
      </div>
    )
  }

  const SchedulesMenu = ({ onClose }) => {
    const isSchedulesActive = schedulesItems.some(item => location.pathname.startsWith(item.path))

    return (
      <div className="space-y-1">
        <button
          onClick={() => setSchedulesMenuOpen(!schedulesMenuOpen)}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
            isSchedulesActive
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <Calendar size={20} />
            <span className="font-medium">Schedules</span>
          </div>
          <ChevronDown size={18} className={`transform transition-transform ${schedulesMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {schedulesMenuOpen && (
          <div className="ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-1">
            {schedulesItems.map(item => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon size={18} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-500">{item.description}</div>
                    )}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 px-6 py-6 border-b border-gray-200 dark:border-gray-700">
            <div className="text-3xl">🦎</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reptile</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tracker</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {/* Prominent Track Button */}
            <div className="mb-4">
              <TrackButton />
            </div>

            {navItems.map(item => (
              <NavLink key={item.path} item={item} />
            ))}

            {/* Schedules Collapsible Menu */}
            <SchedulesMenu />
          </nav>

          {/* User Section */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-full">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-full">
                    {user?.email}
                  </p>
                </div>
              </div>
              <Link
                to="/settings"
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings size={20} />
                <span className="font-medium">Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={20} />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🦎</span>
            <span className="font-bold text-gray-900 dark:text-white">Reptile Tracker</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
          <div className="absolute inset-y-0 right-0 w-64 bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex flex-col h-full">
              <div className="px-4 py-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <span className="text-lg font-medium text-primary-700 dark:text-primary-300">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{user?.name || 'User'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {/* Prominent Track Button */}
                <div className="mb-4">
                  <TrackButton onClose={() => setSidebarOpen(false)} />
                </div>

                {navItems.map(item => (
                  <NavLink key={item.path} item={item} onClick={() => setSidebarOpen(false)} />
                ))}

                {/* Schedules Collapsible Menu */}
                <SchedulesMenu onClose={() => setSidebarOpen(false)} />
              </nav>
              <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
      <div className="lg:pl-64">
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe">
        <div className="flex items-center justify-around relative">
          {/* Left nav items */}
          {navItems.slice(0, 2).map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center px-3 py-2 min-w-0 flex-1 ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1 truncate">{item.label}</span>
              </Link>
            )
          })}

          {/* Center Track Button */}
          <button
            onClick={() => setTrackMenuOpen(!trackMenuOpen)}
            className="relative -mt-6 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white shadow-lg"
          >
            <Plus size={28} strokeWidth={3} />
          </button>

          {/* Right nav items */}
          {navItems.slice(2, 4).map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center px-3 py-2 min-w-0 flex-1 ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1 truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Mobile Track Menu Popup */}
        {trackMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/20" onClick={() => setTrackMenuOpen(false)} style={{ bottom: '64px' }}></div>
            <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Link
                to="/feed"
                onClick={() => setTrackMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-4 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-b border-gray-200 dark:border-gray-700"
              >
                <Utensils size={24} className="text-primary-600 dark:text-primary-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">Log Feeding</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Record food and supplements</div>
                </div>
              </Link>
              <Link
                to="/health-log"
                onClick={() => setTrackMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-4 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors border-b border-gray-200 dark:border-gray-700"
              >
                <Activity size={24} className="text-green-600 dark:text-green-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">Log Health</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Record health and weight data</div>
                </div>
              </Link>
              <Link
                to="/misting-log"
                onClick={() => setTrackMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Droplets size={24} className="text-blue-600 dark:text-blue-400" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">Log Misting</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Record misting and humidity</div>
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