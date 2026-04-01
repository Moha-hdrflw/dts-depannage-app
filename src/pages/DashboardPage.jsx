import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, MontantDisplay } from '../components/ui/Card'
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TrendingUp, Calendar, CreditCard, ChevronDown } from 'lucide-react'

const PERIODES = [
  { label: "Aujourd'hui",    key: 'jour' },
  { label: 'Hier',           key: 'hier' },
  { label: 'Cette semaine',  key: 'semaine' },
  { label: 'Ce mois',        key: 'mois' },
  { label: 'Personnalisé',   key: 'custom' },
]

function getRange(key) {
  const today = new Date()
  const fmt = d => format(d, 'yyyy-MM-dd')
  if (key === 'jour')    return { debut: fmt(today),                       fin: fmt(today) }
  if (key === 'hier')    return { debut: fmt(subDays(today, 1)),            fin: fmt(subDays(today, 1)) }
  if (key === 'semaine') return { debut: fmt(startOfWeek(today, { weekStartsOn: 1 })), fin: fmt(today) }
  if (key === 'mois')    return { debut: fmt(startOfMonth(today)),         fin: fmt(today) }
  return null
}

export function DashboardPage() {
  const [periode, setPeriode] = useState('jour')
  const [customDebut, setCustomDebut] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customFin, setCustomFin]   = useState(format(new Date(), 'yyyy-MM-dd'))

  const [interventions, setInterventions] = useState([])
  const [parPaiement, setParPaiement] = useState([])
  const [loading, setLoading] = useState(true)

  // Range actif
  const range = periode === 'custom'
    ? { debut: customDebut, fin: customFin }
    : getRange(periode)

  useEffect(() => { load() }, [range?.debut, range?.fin])

  async function load() {
    if (!range) return
    setLoading(true)
    const { data } = await supabase
      .from('interventions')
      .select('*, clients(nom, prenom)')
      .gte('date', range.debut)
      .lte('date', range.fin)
      .order('date', { ascending: false })

    const list = data || []
    setInterventions(list)

    const paiMap = {}
    list.forEach(i => {
      const mode = i.mode_paiement || 'Non renseigné'
      if (!paiMap[mode]) paiMap[mode] = { ttc: 0, ht: 0, count: 0 }
      paiMap[mode].ttc += i.montant_ttc || 0
      paiMap[mode].ht  += i.montant_ht  || 0
      paiMap[mode].count++
    })
    setParPaiement(Object.entries(paiMap).sort((a, b) => b[1].ttc - a[1].ttc))
    setLoading(false)
  }

  const totalTTC = interventions.reduce((a, b) => a + (b.montant_ttc || 0), 0)
  const totalHT  = interventions.reduce((a, b) => a + (b.montant_ht  || 0), 0)
  const fmt = n => n?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  const labelRange = range
    ? range.debut === range.fin
      ? format(new Date(range.debut), 'dd MMMM yyyy', { locale: fr })
      : `${format(new Date(range.debut), 'dd/MM/yyyy')} → ${format(new Date(range.fin), 'dd/MM/yyyy')}`
    : ''

  return (
    <div className="max-w-4xl mx-auto pb-20 sm:pb-4">
      <h1 className="text-2xl font-bold mb-1 neon-green">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-5 capitalize">
        {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
      </p>

      {/* ── Sélecteur de période ── */}
      <div className="bg-dark-800 neon-card rounded-xl p-4 mb-5">
        <p className="text-xs text-gray-500 mb-2">Période</p>

        {/* Pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIODES.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriode(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
                ${periode === p.key
                  ? 'bg-accent text-dark-900 border-accent neon-btn'
                  : 'bg-dark-700 text-gray-400 border-dark-500 hover:border-accent/40 hover:text-gray-200'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Dates personnalisées */}
        {periode === 'custom' && (
          <div className="flex items-center gap-3 mt-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-gray-500">Du</label>
              <input
                type="date"
                value={customDebut}
                onChange={e => setCustomDebut(e.target.value)}
                className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-gray-200
                  focus:outline-none focus:border-accent text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-gray-500">Au</label>
              <input
                type="date"
                value={customFin}
                min={customDebut}
                onChange={e => setCustomFin(e.target.value)}
                className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-gray-200
                  focus:outline-none focus:border-accent text-sm"
              />
            </div>
          </div>
        )}

        {/* Label période active */}
        {range && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Calendar size={12} />
            {labelRange}
          </p>
        )}
      </div>

      {/* ── Totaux ── */}
      {loading ? (
        <div className="text-gray-400 text-center py-8">Chargement...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Card neon className="flex flex-col items-center justify-center py-5">
              <p className="text-gray-500 text-xs mb-1">Total TTC</p>
              <p className="text-xl sm:text-2xl font-bold neon-green leading-tight text-center">{fmt(totalTTC)}</p>
              <p className="text-gray-500 text-xs mt-1">TTC</p>
            </Card>
            <Card neon className="flex flex-col items-center justify-center py-5">
              <p className="text-gray-500 text-xs mb-1">Total HT</p>
              <p className="text-xl sm:text-2xl font-bold neon-blue leading-tight text-center">{fmt(totalHT)}</p>
              <p className="text-gray-500 text-xs mt-1">HT</p>
            </Card>
          </div>

          <div className="bg-dark-800 neon-card rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Nombre d'interventions</span>
            <span className="text-accent font-bold text-xl">{interventions.length}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Par mode de paiement */}
            <Card neon>
              <h2 className="font-semibold neon-blue mb-3 flex items-center gap-2">
                <CreditCard size={16} /> Mode de paiement
              </h2>
              {parPaiement.length === 0
                ? <p className="text-gray-500 text-sm">Aucune donnée</p>
                : parPaiement.map(([mode, data]) => {
                  const icon = mode === 'CB' ? '💳' : mode === 'Espèces' ? '💵' : mode === 'Virement' ? '🏦' : '❓'
                  const pct = totalTTC > 0 ? Math.round((data.ttc / totalTTC) * 100) : 0
                  return (
                    <div key={mode} className="py-2 border-b border-dark-600 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-200 text-sm font-medium flex items-center gap-1.5">
                          {icon} {mode}
                          <span className="text-gray-600 text-xs font-normal">· {data.count} int.</span>
                        </span>
                        <div className="text-right">
                          <div className="neon-green font-semibold text-sm">{fmt(data.ttc)}</div>
                          <div className="text-gray-500 text-xs">{fmt(data.ht)} HT</div>
                        </div>
                      </div>
                      {/* Barre de progression */}
                      <div className="w-full bg-dark-600 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full transition-all ${
                            mode === 'CB' ? 'bg-blue-400' : mode === 'Espèces' ? 'bg-yellow-400' : 'bg-accent'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-right text-xs text-gray-600 mt-0.5">{pct}%</div>
                    </div>
                  )
                })
              }
            </Card>

            {/* Liste des interventions */}
            <Card neon>
              <h2 className="font-semibold neon-blue mb-3 flex items-center gap-2">
                <span className="dot-live" />
                Interventions ({interventions.length})
              </h2>
              {interventions.length === 0
                ? <p className="text-gray-500 text-sm">Aucune intervention sur cette période</p>
                : (
                  <div className="flex flex-col gap-2 max-h-80 overflow-y-auto scrollbar-thin">
                    {interventions.map(i => (
                      <div key={i.id} className="bg-dark-700 rounded-lg px-3 py-2">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-200 text-sm font-medium">
                              {i.clients?.prenom} {i.clients?.nom}
                            </span>
                            <div className="text-gray-500 text-xs mt-0.5 truncate">
                              {i.type_panne === 'Autre' ? i.type_panne_autre : i.type_panne}
                            </div>
                            <div className="text-gray-600 text-xs">
                              {format(new Date(i.date), 'dd/MM', { locale: fr })} · {i.technicien_nom}
                            </div>
                          </div>
                          <MontantDisplay ttc={i.montant_ttc} ht={i.montant_ht} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
