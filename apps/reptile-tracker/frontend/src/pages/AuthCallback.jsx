import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback({ onLogin }) {
  const navigate = useNavigate()

  useEffect(() => {
    // Backend has already set HTTP-only cookies and redirected
    // Just notify parent to fetch user info and redirect to home
    onLogin()
    navigate('/')
  }, [onLogin, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Logging in...</p>
      </div>
    </div>
  )
}
