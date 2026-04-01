import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { calculerHT, TYPES_PANNE, DUREES, MODES_PAIEMENT } from '../lib/tarifs'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { ArrowLeft, Search, User, Upload, X, Building2 } from 'lucide-react'

export function InterventionFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clientIdParam = searchParams.get('client_id')
  const photoRef = useRef()

  // ── Client ──
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientMode, setClientMode] = useState('search')
  const [clientForm, setClientForm] = useState({
    prenom: '', nom: '', nom_societe: '', telephone: '', email: '', adresse: '', code_postal: '', ville: '', type_client: 'particulier'
  })

  // ── Intervention ──
  const [form, setForm] = useState({
    type_panne: 'Panne générale',
    type_panne_autre: '',
    creneau: 'journee',
    duree_heures: 1,
    montant_ttc_saisi: '',
    mode_paiement: 'CB',
    notes_technicien: '',
  })

  const [photos, setPhotos] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const typeClient = selectedClient?.type_client || clientForm.type_client
  const isPro = typeClient === 'pro'
  const ttcVal = parseFloat(form.montant_ttc_saisi) || 0
  const calc = ttcVal > 0 ? calculerHT(ttcVal, typeClient) : null

  // Nom complet technicien (prénom + nom, jamais l'email)
  const techNomComplet = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || profile?.email || ''

  useEffect(() => {
    if (clientIdParam) loadClient(clientIdParam)
  }, [clientIdParam])

  async function loadClient(id) {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single()
    if (data) { setSelectedClient(data); setClientMode('search') }
  }

  async function searchClients(q) {
    setClientSearch(q)
    if (q.length < 2) { setClientResults([]); return }
    const { data } = await supabase
      .from('clients').select('*')
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,telephone.ilike.%${q}%`)
      .limit(8)
    setClientResults(data || [])
  }

  function setF(f, v) { setForm(p => ({ ...p, [f]: v })); setErrors(e => ({ ...e, [f]: '' })) }
  function setCF(f, v) { setClientForm(p => ({ ...p, [f]: v })); setErrors(e => ({ ...e, [f]: '' })) }

  function addPhoto(e) {
    Array.from(e.target.files).forEach(file =>
      setPhotos(prev => [...prev, { file, preview: URL.createObjectURL(file), type: 'avant' }])
    )
    e.target.value = ''
  }

  function validate() {
    const e = {}
    if (!selectedClient && clientMode === 'new') {
      if (clientForm.type_client === 'pro' && !clientForm.nom_societe.trim()) e.nom_societe = 'Obligatoire'
      if (clientForm.type_client === 'particulier' && !clientForm.prenom.trim()) e.prenom = 'Obligatoire'
      if (clientForm.type_client === 'particulier' && !clientForm.nom.trim()) e.nom = 'Obligatoire'
      if (!clientForm.telephone.trim()) e.telephone = 'Obligatoire'
    }
    if (!selectedClient && clientMode === 'search') e.client = 'Sélectionnez ou créez un client'
    if (!form.montant_ttc_saisi || ttcVal <= 0) e.montant_ttc_saisi = 'Montant obligatoire'
    if (form.type_panne === 'Autre' && !form.type_panne_autre.trim()) e.type_panne_autre = 'Obligatoire'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)

    const now = new Date()
    const dateAuto = now.toISOString().split('T')[0]
    // Format 24h : "14:30" → stocké tel quel, affiché "14h30"
    const heureAuto = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })

    let clientId = selectedClient?.id
    if (!clientId && clientMode === 'new') {
      const isPro = clientForm.type_client === 'pro'
      const { data, error } = await supabase.from('clients').insert([{
        nom: isPro ? clientForm.nom_societe.trim() : clientForm.nom.trim(),
        prenom: isPro ? '' : clientForm.prenom.trim(),
        telephone: clientForm.telephone.trim(),
        adresse: clientForm.adresse.trim() || null,
        code_postal: clientForm.code_postal.trim() || null,
        ville: clientForm.ville.trim() || null,
        type_client: clientForm.type_client,
        date_creation: now.toISOString(),
      }]).select().single()
      if (error) { alert('Erreur client : ' + error.message); setLoading(false); return }
      clientId = data.id
    }

    const { montant_ht, tva_taux, montant_ttc } = calculerHT(ttcVal, typeClient)

    const { data: intData, error: intErr } = await supabase.from('interventions').insert([{
      client_id: clientId,
      technicien_id: profile.id,
      technicien_nom: techNomComplet,
      date: dateAuto,
      heure: heureAuto,
      type_panne: form.type_panne,
      type_panne_autre: form.type_panne === 'Autre' ? form.type_panne_autre : null,
      creneau: form.creneau,
      duree_heures: parseFloat(form.duree_heures),
      mise_en_securite: false,
      montant_ht,
      tva_taux,
      montant_ttc,
      mode_paiement: form.mode_paiement,
      notes_technicien: form.notes_technicien,
      facture_editee: false, facture_envoyee: false,
      sms_avis_envoye: false, sms_j1_envoye: false,
    }]).select().single()

    if (intErr) { alert('Erreur intervention : ' + intErr.message); setLoading(false); return }

    for (const photo of photos) {
      const safeName = photo.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${clientId}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, photo.file, { upsert: true })
      if (upErr) { alert(`Erreur upload : ${upErr.message}`); continue }
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
      await supabase.from('photos').insert([{
        client_id: clientId, intervention_id: intData.id,
        url: urlData.publicUrl, type: photo.type, date_upload: now.toISOString(),
      }])
    }

    setLoading(false)
    navigate(`/clients/${clientId}`)
  }

  const fmtEuro = n => n?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  return (
    <div className="max-w-lg mx-auto pb-28 sm:pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4 transition-colors">
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-2xl font-bold mb-1 neon-green">Nouvelle intervention</h1>
      <p className="text-gray-500 text-sm mb-6">
        Technicien : <span className="text-accent font-medium">{techNomComplet}</span>
        <span className="ml-3 text-gray-600 text-xs">· Date & heure auto</span>
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* ── BLOC CLIENT ── */}
        <div className="bg-dark-800 neon-card rounded-xl p-4">
          <h2 className="font-semibold neon-blue mb-3 flex items-center gap-2">
            <User size={16} /> Client
          </h2>

          {selectedClient ? (
            <div className="bg-dark-700 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-100">
                  {selectedClient.type_client === 'pro' ? selectedClient.nom : `${selectedClient.prenom} ${selectedClient.nom}`}
                </div>
                <div className="text-sm text-gray-400">
                  {selectedClient.telephone} · {selectedClient.type_client === 'pro' ? 'Pro — TVA 20%' : 'Particulier — TVA 10%'}
                </div>
              </div>
              <button type="button" onClick={() => { setSelectedClient(null); setClientMode('search') }}
                className="text-gray-500 hover:text-red-400 transition-colors"><X size={16} /></button>
            </div>
          ) : clientMode === 'search' ? (
            <div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={clientSearch} onChange={e => searchClients(e.target.value)}
                  placeholder="Rechercher par nom ou téléphone..."
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg pl-9 pr-3 py-2.5 text-gray-200
                    placeholder-gray-600 focus:outline-none focus:border-accent text-base" />
              </div>
              {clientResults.length > 0 && (
                <div className="mt-1 bg-dark-700 border border-dark-500 rounded-lg overflow-hidden">
                  {clientResults.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setSelectedClient(c); setClientSearch(''); setClientResults([]) }}
                      className="w-full text-left px-3 py-2.5 hover:bg-dark-600 border-b border-dark-600 last:border-0">
                      <div className="text-gray-200 text-sm font-medium">
                        {c.type_client === 'pro' ? c.nom : `${c.prenom} ${c.nom}`}
                      </div>
                      <div className="text-gray-500 text-xs">{c.telephone} · {c.type_client === 'pro' ? 'Pro' : 'Particulier'}</div>
                    </button>
                  ))}
                </div>
              )}
              {errors.client && <p className="text-red-400 text-xs mt-1">{errors.client}</p>}
              <button type="button" onClick={() => setClientMode('new')}
                className="mt-2 text-accent text-sm hover:underline flex items-center gap-1">
                <User size={13} /> Nouveau client
              </button>
            </div>
          ) : (
            /* Formulaire nouveau client */
            <div className="flex flex-col gap-3">
              {/* Type client EN PREMIER */}
              <Select label="Type de client" value={clientForm.type_client}
                onChange={e => setCF('type_client', e.target.value)}>
                <option value="particulier">Particulier — TVA 10%</option>
                <option value="pro">Professionnel — TVA 20%</option>
              </Select>

              {/* Champs selon le type */}
              {clientForm.type_client === 'pro' ? (
                <div className="flex items-center gap-2 bg-dark-700 rounded-lg p-3">
                  <Building2 size={16} className="text-accent flex-shrink-0" />
                  <Input label="Nom de société *" value={clientForm.nom_societe}
                    onChange={e => setCF('nom_societe', e.target.value)}
                    error={errors.nom_societe} className="flex-1" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Prénom *" value={clientForm.prenom}
                    onChange={e => setCF('prenom', e.target.value)} error={errors.prenom} />
                  <Input label="Nom *" value={clientForm.nom}
                    onChange={e => setCF('nom', e.target.value)} error={errors.nom} />
                </div>
              )}

              <Input label="Téléphone *" type="tel" value={clientForm.telephone}
                onChange={e => setCF('telephone', e.target.value)} error={errors.telephone} />
              <Input label="Email" type="email" value={clientForm.email}
                onChange={e => setCF('email', e.target.value)} />
              <Input label="Adresse" value={clientForm.adresse}
                onChange={e => setCF('adresse', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Code postal" value={clientForm.code_postal}
                  onChange={e => setCF('code_postal', e.target.value)} placeholder="75001" />
                <Input label="Ville" value={clientForm.ville}
                  onChange={e => setCF('ville', e.target.value)} placeholder="Paris" />
              </div>
              <button type="button" onClick={() => setClientMode('search')}
                className="text-gray-500 text-xs hover:text-gray-300 text-left">
                ← Rechercher un client existant
              </button>
            </div>
          )}
        </div>

        {/* ── BLOC INTERVENTION ── */}
        <div className="bg-dark-800 neon-card rounded-xl p-4 flex flex-col gap-4">
          <h2 className="font-semibold neon-blue flex items-center gap-2">
            <span className="dot-live" /> Intervention
          </h2>

          <Select label="Type de panne" value={form.type_panne} onChange={e => setF('type_panne', e.target.value)}>
            {TYPES_PANNE.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>

          {form.type_panne === 'Autre' && (
            <Textarea label="Décrivez la prestation *" value={form.type_panne_autre}
              onChange={e => setF('type_panne_autre', e.target.value)}
              rows={3} placeholder="Description détaillée..." error={errors.type_panne_autre} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select label="Créneau" value={form.creneau} onChange={e => setF('creneau', e.target.value)}>
              <option value="journee">Journée (7h-19h)</option>
              <option value="nuit">Nuit (19h-7h)</option>
            </Select>
            <Select label="Durée" value={form.duree_heures} onChange={e => setF('duree_heures', e.target.value)}>
              {DUREES.map(d => <option key={d} value={d}>{d}h</option>)}
            </Select>
          </div>

          <Textarea label="Notes du technicien" value={form.notes_technicien}
            onChange={e => setF('notes_technicien', e.target.value)}
            rows={3} placeholder="Détails de l'intervention, pièces remplacées..." />
        </div>

        {/* ── BLOC MONTANT ── */}
        <div className="bg-dark-800 neon-card rounded-xl p-4 flex flex-col gap-3">
          <h2 className="font-semibold neon-blue">Facturation</h2>

          {/* Indicateur TVA */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
            ${isPro ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300' : 'bg-gray-500/10 border border-gray-500/30 text-gray-400'}`}>
            <span>{isPro ? '🏢 Professionnel' : '👤 Particulier'}</span>
            <span className="ml-auto font-bold">TVA {isPro ? '20%' : '10%'}</span>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Montant facturé TTC (€) *</label>
            <input type="number" min="0" step="0.01" value={form.montant_ttc_saisi}
              onChange={e => setF('montant_ttc_saisi', e.target.value)} placeholder="0.00"
              className={`w-full bg-dark-700 border rounded-lg px-3 py-3 text-gray-100 text-xl font-bold
                placeholder-gray-600 focus:outline-none focus:border-accent transition-colors
                ${errors.montant_ttc_saisi ? 'border-red-500' : 'border-dark-500'}`} />
            {errors.montant_ttc_saisi && <p className="text-red-400 text-xs mt-1">{errors.montant_ttc_saisi}</p>}
            {calc && (
              <div className="mt-2 bg-dark-700 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <span className="text-gray-500 text-sm">Montant HT (TVA {calc.tva_taux}% déduite)</span>
                <span className="neon-blue text-sm font-bold">{fmtEuro(calc.montant_ht)}</span>
              </div>
            )}
          </div>

          <Select label="Mode de paiement" value={form.mode_paiement} onChange={e => setF('mode_paiement', e.target.value)}>
            {MODES_PAIEMENT.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </div>

        {/* ── BLOC PHOTOS ── */}
        <div className="bg-dark-800 neon-card rounded-xl p-4">
          <h2 className="font-semibold neon-blue mb-3 flex items-center gap-2">
            <Upload size={16} /> Photos
          </h2>
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhoto} />
          {photos.length === 0 ? (
            <button type="button" onClick={() => photoRef.current?.click()}
              className="w-full border-2 border-dashed border-dark-500 rounded-xl py-8 text-gray-500
                hover:border-accent/40 hover:text-gray-400 transition-colors flex flex-col items-center gap-2">
              <Upload size={24} /><span className="text-sm">Ajouter des photos avant/après</span>
            </button>
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square">
                    <img src={photo.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-600 rounded-full w-5 h-5 flex items-center justify-center">
                      <X size={11} />
                    </button>
                    <button type="button"
                      onClick={() => setPhotos(p => p.map((ph, i) => i === idx ? { ...ph, type: ph.type === 'avant' ? 'apres' : 'avant' } : ph))}
                      className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs font-bold border
                        ${photo.type === 'avant' ? 'bg-yellow-500/80 text-yellow-900 border-yellow-400' : 'bg-green-500/80 text-green-900 border-green-400'}`}>
                      {photo.type === 'avant' ? 'AVANT' : 'APRÈS'}
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-dark-500 rounded-lg
                    flex items-center justify-center text-gray-600 hover:border-accent/40 transition-colors">
                  <Upload size={20} />
                </button>
              </div>
              <p className="text-xs text-gray-600">Touchez le badge pour basculer AVANT / APRÈS</p>
            </div>
          )}
        </div>

        <Button type="submit" disabled={loading} size="lg" className="w-full text-lg">
          {loading ? 'Enregistrement...' : "Valider l'intervention"}
        </Button>
      </form>
    </div>
  )
}
