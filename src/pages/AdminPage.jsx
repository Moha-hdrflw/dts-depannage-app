import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { UserPlus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

export function AdminPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email: '', prenom: '', nom: '', role: 'technicien' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').order('prenom')
    setUsers(data || [])
    setLoading(false)
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function createUser() {
    if (!form.email.trim() || !form.prenom.trim() || !form.nom.trim()) {
      setError('Email, prénom et nom sont requis')
      return
    }
    setCreating(true)
    setError('')

    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: tempPassword,
    })

    if (authError && !authError.message.includes('already registered')) {
      setError('Erreur : ' + authError.message)
      setCreating(false)
      return
    }

    const userId = authData?.user?.id
    if (userId) {
      await supabase.from('users').upsert([{
        id: userId,
        email: form.email,
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        role: form.role,
        actif: true,
      }])
    }

    setCreating(false)
    setShowModal(false)
    setForm({ email: '', prenom: '', nom: '', role: 'technicien' })
    setSuccess(`Compte créé pour ${form.prenom} ${form.nom}`)
    loadUsers()
    setTimeout(() => setSuccess(''), 5000)
  }

  async function toggleActif(user) {
    await supabase.from('users').update({ actif: !user.actif }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, actif: !u.actif } : u))
  }

  async function deleteUser(user) {
    if (!confirm(`Supprimer ${user.prenom} ${user.nom || ''} ? Cette action est irréversible.`)) return
    await supabase.from('users').delete().eq('id', user.id)
    setUsers(prev => prev.filter(u => u.id !== user.id))
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 sm:pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold neon-green">Gestion des accès</h1>
        <Button onClick={() => setShowModal(true)} size="sm">
          <UserPlus size={16} /> Créer un compte
        </Button>
      </div>

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm mb-4">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-center py-8">Chargement...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(user => (
            <div key={user.id} className="bg-dark-800 neon-card rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-100">
                    {user.prenom} {user.nom || ''}
                  </span>
                  <Badge color={user.role === 'admin' ? 'accent' : 'blue'}>{user.role}</Badge>
                  {!user.actif && <Badge color="red">Désactivé</Badge>}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{user.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActif(user)}
                  className={`transition-colors ${user.actif ? 'text-green-400 hover:text-yellow-400' : 'text-gray-600 hover:text-green-400'}`}
                  title={user.actif ? 'Désactiver' : 'Activer'}>
                  {user.actif ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                {user.role !== 'admin' && (
                  <button onClick={() => deleteUser(user)}
                    className="text-gray-600 hover:text-red-400 transition-colors" title="Supprimer">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Créer un compte">
        <div className="flex flex-col gap-4">
          <Input label="Email *" type="email" value={form.email}
            onChange={e => set('email', e.target.value)} placeholder="technicien@dts.fr" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom *" value={form.prenom}
              onChange={e => set('prenom', e.target.value)} placeholder="Prénom" />
            <Input label="Nom *" value={form.nom}
              onChange={e => set('nom', e.target.value)} placeholder="Nom" />
          </div>
          <Select label="Rôle" value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="technicien">Technicien</option>
            <option value="admin">Admin</option>
          </Select>
          <div className="bg-dark-700 rounded-lg p-3 text-sm text-gray-400">
            Le nom complet apparaîtra sur chaque intervention enregistrée.
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button onClick={createUser} disabled={creating} size="lg" className="w-full">
            {creating ? 'Création...' : 'Créer le compte'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
