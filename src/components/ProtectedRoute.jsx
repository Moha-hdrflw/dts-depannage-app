import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-accent text-lg">Chargement...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/clients" replace />
  if (profile && !profile.actif) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 text-lg">Compte désactivé</p>
          <p className="text-gray-500 text-sm mt-2">Contactez votre administrateur</p>
        </div>
      </div>
    )
  }

  return children
}
