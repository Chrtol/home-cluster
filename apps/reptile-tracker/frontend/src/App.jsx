import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import axios from 'axios';

import Layout from './components/Layout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import ReptileList from './pages/ReptileList';
import ReptileDetail from './pages/ReptileDetail';
import ReptileForm from './pages/ReptileForm';
import FeedingLog from './pages/FeedingLog';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import Statistics from './pages/Statistics';
import HealthLog from './pages/HealthLog';
import FoodManagement from './pages/FoodManagement';

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
axios.defaults.withCredentials = true;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication status on mount
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await axios.get('/auth/me')
      setUser(response.data)
      setIsAuthenticated(true)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = () => {
    // Cookies are already set by backend, just fetch user info
    fetchUser()
  }

  const handleLogout = async () => {
    try {
      await axios.post('/auth/logout')
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setIsAuthenticated(false)
      setUser(null)
    }
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

        {!isAuthenticated ? (
          <Route path="*" element={<Navigate to="/login" replace />} />
        ) : (
          <Route element={<Layout user={user} onLogout={handleLogout} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/reptiles" element={<ReptileList />} />
            <Route path="/reptiles/new" element={<ReptileForm />} />
            <Route path="/reptiles/:id" element={<ReptileDetail />} />
            <Route path="/reptiles/:id/edit" element={<ReptileForm />} />
            <Route path="/feed" element={<FeedingLog />} />
            <Route path="/feed/:id" element={<FeedingLog />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/stats" element={<Statistics />} />
            <Route path="/health-log" element={<HealthLog />} />
            <Route path="/health-log/:reptileId" element={<HealthLog />} />
            <Route path="/foods" element={<FoodManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  )
}

export default App