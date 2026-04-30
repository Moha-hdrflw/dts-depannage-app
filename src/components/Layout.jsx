import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Users, PlusCircle, LogOut, Settings, Menu, X, ClipboardList, WifiOff, RefreshCw, CheckCircle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { getQueue, removeFromQueue, getQueueCount } from '../lib/offlineQueue'
import { supabase } from '../lib/supabase'
import { calculerTTC } from '../lib/tarifs'

export function Layout({ children }) {
  const { profile, signOut, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [queueCount, setQueueCount] = useState(getQueueCount())
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const isSyncing = useRef(false)

  // ── Synchronisation automatique au retour du réseau ──
  async function syncQueue() {
    if (isSyncing.current) return
    const queue = getQueue()
    if (!queue.length) return

    isSyncing.current = true
    setSyncing(true)

    for (const item of queue) {
      try {
        let clientId = item.selectedClient?.id

        // Créer le client s'il était nouveau
        if (!clientId && item.clientForm) {
          const isPro = item.clientForm.type_client === 'pro'
          const { data, error } = await supabase.from('clients').insert([{
            nom:          isPro ? item.clientForm.nom_societe?.trim() : item.clientForm.nom?.trim(),
            prenom:       isPro ? '' : item.clientForm.prenom?.trim(),
            telephone:    item.clientForm.telephone?.trim(),
            adresse:      item.clientForm.adresse?.trim() || null,
            code_postal:  item.clientForm.code_postal?.trim() || null,
            ville:        item.clientForm.ville?.trim() || null,
            type_client:  item.clientForm.type_client,
            date_creation: new Date().toISOString(),
          }]).select().single()
          if (error) continue
          clientId = data.id
        }

        if (!clientId) continue

        const htVal = parseFloat(item.form.montant_ht_saisi) || 0
        const { montant_ht, tva_taux, montant_ttc } = item.calc || calculerTTC(htVal, item.typeClient)

        const { error: intErr } = await supabase.from('interventions').insert([{
          client_id:        clientId,
          technicien_id:    item.technicienId,
          technicien_nom:   item.technicienNom,
          date:             item.dateIntervention,
          heure:            item.heureIntervention,
          type_panne:       item.form.type_panne,
          type_panne_autre: item.form.type_panne === 'Autre' ? item.form.type_panne_autre : null,
          creneau:          item.form.creneau,
          duree_heures:     parseFloat(item.form.duree_heures),
          mise_en_securite: false,
          montant_ht,
          tva_taux,
          montant_ttc,
          mode_paiement:    item.form.mode_paiement,
          notes_technicien: item.form.notes_technicien,
          facture_editee: false, facture_envoyee: false,
          sms_avis_envoye: false, sms_j1_envoye: false,
        }])

        if (!intErr) {
          removeFromQueue(item._queueId)
        }
      } catch {
        // On garde l'item dans la queue pour réessayer plus tard
      }
    }

    isSyncing.current = false
    setSyncing(false)
    const remaining = getQueueCount()
    setQueueCount(remaining)
    if (remaining === 0) {
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 4000)
    }
  }

  useEffect(() => {
    // Actualiser le compteur à chaque changement de route
    setQueueCount(getQueueCount())
  }, [location.pathname])

  useEffect(() => {
    function onOnline() {
      setQueueCount(getQueueCount())
      syncQueue()
    }
    window.addEventListener('online', onOnline)
    // Tenter une sync au chargement si on est déjà en ligne
    if (navigator.onLine && getQueueCount() > 0) syncQueue()
    return () => window.removeEventListener('online', onOnline)
  }, [])

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

      {/* Bandeau sync hors-ligne */}
      {(queueCount > 0 || syncing || syncSuccess) && (
        <div className={`relative z-50 px-4 py-2 text-xs flex items-center justify-center gap-2 font-medium transition-colors
          ${syncSuccess
            ? 'bg-green-500/15 border-b border-green-500/30 text-green-400'
            : syncing
              ? 'bg-accent/10 border-b border-accent/20 text-accent'
              : 'bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-400'}`}>
          {syncSuccess ? (
            <><CheckCircle size={13} /> Interventions synchronisées avec succès !</>
          ) : syncing ? (
            <><RefreshCw size={13} className="animate-spin" /> Synchronisation en cours…</>
          ) : (
            <>
              <WifiOff size={13} />
              {queueCount} intervention{queueCount > 1 ? 's' : ''} en attente de synchronisation
              {navigator.onLine && (
                <button onClick={syncQueue}
                  className="ml-2 underline hover:no-underline">
                  Synchroniser maintenant
                </button>
              )}
            </>
          )}
        </div>
      )}

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
              {to === '/intervention/nouveau' && queueCount > 0 && (
                <span className="ml-auto bg-yellow-500 text-dark-900 text-xs font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                  {queueCount}
                </span>
              )}
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
            className={`flex-1 flex flex-col items-center py-2.5 gap-1 text-xs transition-colors relative
              ${location.pathname.startsWith(to) ? 'text-accent' : 'text-gray-500'}`}>
            <Icon size={20} />
            {label}
            {to === '/intervention/nouveau' && queueCount > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-18px)] bg-yellow-500 text-dark-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {queueCount}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  )
}
