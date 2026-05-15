import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, MontantDisplay } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { ArrowLeft, Plus, Upload, X, Pencil, Trash2, Clock, UserPen, Building2, Package, FileText, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { calculerHT, calculerTTC, calculerTTCTaux, TYPES_PANNE, DUREES, MODES_PAIEMENT, fmtHeure, fmtEuro } from '../lib/tarifs'

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

  // Edit client
  const [editClientOpen, setEditClientOpen] = useState(false)
  const [editClientForm, setEditClientForm] = useState({})
  const [savingClient, setSavingClient] = useState(false)

  // Delete photo
  const [deletingPhoto, setDeletingPhoto] = useState(null)

  // Docs upload (edit modal)
  const editDevisRef = useRef()
  const editFactureRef = useRef()
  const [editDevisFile, setEditDevisFile] = useState(null)
  const [editFactureFile, setEditFactureFile] = useState(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)

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
    const intIds = interventions.map(i => i.id)
    if (intIds.length) {
      await supabase.from('photos').delete().in('intervention_id', intIds)
      await supabase.from('interventions').delete().eq('client_id', id)
    }
    await supabase.from('photos').delete().eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    navigate('/clients')
  }

  // ── Édition client ──
  function openEditClient() {
    setEditClientForm({
      type_client: client.type_client || 'particulier',
      prenom:      client.prenom || '',
      nom:         client.nom || '',
      nom_societe: client.type_client === 'pro' ? (client.nom || '') : '',
      telephone:   client.telephone || '',
      email:       client.email || '',
      adresse:     client.adresse || '',
      code_postal: client.code_postal || '',
      ville:       client.ville || '',
    })
    setEditClientOpen(true)
  }

  async function saveEditClient() {
    setSavingClient(true)
    const isPro = editClientForm.type_client === 'pro'
    const updates = {
      type_client:  editClientForm.type_client,
      nom:          isPro ? editClientForm.nom_societe.trim() : editClientForm.nom.trim(),
      prenom:       isPro ? '' : editClientForm.prenom.trim(),
      telephone:    editClientForm.telephone.trim(),
      email:        editClientForm.email.trim() || null,
      adresse:      editClientForm.adresse.trim() || null,
      code_postal:  editClientForm.code_postal.trim() || null,
      ville:        editClientForm.ville.trim() || null,
    }
    const { error } = await supabase.from('clients').update(updates).eq('id', id)
    if (error) {
      alert('Erreur : ' + error.message)
    } else {
      setClient(prev => ({ ...prev, ...updates }))
      setEditClientOpen(false)
    }
    setSavingClient(false)
  }

  // ── Édition intervention (admin) ──
  function openEdit(interv) {
    setEditInterv(interv)
    setEditDevisFile(null)
    setEditFactureFile(null)
    setEditForm({
      type_panne:          interv.type_panne,
      type_panne_autre:    interv.type_panne_autre || '',
      creneau:             interv.creneau,
      duree_heures:        interv.duree_heures || 1,
      montant_ht_saisi:    interv.montant_ht || '',
      mode_paiement:       interv.mode_paiement,
      notes_technicien:    interv.notes_technicien || '',
      fourniture_ht_saisi: interv.fourniture_ht || '',
      fourniture_tva_taux: interv.fourniture_tva_taux || 10,
      devis_url:           interv.devis_url || '',
      facture_url:         interv.facture_url || '',
    })
  }

  async function saveEdit() {
    setSaving(true)
    const htVal = parseFloat(editForm.montant_ht_saisi) || 0
    const { montant_ht, tva_taux, montant_ttc } = calculerTTC(htVal, client.type_client)
    const fourniHTVal = parseFloat(editForm.fourniture_ht_saisi) || 0
    const fourniCalc = fourniHTVal > 0 ? calculerTTCTaux(fourniHTVal, parseInt(editForm.fourniture_tva_taux)) : null

    // Upload nouveaux documents si sélectionnés
    let devis_url = editForm.devis_url || null
    let facture_url = editForm.facture_url || null
    setUploadingDoc(true)
    if (editDevisFile) {
      const safeName = editDevisFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${editInterv.client_id}/docs/${Date.now()}_devis_${safeName}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, editDevisFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
        devis_url = urlData.publicUrl
      }
    }
    if (editFactureFile) {
      const safeName = editFactureFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${editInterv.client_id}/docs/${Date.now()}_facture_${safeName}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, editFactureFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
        facture_url = urlData.publicUrl
      }
    }
    setUploadingDoc(false)

    const updates = {
      type_panne:          editForm.type_panne,
      type_panne_autre:    editForm.type_panne === 'Autre' ? editForm.type_panne_autre : null,
      creneau:             editForm.creneau,
      duree_heures:        parseFloat(editForm.duree_heures),
      montant_ht,
      tva_taux,
      montant_ttc,
      mode_paiement:       editForm.mode_paiement,
      notes_technicien:    editForm.notes_technicien,
      fourniture_ht:       fourniHTVal > 0 ? fourniHTVal : null,
      fourniture_tva_taux: fourniHTVal > 0 ? parseInt(editForm.fourniture_tva_taux) : null,
      fourniture_ttc:      fourniCalc?.montant_ttc || null,
      devis_url,
      facture_url,
    }
    await supabase.from('interventions').update(updates).eq('id', editInterv.id)
    setInterventions(prev => prev.map(i => i.id === editInterv.id ? { ...i, ...updates } : i))
    setSaving(false)
    setEditInterv(null)
  }

  // ── Upload photo ──
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
      alert(`Erreur upload : ${upErr.message}`)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
    await supabase.from('photos').insert([{
      client_id:       id,
      intervention_id: interventionId || null,
      url:             urlData.publicUrl,
      type:            typeLabel,
      date_upload:     new Date().toISOString(),
    }])
    setUploading(false)
    loadAll()
  }

  // ── Suppression photo ──
  async function deletePhoto(photo) {
    if (!confirm('Supprimer cette photo ?')) return
    setDeletingPhoto(photo.id)
    try {
      // Extraire le path depuis l'URL publique : tout ce qui est après "/photos/"
      const urlParts = photo.url.split('/photos/')
      if (urlParts.length > 1) {
        const storagePath = decodeURIComponent(urlParts[1].split('?')[0])
        await supabase.storage.from('photos').remove([storagePath])
      }
      await supabase.from('photos').delete().eq('id', photo.id)
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
    } catch (err) {
      alert('Erreur suppression : ' + err.message)
    }
    setDeletingPhoto(null)
  }

  if (loading) return <div className="text-gray-400 p-8 text-center">Chargement...</div>
  if (!client) return <div className="text-gray-400 p-8 text-center">Client introuvable</div>

  const latestIntervention = interventions[0]
  const isPro = client.type_client === 'pro'
  const clientNom = isPro ? client.nom : `${client.prenom || ''} ${client.nom || ''}`.trim()

  return (
    <div className="max-w-2xl mx-auto pb-24 sm:pb-4">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4 transition-colors">
        <ArrowLeft size={16} /> Retour
      </button>

      {/* ── Header client ── */}
      <div className="bg-dark-800 neon-card rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold neon-green truncate">{clientNom}</h1>
              {/* Bouton modifier client */}
              <button onClick={openEditClient}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-accent transition-colors border border-dark-500 hover:border-accent/40 rounded-md px-2 py-0.5">
                <UserPen size={12} /> Modifier
              </button>
            </div>
            <p className="text-gray-400 text-sm mt-0.5">{client.telephone}</p>
            {client.email && <p className="text-gray-500 text-sm">{client.email}</p>}
            {client.adresse && <p className="text-gray-500 text-sm">{client.adresse}</p>}
            {(client.code_postal || client.ville) && (
              <p className="text-gray-500 text-sm">
                {[client.code_postal, client.ville].filter(Boolean).join(' ')}
              </p>
            )}
            <Badge color={isPro ? 'blue' : 'purple'} className="mt-2">
              {isPro ? 'Professionnel — TVA 20%' : 'Particulier — TVA 10%'}
            </Badge>
          </div>
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
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
            {i === 2 && photos.length > 0 && (
              <span className="ml-1 text-xs text-gray-600">({photos.length})</span>
            )}
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
                  {/* Fournitures */}
                  {interv.fourniture_ttc > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Package size={11} className="text-orange-400" />
                      <span className="text-xs text-orange-400">Fournitures : {fmtEuro(interv.fourniture_ttc)} TTC</span>
                    </div>
                  )}
                  {/* Documents */}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {interv.devis_url && (
                      <a href={interv.devis_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        <FileText size={11} /> Devis <ExternalLink size={9} />
                      </a>
                    )}
                    {interv.facture_url && (
                      <a href={interv.facture_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors">
                        <FileText size={11} /> Facture <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
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
                {uploading ? 'Envoi...' : 'Ajouter une photo'}
              </Button>
            </div>
          </div>

          {photos.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              <Upload size={32} className="mx-auto mb-3 opacity-30" />
              <p>Aucune photo pour ce client</p>
            </div>
          )}

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
                    <div key={photo.id} className="relative aspect-square group">
                      <img
                        src={photo.url} alt=""
                        className="w-full h-full object-cover rounded-lg cursor-pointer"
                        onClick={() => setLightbox(photo)}
                      />
                      {/* Badge type */}
                      <div className="absolute top-1 left-1">
                        <Badge color={photo.type === 'avant' ? 'yellow' : 'green'} className="text-[10px] px-1.5 py-0.5">
                          {photo.type === 'avant' ? 'AVANT' : 'APRÈS'}
                        </Badge>
                      </div>
                      {/* Bouton supprimer */}
                      <button
                        onClick={e => { e.stopPropagation(); deletePhoto(photo) }}
                        disabled={deletingPhoto === photo.id}
                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6
                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                          disabled:opacity-50"
                        title="Supprimer la photo"
                      >
                        {deletingPhoto === photo.id
                          ? <span className="text-[10px]">...</span>
                          : <X size={12} />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Photos sans intervention associée */}
          {photos.filter(p => !p.intervention_id).length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm text-gray-400 mb-2">Photos non associées</h3>
              <div className="grid grid-cols-3 gap-2">
                {photos.filter(p => !p.intervention_id).map(photo => (
                  <div key={photo.id} className="relative aspect-square group">
                    <img
                      src={photo.url} alt=""
                      className="w-full h-full object-cover rounded-lg cursor-pointer"
                      onClick={() => setLightbox(photo)}
                    />
                    <div className="absolute top-1 left-1">
                      <Badge color={photo.type === 'avant' ? 'yellow' : 'green'} className="text-[10px] px-1.5 py-0.5">
                        {photo.type === 'avant' ? 'AVANT' : 'APRÈS'}
                      </Badge>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deletePhoto(photo) }}
                      disabled={deletingPhoto === photo.id}
                      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6
                        flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
                        disabled:opacity-50"
                      title="Supprimer la photo"
                    >
                      {deletingPhoto === photo.id ? <span className="text-[10px]">...</span> : <X size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300">
            <X size={28} />
          </button>
          <img src={lightbox.url} alt="" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
            <Badge color={lightbox.type === 'avant' ? 'yellow' : 'green'}>
              {lightbox.type === 'avant' ? 'AVANT' : 'APRÈS'}
            </Badge>
            <button
              onClick={e => { e.stopPropagation(); setLightbox(null); deletePhoto(lightbox) }}
              className="flex items-center gap-1 bg-red-500/80 hover:bg-red-500 text-white text-xs rounded-full px-3 py-1 transition-colors">
              <Trash2 size={12} /> Supprimer
            </button>
          </div>
        </div>
      )}

      {/* ── Modal édition client ── */}
      <Modal open={editClientOpen} onClose={() => setEditClientOpen(false)} title="Modifier le client" size="lg">
        <div className="flex flex-col gap-4">
          <Select label="Type de client" value={editClientForm.type_client}
            onChange={e => setEditClientForm(f => ({ ...f, type_client: e.target.value }))}>
            <option value="particulier">Particulier — TVA 10%</option>
            <option value="pro">Professionnel — TVA 20%</option>
          </Select>

          {editClientForm.type_client === 'pro' ? (
            <div className="flex items-center gap-2 bg-dark-700 rounded-lg p-3">
              <Building2 size={16} className="text-accent flex-shrink-0 mt-5" />
              <Input label="Nom de société *" value={editClientForm.nom_societe || ''}
                onChange={e => setEditClientForm(f => ({ ...f, nom_societe: e.target.value }))}
                className="flex-1" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Prénom" value={editClientForm.prenom || ''}
                onChange={e => setEditClientForm(f => ({ ...f, prenom: e.target.value }))} />
              <Input label="Nom" value={editClientForm.nom || ''}
                onChange={e => setEditClientForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
          )}

          <Input label="Téléphone *" type="tel" value={editClientForm.telephone || ''}
            onChange={e => setEditClientForm(f => ({ ...f, telephone: e.target.value }))} />

          <Input label="Email" type="email" value={editClientForm.email || ''}
            onChange={e => setEditClientForm(f => ({ ...f, email: e.target.value }))} />

          <Input label="Adresse" value={editClientForm.adresse || ''}
            onChange={e => setEditClientForm(f => ({ ...f, adresse: e.target.value }))} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Code postal" value={editClientForm.code_postal || ''}
              onChange={e => setEditClientForm(f => ({ ...f, code_postal: e.target.value }))}
              placeholder="75001" />
            <Input label="Ville" value={editClientForm.ville || ''}
              onChange={e => setEditClientForm(f => ({ ...f, ville: e.target.value }))}
              placeholder="Paris" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={() => setEditClientOpen(false)} variant="secondary" className="flex-1">
              Annuler
            </Button>
            <Button onClick={saveEditClient} disabled={savingClient} className="flex-1">
              {savingClient ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

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
              <label className="text-sm text-gray-400 block mb-1">Montant HT (€)</label>
              <input type="number" min="0" step="0.01" value={editForm.montant_ht_saisi}
                onChange={e => setEditForm(f => ({ ...f, montant_ht_saisi: e.target.value }))}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-gray-200 text-lg font-bold
                  focus:outline-none focus:border-accent" />
              {editForm.montant_ht_saisi > 0 && (() => {
                const c = calculerTTC(parseFloat(editForm.montant_ht_saisi), client.type_client)
                return (
                  <p className="text-xs mt-1 neon-green font-medium">
                    TTC : {c.montant_ttc.toFixed(2)} € (TVA {c.tva_taux}%)
                  </p>
                )
              })()}
            </div>

            <Select label="Mode de paiement" value={editForm.mode_paiement}
              onChange={e => setEditForm(f => ({ ...f, mode_paiement: e.target.value }))}>
              {MODES_PAIEMENT.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>

            <Textarea label="Notes technicien" value={editForm.notes_technicien}
              onChange={e => setEditForm(f => ({ ...f, notes_technicien: e.target.value }))} rows={3} />

            {/* ── Fournitures ── */}
            <div className="border-t border-dark-600 pt-3">
              <p className="text-sm text-gray-400 mb-2 flex items-center gap-1.5"><Package size={14} /> Fournitures</p>
              <Input label="Coût HT (€)" type="number" min="0" step="0.01"
                value={editForm.fourniture_ht_saisi}
                onChange={e => setEditForm(f => ({ ...f, fourniture_ht_saisi: e.target.value }))}
                placeholder="0.00" />
              {parseFloat(editForm.fourniture_ht_saisi) > 0 && (
                <>
                  <div className="mt-2">
                    <Select label="TVA fournitures" value={editForm.fourniture_tva_taux}
                      onChange={e => setEditForm(f => ({ ...f, fourniture_tva_taux: parseInt(e.target.value) }))}>
                      <option value={10}>TVA 10%</option>
                      <option value={20}>TVA 20%</option>
                    </Select>
                  </div>
                  <p className="text-xs text-orange-400 mt-1">
                    TTC : {fmtEuro(calculerTTCTaux(parseFloat(editForm.fourniture_ht_saisi), parseInt(editForm.fourniture_tva_taux)).montant_ttc)}
                  </p>
                </>
              )}
            </div>

            {/* ── Documents ── */}
            <div className="border-t border-dark-600 pt-3">
              <p className="text-sm text-gray-400 mb-2 flex items-center gap-1.5"><FileText size={14} /> Documents</p>
              <input ref={editDevisRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
                onChange={e => setEditDevisFile(e.target.files[0] || null)} />
              <input ref={editFactureRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
                onChange={e => setEditFactureFile(e.target.files[0] || null)} />

              {/* Devis */}
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => editDevisRef.current?.click()}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors
                    ${editDevisFile ? 'border-accent/50 bg-accent/5 text-accent' : 'border-dark-500 bg-dark-700 text-gray-400 hover:border-accent/30'}`}>
                  <FileText size={13} />
                  <span className="truncate">{editDevisFile ? editDevisFile.name : editForm.devis_url ? 'Remplacer le devis' : 'Ajouter un devis…'}</span>
                </button>
                {editForm.devis_url && (
                  <a href={editForm.devis_url} target="_blank" rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex-shrink-0" title="Voir le devis">
                    <ExternalLink size={15} />
                  </a>
                )}
                {(editDevisFile || editForm.devis_url) && (
                  <button type="button" onClick={() => { setEditDevisFile(null); setEditForm(f => ({ ...f, devis_url: '' })) }}
                    className="text-gray-500 hover:text-red-400 flex-shrink-0"><X size={15} /></button>
                )}
              </div>

              {/* Facture */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editFactureRef.current?.click()}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors
                    ${editFactureFile ? 'border-accent/50 bg-accent/5 text-accent' : 'border-dark-500 bg-dark-700 text-gray-400 hover:border-accent/30'}`}>
                  <FileText size={13} />
                  <span className="truncate">{editFactureFile ? editFactureFile.name : editForm.facture_url ? 'Remplacer la facture' : 'Ajouter une facture…'}</span>
                </button>
                {editForm.facture_url && (
                  <a href={editForm.facture_url} target="_blank" rel="noreferrer"
                    className="text-accent hover:text-accent/80 flex-shrink-0" title="Voir la facture">
                    <ExternalLink size={15} />
                  </a>
                )}
                {(editFactureFile || editForm.facture_url) && (
                  <button type="button" onClick={() => { setEditFactureFile(null); setEditForm(f => ({ ...f, facture_url: '' })) }}
                    className="text-gray-500 hover:text-red-400 flex-shrink-0"><X size={15} /></button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditInterv(null)} variant="secondary" className="flex-1">Annuler</Button>
              <Button onClick={saveEdit} disabled={saving || uploadingDoc} className="flex-1">
                {uploadingDoc ? 'Upload...' : saving ? 'Sauvegarde...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
