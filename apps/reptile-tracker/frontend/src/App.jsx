import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'

// Layout
import Layout from './components/Layout'

// Pages
import Dashboard from './pages/Dashboard'
import ReptileList from './pages/ReptileList'
import ReptileDetail from './pages/ReptileDetail'
import FeedingLog from './pages/FeedingLog'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''
axios.defaults.withCredentials = true

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const response = await axios.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      handleLogout()
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback onLogin={handleLogin} />} />

        {!token ? (
          <Route path="*" element={<Navigate to="/login" replace />} />
        ) : (
          <Route element={<Layout user={user} onLogout={handleLogout} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/reptiles" element={<ReptileList />} />
            <Route path="/reptiles/:id" element={<ReptileDetail />} />
            <Route path="/feed/:id?" element={<FeedingLog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  )
}

export default App
