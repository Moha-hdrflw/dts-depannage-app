import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Zap } from 'lucide-react'

export function LoginPage() {
  const { signIn, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError('Email ou mot de passe incorrect')
    } else {
      navigate('/clients')
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4 pb-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-4">
            <Zap size={32} className="text-dark-900" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">DTS Dépannage Élec</h1>
          <p className="text-gray-500 text-sm mt-1">Espace professionnel</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-600 rounded-2xl p-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="vous@dts.fr"
            required
            autoComplete="email"
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} size="lg" className="w-full mt-1">
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-4">app.dts-depannage.fr</p>
      </div>
    </div>
  )
}
