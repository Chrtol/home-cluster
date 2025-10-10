export default function Login() {
  const handleLogin = () => {
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="card max-w-md w-full mx-4 text-center">
        <div className="text-6xl mb-4">🦎</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reptile Tracker</h1>
        <p className="text-gray-600 mb-8">
          Track feeding schedules, weight, and health for your reptiles
        </p>
        <button onClick={handleLogin} className="btn-primary w-full text-lg py-3">
          Login with Authentik
        </button>
      </div>
    </div>
  )
}
