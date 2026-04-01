import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { ArrowLeft } from 'lucide-react'

export function ClientFormPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nom: '', prenom: '', telephone: '', adresse: '', type_client: 'particulier'
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.nom.trim()) e.nom = 'Obligatoire'
    if (!form.prenom.trim()) e.prenom = 'Obligatoire'
    if (!form.telephone.trim()) e.telephone = 'Obligatoire'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    setLoading(true)
    const { data, error } = await supabase.from('clients').insert([{
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      telephone: form.telephone.trim(),
      adresse: form.adresse.trim(),
      type_client: form.type_client,
      date_creation: new Date().toISOString().split('T')[0],
    }]).select().single()
    setLoading(false)
    if (error) { alert('Erreur : ' + error.message); return }
    navigate(`/clients/${data.id}`)
  }

  return (
    <div className="max-w-lg mx-auto pb-20 sm:pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4 transition-colors">
        <ArrowLeft size={16} />
        Retour
      </button>
      <h1 className="text-xl font-bold text-gray-100 mb-6">Nouveau client</h1>

      <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom *" value={form.prenom} onChange={e => set('prenom', e.target.value)} error={errors.prenom} />
          <Input label="Nom *" value={form.nom} onChange={e => set('nom', e.target.value)} error={errors.nom} />
        </div>
        <Input label="Téléphone *" type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} error={errors.telephone} />
        <Input label="Adresse" value={form.adresse} onChange={e => set('adresse', e.target.value)} />
        <Select label="Type de client" value={form.type_client} onChange={e => set('type_client', e.target.value)}>
          <option value="particulier">Particulier (TVA 10%)</option>
          <option value="pro">Professionnel (TVA 20%)</option>
        </Select>
        <Button type="submit" disabled={loading} size="lg" className="w-full mt-2">
          {loading ? 'Enregistrement...' : 'Créer le client'}
        </Button>
      </form>
    </div>
  )
}
