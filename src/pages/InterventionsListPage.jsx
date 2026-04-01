import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { MontantDisplay } from '../components/ui/Card'
import { Plus, Clock, Search, X, CalendarRange } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { fmtHeure } from '../lib/tarifs'

export function InterventionsListPage() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [interventions, setInterventions] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  // ── Filtres ──
  const [search, setSearch] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin]   = useState('')

  useEffect(() => { load() }, [dateDebut, dateFin])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('interventions')
      .select('*, clients(id, nom, prenom, telephone, type_client)')
      .order('date', { ascending: false })
      .order('heure', { ascending: false })
      .limit(200)

    if (!isAdmin) query = query.eq('technicien_id', profile.id)
    if (dateDebut) query = query.gte('date', dateDebut)
    if (dateFin)   query = query.lte('date', dateFin)

    const { data } = await query
    setInterventions(data || [])
    setLoading(false)
  }

  function resetFiltres() {
    setSearch('')
    setDateDebut('')
    setDateFin('')
  }

  const hasFiltres = search || dateDebut || dateFin

  // Filtre nom client côté client (instantané)
  const filtered = interventions.filter(i => {
    if (!search) return true
    const s = search.toLowerCase()
    const nom = `${i.clients?.prenom || ''} ${i.clients?.nom || ''}`.toLowerCase()
    return nom.includes(s) || (i.clients?.telephone || '').includes(s)
  })

  async function toggleFacture(interv, e) {
    e.stopPropagation()
    setToggling(interv.id + '_facture')
    let updates
    if (!interv.facture_editee) {
      updates = { facture_editee: true, facture_envoyee: false, date_facture: new Date().toISOString() }
    } else if (!interv.facture_envoyee) {
      updates = { facture_envoyee: true }
    } else {
      updates = { facture_editee: false, facture_envoyee: false, date_facture: null }
    }
    const { error } = await supabase.from('interventions').update(updates).eq('id', interv.id)
    if (error) console.error(error)
    setInterventions(prev => prev.map(i => i.id === interv.id ? { ...i, ...updates } : i))
    setToggling(null)
  }

  async function toggleSms(interv, e) {
    e.stopPropagation()
    setToggling(interv.id + '_sms')
    const updates = { sms_avis_envoye: !interv.sms_avis_envoye }
    const { error } = await supabase.from('interventions').update(updates).eq('id', interv.id)
    if (error) console.error(error)
    setInterventions(prev => prev.map(i => i.id === interv.id ? { ...i, ...updates } : i))
    setToggling(null)
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 sm:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold neon-green">Interventions</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isAdmin ? 'Toutes les interventions' : 'Mes interventions'}
            {hasFiltres && !loading && (
              <span className="ml-2 text-accent">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <Button onClick={() => navigate('/intervention/nouveau')} size="sm">
          <Plus size={16} /> Nouvelle
        </Button>
      </div>

      {/* ── Filtres ── */}
      <div className="bg-dark-800 neon-card rounded-xl p-3 mb-4 flex flex-col gap-3">
        {/* Recherche client */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full bg-dark-700 border border-dark-500 rounded-lg pl-9 pr-3 py-2.5 text-gray-200
              placeholder-gray-600 focus:outline-none focus:border-accent text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Plage de dates */}
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="text-gray-500 flex-shrink-0" />
          <input
            type="date"
            value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-gray-200
              focus:outline-none focus:border-accent text-sm"
          />
          <span className="text-gray-600 text-sm flex-shrink-0">→</span>
          <input
            type="date"
            value={dateFin}
            onChange={e => setDateFin(e.target.value)}
            className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-gray-200
              focus:outline-none focus:border-accent text-sm"
          />
          {(dateDebut || dateFin) && (
            <button onClick={() => { setDateDebut(''); setDateFin('') }}
              className="text-gray-500 hover:text-gray-300 flex-shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-8">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500 text-center py-10">
          {hasFiltres ? (
            <div>
              <p className="mb-3">Aucune intervention trouvée</p>
              <button onClick={resetFiltres} className="text-accent text-sm hover:underline">
                Effacer les filtres
              </button>
            </div>
          ) : (
            <div>
              <p>Aucune intervention</p>
              <Button onClick={() => navigate('/intervention/nouveau')} className="mt-4">
                <Plus size={16} /> Créer une intervention
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(interv => (
            <div
              key={interv.id}
              onClick={() => navigate(`/clients/${interv.clients?.id}`)}
              className="bg-dark-800 neon-card rounded-xl p-4 cursor-pointer hover:border-accent/30 transition-all"
            >
              {/* En-tête : client + montant */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-semibold text-gray-100">
                    {interv.clients?.prenom} {interv.clients?.nom}
                  </span>
                  <span className="ml-2">
                    <Badge color={interv.clients?.type_client === 'pro' ? 'blue' : 'purple'}>
                      {interv.clients?.type_client === 'pro' ? 'Pro' : 'Particulier'}
                    </Badge>
                  </span>
                  <div className="text-gray-500 text-xs mt-0.5">{interv.clients?.telephone}</div>
                </div>
                <MontantDisplay ttc={interv.montant_ttc} ht={interv.montant_ht} size="sm" />
              </div>

              {/* Date + type + technicien */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="inline-flex items-center gap-1 bg-dark-700 border border-dark-500 rounded-md px-2 py-0.5 text-xs text-gray-300">
                  <Clock size={11} className="text-accent" />
                  {format(new Date(interv.date), 'dd/MM/yyyy', { locale: fr })}
                  {interv.heure && <span className="text-gray-500"> · {fmtHeure(interv.heure)}</span>}
                </span>
                <Badge color="gray">{interv.type_panne === 'Autre' ? 'Autre' : interv.type_panne}</Badge>
                {isAdmin && <span className="text-xs text-gray-600">{interv.technicien_nom}</span>}
                <Badge color={interv.mode_paiement === 'CB' ? 'blue' : interv.mode_paiement === 'Espèces' ? 'yellow' : 'gray'}>
                  {interv.mode_paiement}
                </Badge>
              </div>

              {/* Badges statuts cliquables */}
              <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-gray-600">Facture</span>
                  <Badge
                    onClick={e => toggleFacture(interv, e)}
                    color={interv.facture_envoyee ? 'blue' : interv.facture_editee ? 'green' : 'red'}
                    className={`badge-clickable ${toggling === interv.id + '_facture' ? 'opacity-50' : ''}`}
                  >
                    {interv.facture_envoyee ? '✓✓ Envoyée' : interv.facture_editee ? '✓ Éditée' : '● Non éditée'}
                  </Badge>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-gray-600">SMS Avis</span>
                  <Badge
                    onClick={e => toggleSms(interv, e)}
                    color={interv.sms_avis_envoye ? 'green' : 'red'}
                    className={`badge-clickable ${toggling === interv.id + '_sms' ? 'opacity-50' : ''}`}
                  >
                    {interv.sms_avis_envoye ? '✓ Envoyé' : '● Non envoyé'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
