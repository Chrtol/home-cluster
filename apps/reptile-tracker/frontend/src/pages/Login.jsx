import { useEffect } from 'react';

export default function Login() {
  useEffect(() => {
    // Apply dark mode on login page (defaults to dark)
    const savedMode = localStorage.getItem('darkMode')
    const isDark = savedMode === null ? true : savedMode === 'true'
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleLogin = () => {
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 text-center">
        <div className="text-6xl mb-4">🦎</div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reptile Tracker</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Track feeding schedules, weight, and health for your reptiles
        </p>
        <button onClick={handleLogin} className="w-full text-lg py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
          Login with Single Sign-On
        </button>
      </div>
    </div>
  )
}
