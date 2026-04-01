import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, MontantDisplay } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { ArrowLeft, Plus, Upload, X, Pencil, Trash2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { calculerHT, TYPES_PANNE, DUREES, MODES_PAIEMENT, fmtHeure } from '../lib/tarifs'

const TABS = ['Interventions', 'Notes & Facturation', 'Photos']

export function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [client, setClient] = useState(null)
  const [interventions, setInterventions] = useState([])
  const [photos, setPhotos] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [toggling, setToggling] = useState(null)
  const fileRef = useRef()

  // Edit intervention
  const [editInterv, setEditInterv] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    const [{ data: c }, { data: ints }, { data: ph }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('interventions').select('*').eq('client_id', id).order('date', { ascending: false }).order('heure', { ascending: false }),
      supabase.from('photos').select('*').eq('client_id', id).order('date_upload', { ascending: false }),
    ])
    setClient(c)
    setInterventions(ints || [])
    setPhotos(ph || [])
    setLoading(false)
  }

  // ── Badges ──
  async function toggleFacture(interv) {
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
    if (error) alert('Erreur mise à jour : ' + error.message)
    else setInterventions(prev => prev.map(i => i.id === interv.id ? { ...i, ...updates } : i))
    setToggling(null)
  }

  async function toggleSmsAvis(interv) {
    setToggling(interv.id + '_sms')
    const updates = { sms_avis_envoye: !interv.sms_avis_envoye }
    const { error } = await supabase.from('interventions').update(updates).eq('id', interv.id)
    if (error) alert('Erreur mise à jour : ' + error.message)
    else setInterventions(prev => prev.map(i => i.id === interv.id ? { ...i, ...updates } : i))
    setToggling(null)
  }

  // ── Suppression intervention (admin) ──
  async function deleteIntervention(interv) {
    if (!confirm('Supprimer cette intervention ? Action irréversible.')) return
    await supabase.from('photos').delete().eq('intervention_id', interv.id)
    await supabase.from('interventions').delete().eq('id', interv.id)
    setInterventions(prev => prev.filter(i => i.id !== interv.id))
  }

  // ── Suppression client (admin) ──
  async function deleteClient() {
    if (!confirm(`Supprimer le client ${client.prenom} ${client.nom} et TOUTES ses interventions ? Action irréversible.`)) return
    // Photos → interventions → client
    const intIds = interventions.map(i => i.id)
    if (intIds.length) {
      await supabase.from('photos').delete().in('intervention_id', intIds)
      await supabase.from('interventions').delete().eq('client_id', id)
    }
    await supabase.from('photos').delete().eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    navigate('/clients')
  }

  // ── Édition intervention (admin) ──
  function openEdit(interv) {
    setEditInterv(interv)
    setEditForm({
      type_panne: interv.type_panne,
      type_panne_autre: interv.type_panne_autre || '',
      creneau: interv.creneau,
      duree_heures: interv.duree_heures || 1,
      montant_ttc_saisi: interv.montant_ttc || '',
      mode_paiement: interv.mode_paiement,
      notes_technicien: interv.notes_technicien || '',
    })
  }

  async function saveEdit() {
    setSaving(true)
    const ttcVal = parseFloat(editForm.montant_ttc_saisi) || 0
    const { montant_ht, tva_taux, montant_ttc } = calculerHT(ttcVal, client.type_client)
    const updates = {
      type_panne: editForm.type_panne,
      type_panne_autre: editForm.type_panne === 'Autre' ? editForm.type_panne_autre : null,
      creneau: editForm.creneau,
      duree_heures: parseFloat(editForm.duree_heures),
      montant_ht,
      tva_taux,
      montant_ttc,
      mode_paiement: editForm.mode_paiement,
      notes_technicien: editForm.notes_technicien,
    }
    await supabase.from('interventions').update(updates).eq('id', editInterv.id)
    setInterventions(prev => prev.map(i => i.id === editInterv.id ? { ...i, ...updates } : i))
    setSaving(false)
    setEditInterv(null)
  }

  async function handlePhotoUpload(e, interventionId) {
    const file = e.target.files[0]
    if (!file) return
    const typeLabel = window.confirm('Type de photo :\nOK = AVANT\nAnnuler = APRÈS') ? 'avant' : 'apres'
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${id}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage
      .from('photos')
      .upload(path, file, { upsert: true })
    if (upErr) {
      alert(`Erreur upload : ${upErr.message}\n\nVérifiez que le bucket "photos" existe dans Supabase Storage et qu'il est public.`)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
    const { error: insErr } = await supabase.from('photos').insert([{
      client_id: id,
      intervention_id: interventionId || null,
      url: urlData.publicUrl,
      type: typeLabel,
      date_upload: new Date().toISOString(),
    }])
    if (insErr) {
      alert(`Erreur sauvegarde photo : ${insErr.message}`)
    }
    setUploading(false)
    loadAll()
  }

  if (loading) return <div className="text-gray-400 p-8 text-center">Chargement...</div>
  if (!client) return <div className="text-gray-400 p-8 text-center">Client introuvable</div>

  const latestIntervention = interventions[0]

  return (
    <div className="max-w-2xl mx-auto pb-24 sm:pb-4">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4 transition-colors">
        <ArrowLeft size={16} /> Retour
      </button>

      {/* Header client */}
      <div className="bg-dark-800 neon-card rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold neon-green">{client.prenom} {client.nom}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{client.telephone}</p>
            {client.adresse && <p className="text-gray-500 text-sm">{client.adresse}</p>}
            {(client.code_postal || client.ville) && (
              <p className="text-gray-500 text-sm">
                {[client.code_postal, client.ville].filter(Boolean).join(' ')}
              </p>
            )}
            <Badge color={client.type_client === 'pro' ? 'blue' : 'gray'} className="mt-2">
              {client.type_client === 'pro' ? 'Professionnel — TVA 20%' : 'Particulier — TVA 10%'}
            </Badge>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Button onClick={() => navigate(`/intervention/nouveau?client_id=${id}`)} size="sm">
              <Plus size={14} /> Intervention
            </Button>
            {isAdmin && (
              <button onClick={deleteClient}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={12} /> Supprimer client
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-600 mb-4">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === i ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab 0 : Interventions ── */}
      {activeTab === 0 && (
        <div className="flex flex-col gap-3">
          {interventions.length === 0 && <p className="text-gray-500 text-center py-8">Aucune intervention</p>}
          {interventions.map(interv => (
            <Card key={interv.id} neon>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  {/* Date + heure badge */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-1 bg-dark-700 border border-dark-500 rounded-md px-2 py-0.5 text-xs text-gray-300 font-medium">
                      <Clock size={11} className="text-accent" />
                      {format(new Date(interv.date), 'dd/MM/yyyy', { locale: fr })}
                      {interv.heure && <span className="text-gray-500">· {fmtHeure(interv.heure)}</span>}
                    </span>
                    <Badge color="gray">{interv.mode_paiement}</Badge>
                  </div>
                  <div className="text-sm text-gray-200 font-medium">
                    {interv.type_panne === 'Autre' ? interv.type_panne_autre : interv.type_panne}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{interv.technicien_nom}</div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-2">
                  <MontantDisplay ttc={interv.montant_ttc} ht={interv.montant_ht} size="md" />
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(interv)}
                        className="text-gray-500 hover:text-accent transition-colors" title="Modifier">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => deleteIntervention(interv)}
                        className="text-gray-500 hover:text-red-400 transition-colors" title="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tab 1 : Notes & Facturation ── */}
      {activeTab === 1 && (
        <div className="flex flex-col gap-3">
          {interventions.length === 0 && <p className="text-gray-500 text-center py-8">Aucune intervention</p>}
          {interventions.map(interv => (
            <Card key={interv.id} neon>
              {/* En-tête avec date/heure badge */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="inline-flex items-center gap-1 bg-dark-700 border border-dark-500 rounded-md px-2 py-0.5 text-xs text-gray-300 font-medium">
                    <Clock size={11} className="text-accent" />
                    {format(new Date(interv.date), 'dd/MM/yyyy', { locale: fr })}
                    {interv.heure && <span className="text-gray-500"> · {fmtHeure(interv.heure)}</span>}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">{interv.technicien_nom}</div>
                </div>
                <MontantDisplay ttc={interv.montant_ttc} ht={interv.montant_ht} size="sm" />
              </div>

              {interv.notes_technicien && (
                <div className="bg-dark-700 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-500 mb-1">Notes technicien</p>
                  <p className="text-gray-300 text-sm">{interv.notes_technicien}</p>
                </div>
              )}
              {interv.type_panne === 'Autre' && interv.type_panne_autre && (
                <div className="bg-dark-700 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-500 mb-1">Prestation effectuée</p>
                  <p className="text-gray-300 text-sm">{interv.type_panne_autre}</p>
                </div>
              )}

              {/* Badges cliquables */}
              <div className="flex flex-wrap gap-3 mt-2">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Facture</p>
                  <Badge
                    onClick={() => toggleFacture(interv)}
                    color={interv.facture_envoyee ? 'blue' : interv.facture_editee ? 'green' : 'red'}
                    className={`badge-clickable ${toggling === interv.id + '_facture' ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {interv.facture_envoyee ? '✓✓ Envoyée' : interv.facture_editee ? '✓ Éditée' : '● Non éditée'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">SMS Avis Google</p>
                  <Badge
                    onClick={() => toggleSmsAvis(interv)}
                    color={interv.sms_avis_envoye ? 'green' : 'red'}
                    className={`badge-clickable ${toggling === interv.id + '_sms' ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {interv.sms_avis_envoye ? '✓ Envoyé' : '● Non envoyé'}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tab 2 : Photos ── */}
      {activeTab === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-200 font-medium">Photos ({photos.length})</h2>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => handlePhotoUpload(e, latestIntervention?.id)} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} size="sm">
                <Upload size={14} />
                {uploading ? 'Envoi...' : 'Ajouter'}
              </Button>
            </div>
          </div>
          {photos.length === 0 && <p className="text-gray-500 text-center py-8">Aucune photo</p>}
          {interventions.map(interv => {
            const intPhotos = photos.filter(p => p.intervention_id === interv.id)
            if (!intPhotos.length) return null
            return (
              <div key={interv.id} className="mb-6">
                <h3 className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <Clock size={12} className="text-accent" />
                  {format(new Date(interv.date), 'dd/MM/yyyy', { locale: fr })}
                  {interv.heure && ` · ${fmtHeure(interv.heure)}`} · {interv.type_panne}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {intPhotos.map(photo => (
                    <div key={photo.id} className="relative aspect-square" onClick={() => setLightbox(photo)}>
                      <img src={photo.url} alt="" className="w-full h-full object-cover rounded-lg cursor-pointer" />
                      <div className="absolute top-1 left-1">
                        <Badge color={photo.type === 'avant' ? 'yellow' : 'green'}>
                          {photo.type === 'avant' ? 'AVANT' : 'APRÈS'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white"><X size={24} /></button>
          <img src={lightbox.url} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      {/* ── Modal édition intervention (admin) ── */}
      <Modal open={!!editInterv} onClose={() => setEditInterv(null)} title="Modifier l'intervention" size="lg">
        {editInterv && (
          <div className="flex flex-col gap-4">
            <div className="bg-dark-700 rounded-lg px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
              <Clock size={14} className="text-accent" />
              {format(new Date(editInterv.date), 'dd/MM/yyyy', { locale: fr })} · {fmtHeure(editInterv.heure)} · {editInterv.technicien_nom}
            </div>

            <Select label="Type de panne" value={editForm.type_panne}
              onChange={e => setEditForm(f => ({ ...f, type_panne: e.target.value }))}>
              {TYPES_PANNE.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>

            {editForm.type_panne === 'Autre' && (
              <Textarea label="Description prestation" value={editForm.type_panne_autre}
                onChange={e => setEditForm(f => ({ ...f, type_panne_autre: e.target.value }))} rows={3} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Select label="Créneau" value={editForm.creneau}
                onChange={e => setEditForm(f => ({ ...f, creneau: e.target.value }))}>
                <option value="journee">Journée</option>
                <option value="nuit">Nuit</option>
              </Select>
              <Select label="Durée" value={editForm.duree_heures}
                onChange={e => setEditForm(f => ({ ...f, duree_heures: e.target.value }))}>
                {DUREES.map(d => <option key={d} value={d}>{d}h</option>)}
              </Select>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Montant TTC (€)</label>
              <input type="number" min="0" step="0.01" value={editForm.montant_ttc_saisi}
                onChange={e => setEditForm(f => ({ ...f, montant_ttc_saisi: e.target.value }))}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-gray-200 text-lg font-bold
                  focus:outline-none focus:border-accent" />
              {editForm.montant_ttc_saisi > 0 && (() => {
                const c = calculerHT(parseFloat(editForm.montant_ttc_saisi), client.type_client)
                return <p className="text-gray-500 text-xs mt-1">HT calculé : {c.montant_ht.toFixed(2)} € (TVA {c.tva_taux}%)</p>
              })()}
            </div>

            <Select label="Mode de paiement" value={editForm.mode_paiement}
              onChange={e => setEditForm(f => ({ ...f, mode_paiement: e.target.value }))}>
              {MODES_PAIEMENT.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>

            <Textarea label="Notes technicien" value={editForm.notes_technicien}
              onChange={e => setEditForm(f => ({ ...f, notes_technicien: e.target.value }))} rows={3} />

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditInterv(null)} variant="secondary" className="flex-1">Annuler</Button>
              <Button onClick={saveEdit} disabled={saving} className="flex-1">
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
