import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Search, Plus, ChevronRight, User, Calendar } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function ClientsPage() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select(`
        id, nom, prenom, telephone, type_client, date_creation,
        interventions(id, montant_ttc, montant_ht, date)
      `)
      .order('date_creation', { ascending: false })

    setClients(data || [])
    setLoading(false)
  }

  const filtered = clients.filter(c => {
    const s = search.toLowerCase()
    return !s || [c.nom, c.prenom, c.telephone].some(f => f?.toLowerCase().includes(s))
  })

  return (
    <div className="max-w-2xl mx-auto pb-24 sm:pb-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold neon-green">Clients</h1>
        <Button onClick={() => navigate('/intervention/nouveau')} size="sm">
          <Plus size={16} /> Nouveau
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou téléphone..."
          className="w-full bg-dark-700 border border-dark-500 rounded-lg pl-9 pr-3 py-2.5 text-gray-200
            placeholder-gray-600 focus:outline-none focus:border-accent text-base"
        />
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-8">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500 text-center py-8">Aucun client trouvé</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(client => {
            const ints = client.interventions || []
            const derniere = [...ints].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
            const totalTTC = ints.reduce((a, b) => a + (b.montant_ttc || 0), 0)
            const fmt = n => n?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

            return (
              <button
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="w-full bg-dark-800 neon-card rounded-xl p-4 text-left hover:border-accent/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  {/* Gauche : nom + infos */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-100 truncate">
                          {client.prenom} {client.nom}
                        </span>
                        <Badge color={client.type_client === 'pro' ? 'blue' : 'purple'}>
                          {client.type_client === 'pro' ? 'Pro' : 'Particulier'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar size={11} className="text-gray-600" />
                        <span className="text-gray-500 text-xs">
                          {client.date_creation
                            ? format(new Date(client.date_creation), 'dd/MM/yyyy', { locale: fr })
                            : '—'}
                        </span>
                        <span className="text-gray-600 text-xs">·</span>
                        <span className="text-xs text-gray-500">{ints.length} intervention{ints.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Droite : montant + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {derniere && (
                      <div className="text-right">
                        <div className="neon-green font-bold text-base">{fmt(totalTTC)}</div>
                        <div className="text-gray-600 text-xs">TTC total</div>
                      </div>
                    )}
                    <ChevronRight size={16} className="text-gray-600" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
