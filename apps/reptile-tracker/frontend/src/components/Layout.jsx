import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Home, List, Plus, User, LogOut } from 'lucide-react'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">🦎 Reptile Tracker</h1>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-primary-700 rounded-lg"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="lg:hidden bg-white border-t shadow-lg fixed bottom-0 left-0 right-0">
        <div className="flex justify-around py-2">
          <Link to="/" className="flex flex-col items-center p-2 text-gray-600 hover:text-primary-600">
            <Home size={24} />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link to="/reptiles" className="flex flex-col items-center p-2 text-gray-600 hover:text-primary-600">
            <List size={24} />
            <span className="text-xs mt-1">Reptiles</span>
          </Link>
          <Link to="/feed" className="flex flex-col items-center p-2 text-gray-600 hover:text-primary-600">
            <Plus size={24} />
            <span className="text-xs mt-1">Feed</span>
          </Link>
          <Link to="/profile" className="flex flex-col items-center p-2 text-gray-600 hover:text-primary-600">
            <User size={24} />
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Spacer for bottom nav on mobile */}
      <div className="h-20 lg:hidden"></div>
    </div>
  )
}
