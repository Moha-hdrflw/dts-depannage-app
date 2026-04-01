import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Users, PlusCircle, LogOut, Settings, Menu, X, ClipboardList } from 'lucide-react'
import { useState } from 'react'

export function Layout({ children }) {
  const { profile, signOut, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    ...(isAdmin ? [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] : []),
    { to: '/clients', icon: Users, label: 'Clients' },
    { to: '/interventions', icon: ClipboardList, label: 'Interventions' },
    { to: '/intervention/nouveau', icon: PlusCircle, label: 'Nouveau' },
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: 'Admin' }] : []),
  ]

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col relative">
      {/* Orbes néon de fond */}
      <div className="neon-bg" aria-hidden="true">
        <div className="orb1" />
        <div className="orb2" />
        <div className="orb3" />
        <div className="orb4" />
        <div className="orb5" />
        <div className="orb6" />
        <div className="line1" />
        <div className="line2" />
        <div className="line3" />
        <div className="line4" />
      </div>

      {/* Top bar */}
      <header className="relative z-40 bg-dark-800/90 backdrop-blur-md border-b border-dark-600 header-neon px-4 py-3 flex items-center justify-between sticky top-0">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-dts.png" alt="DTS" className="w-8 h-8 object-contain rounded-lg neon-btn" />
          <span className="font-bold text-gray-100 text-lg">DTS</span>
          <span className="neon-green font-bold text-lg">Élec</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-gray-400">
            {profile?.prenom} · <span className="text-accent capitalize">{profile?.role}</span>
          </span>
          <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden text-gray-400 hover:text-gray-200">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <button onClick={handleSignOut}
            className="hidden sm:flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-sm transition-colors">
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden relative z-40 bg-dark-800/95 backdrop-blur-md border-b border-dark-600 px-4 py-2">
          <div className="text-sm text-gray-400 mb-2">
            {profile?.prenom} · <span className="text-accent capitalize">{profile?.role}</span>
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-colors
                ${location.pathname.startsWith(to) ? 'bg-accent/10 text-accent' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'}`}>
              <Icon size={18} />{label}
            </Link>
          ))}
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-3 text-gray-400 hover:text-gray-200 w-full">
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      )}

      <div className="flex flex-1 relative z-10">
        {/* Sidebar desktop */}
        <nav className="hidden sm:flex flex-col w-56 bg-dark-800/70 backdrop-blur-sm border-r border-dark-600 p-3 sticky top-[57px] h-[calc(100vh-57px)]">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all text-sm
                ${location.pathname.startsWith(to)
                  ? 'bg-accent/10 text-accent font-medium border border-accent/20 neon-btn'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'}`}>
              <Icon size={18} />{label}
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-md border-t border-dark-600 flex z-40">
        {navItems.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to}
            className={`flex-1 flex flex-col items-center py-2.5 gap-1 text-xs transition-colors
              ${location.pathname.startsWith(to) ? 'text-accent' : 'text-gray-500'}`}>
            <Icon size={20} />{label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
