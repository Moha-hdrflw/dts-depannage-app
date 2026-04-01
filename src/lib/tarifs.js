export const TVA = {
  particulier: 0.10,
  pro: 0.20,
}

export const TYPES_PANNE = [
  'Panne générale',
  'Disjoncteur sauté',
  'Tableau électrique',
  'Prises & éclairage',
  'Mise en sécurité',
  'Urgence pro',
  'Autre',
]

export const DUREES = [0.5, 1, 1.5, 2, 2.5, 3]
export const MODES_PAIEMENT = ['CB', 'Espèces', 'Virement']

export function calculerHT(ttc, type_client) {
  const tva = TVA[type_client] ?? TVA.particulier
  const ht = ttc / (1 + tva)
  return {
    montant_ht: Math.round(ht * 100) / 100,
    tva_taux: Math.round(tva * 100),
    montant_ttc: Math.round(ttc * 100) / 100,
  }
}

export function fmtEuro(n) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

/** "14:30" → "14h30" · "00:05" → "00h05" · distingue minuit / midi */
export function fmtHeure(h) {
  if (!h) return ''
  const [hh, mm] = h.split(':')
  return `${hh}h${mm}`
}
