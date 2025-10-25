import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import axios from 'axios';

import Layout from './components/Layout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import AcceptInvite from './pages/AcceptInvite';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ReptileList from './pages/ReptileList';
import ReptileDetail from './pages/ReptileDetail';
import ReptileForm from './pages/ReptileForm';
import FeedingLog from './pages/FeedingLog';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import Statistics from './pages/Statistics';
import HealthLog from './pages/HealthLog';
import MistingLog from './pages/MistingLog';
import FoodManagement from './pages/FoodManagement';
import ScheduleForm from './pages/ScheduleForm';
import ScheduleTemplates from './pages/ScheduleTemplates';
import ScheduleTemplateForm from './pages/ScheduleTemplateForm';
import SupplementRotations from './pages/SupplementRotations';

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
axios.defaults.withCredentials = true;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasHousehold, setHasHousehold] = useState(null) // null = checking, true/false = result

  useEffect(() => {
    // Check authentication status on mount
    fetchUser()

    // Setup axios interceptor for handling 401 errors
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // If error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry && !isRefreshing) {
          originalRequest._retry = true

          try {
            setIsRefreshing(true)
            // Try to refresh the token
            await axios.post('/auth/refresh')
            // Retry the original request
            return axios(originalRequest)
          } catch (refreshError) {
            // Refresh failed - redirect to login
            console.error('Token refresh failed:', refreshError)
            setIsAuthenticated(false)
            setUser(null)
            window.location.href = '/login'
            return Promise.reject(refreshError)
          } finally {
            setIsRefreshing(false)
          }
        }

        // If it's a 401 but we already tried refreshing, or if refresh is in progress
        if (error.response?.status === 401) {
          setIsAuthenticated(false)
          setUser(null)
          window.location.href = '/login'
        }

        return Promise.reject(error)
      }
    )

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor)
    }
  }, [isRefreshing])

  const fetchUser = async () => {
    try {
      const response = await axios.get('/auth/me')
      setUser(response.data)
      setIsAuthenticated(true)

      // Check if user has household
      await checkHouseholdStatus()
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setIsAuthenticated(false)
      setUser(null)
      setHasHousehold(false)
    } finally {
      setLoading(false)
    }
  }

  const checkHouseholdStatus = async () => {
    try {
      const response = await axios.get('/api/households/me')
      setHasHousehold(response.data && response.data.length > 0)
    } catch (error) {
      console.error('Failed to check household status:', error)
      setHasHousehold(false)
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
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {!isAuthenticated ? (
          <Route path="*" element={<Navigate to="/login" replace />} />
        ) : hasHousehold === false ? (
          // Authenticated but no household - force onboarding
          <>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : hasHousehold === true ? (
          // Authenticated with household - normal app
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
            <Route path="/schedule-create" element={<ScheduleForm />} />
            <Route path="/schedule-edit/:id" element={<ScheduleForm />} />
            <Route path="/schedule-templates" element={<ScheduleTemplates />} />
            <Route path="/schedule-templates/new" element={<ScheduleTemplateForm />} />
            <Route path="/schedule-templates/edit/:id" element={<ScheduleTemplateForm />} />
            <Route path="/supplement-rotations" element={<SupplementRotations />} />
            <Route path="/stats" element={<Statistics />} />
            <Route path="/health-log" element={<HealthLog />} />
            <Route path="/health-log/:reptileId" element={<HealthLog />} />
            <Route path="/health-log/:type/:id" element={<HealthLog />} />
            <Route path="/misting-log" element={<MistingLog />} />
            <Route path="/misting-log/:reptileId" element={<MistingLog />} />
            <Route path="/misting/:id" element={<MistingLog />} />
            <Route path="/foods" element={<FoodManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          // Still checking household status - show nothing (loading screen already shown above)
          <Route path="*" element={<div />} />
        )}
      </Routes>
    </Router>
  )
}

export default App