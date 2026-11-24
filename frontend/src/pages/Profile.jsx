import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addFamilyMember, deleteFamilyMember, getFamilyMembers, updateFamilyMember } from '../services/familyService'
import { getProfile, updateProfile } from '../services/authService'

const initialFamilyForm = {
  full_name: '',
  relationship: '',
  date_of_birth: '',
  occupation: '',
  annual_income: '',
}

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({
    full_name: user?.name || '',
    phone: '',
    date_of_birth: '',
    address: '',
    state: '',
    district: '',
    occupation: '',
    annual_income: '',
  })
  const [family, setFamily] = useState([])
  const [familyForm, setFamilyForm] = useState(initialFamilyForm)
  const [editingFamilyId, setEditingFamilyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getProfile(), getFamilyMembers()])
      .then(([profileResponse, familyResponse]) => {
        if (!active) return
        if (profileResponse.data) {
          setProfile((current) => ({ ...current, ...profileResponse.data, annual_income: profileResponse.data.annual_income ?? '' }))
        }
        setFamily(familyResponse.data)
      })
      .catch(() => { if (active) setError('Your profile could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const saveProfile = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data } = await updateProfile({
        ...profile,
        annual_income: profile.annual_income === '' ? null : Number(profile.annual_income),
        date_of_birth: profile.date_of_birth || null,
      })
      setProfile((current) => ({ ...current, ...data, annual_income: data.annual_income ?? '' }))
      setNotice('Profile saved.')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Your profile could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const saveFamilyMember = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...familyForm,
        date_of_birth: familyForm.date_of_birth || null,
        annual_income: familyForm.annual_income === '' ? null : Number(familyForm.annual_income),
      }
      const { data } = editingFamilyId
        ? await updateFamilyMember(editingFamilyId, payload)
        : await addFamilyMember(payload)
      setFamily((current) => editingFamilyId
        ? current.map((member) => member.id === editingFamilyId ? data : member)
        : [...current, data])
      setFamilyForm(initialFamilyForm)
      const wasEditing = Boolean(editingFamilyId)
      setEditingFamilyId('')
      setNotice(wasEditing ? 'Family member updated.' : 'Family member added.')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Family member could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const removeFamilyMember = async (member) => {
    if (!window.confirm(`Remove ${member.full_name} from your family profile?`)) return
    setError('')
    try {
      await deleteFamilyMember(member.id)
      setFamily((current) => current.filter((item) => item.id !== member.id))
      if (editingFamilyId === member.id) {
        setEditingFamilyId('')
        setFamilyForm(initialFamilyForm)
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Family member could not be removed.')
    }
  }

  const update = (key, value) => setProfile((current) => ({ ...current, [key]: value }))
  const updateFamily = (key, value) => setFamilyForm((current) => ({ ...current, [key]: value }))
  const editFamilyMember = (member) => {
    setEditingFamilyId(member.id)
    setFamilyForm({
      full_name: member.full_name || '',
      relationship: member.relationship || '',
      date_of_birth: member.date_of_birth || '',
      occupation: member.occupation || '',
      annual_income: member.annual_income ?? '',
    })
    setNotice('')
  }
  const cancelFamilyEdit = () => {
    setEditingFamilyId('')
    setFamilyForm(initialFamilyForm)
  }

  return <>
    <header className="app-header"><div><span>YOUR INFORMATION</span><h1>Profile & family</h1></div></header>
    <main className="dashboard-content">
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-notice" role="status">{notice}</div>}
      {loading ? <div className="panel empty-state">Loading your private profile…</div> : <>
        <form className="panel form-panel profile-form" onSubmit={saveProfile}>
          <div className="panel-head"><div><span>PERSONAL DETAILS</span><h2>Citizen profile</h2></div></div>
          <div className="form-grid">
            <label>Full name<input required minLength="2" maxLength="120" value={profile.full_name} onChange={(event) => update('full_name', event.target.value)}/></label>
            <label>Email address<input value={user?.email || ''} disabled/></label>
            <label>Phone<input maxLength="32" value={profile.phone || ''} onChange={(event) => update('phone', event.target.value)}/></label>
            <label>Date of birth<input type="date" value={profile.date_of_birth || ''} onChange={(event) => update('date_of_birth', event.target.value)}/></label>
            <label>Occupation<input maxLength="120" value={profile.occupation || ''} onChange={(event) => update('occupation', event.target.value)}/></label>
            <label>Annual household income (INR)<input type="number" min="0" step="0.01" value={profile.annual_income} onChange={(event) => update('annual_income', event.target.value)}/></label>
            <label>State<input maxLength="100" value={profile.state || ''} onChange={(event) => update('state', event.target.value)}/></label>
            <label>District<input maxLength="100" value={profile.district || ''} onChange={(event) => update('district', event.target.value)}/></label>
          </div>
          <label>Address<textarea rows="3" maxLength="1000" value={profile.address || ''} onChange={(event) => update('address', event.target.value)}/></label>
          <button className="btn btn-primary generate-button" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>

        <section className="panel family-panel">
          <div className="panel-head"><div><span>HOUSEHOLD INFORMATION</span><h2>Family members</h2></div></div>
          {family.map((member) => <div className="family-row" key={member.id}>
            <div><strong>{member.full_name}</strong><small>{member.relationship}{member.occupation ? ` · ${member.occupation}` : ''}</small></div>
            <button type="button" className="link-button" onClick={() => editFamilyMember(member)}>Edit</button>
            <button type="button" className="link-button" onClick={() => removeFamilyMember(member)}>Remove</button>
          </div>)}
          {!family.length && <p className="empty-state">No family members added.</p>}
          <form className="form-panel family-form" onSubmit={saveFamilyMember}>
            <h3>{editingFamilyId ? 'Edit family member' : 'Add a family member'}</h3>
            <div className="form-grid">
              <label>Full name<input required minLength="2" maxLength="120" value={familyForm.full_name} onChange={(event) => updateFamily('full_name', event.target.value)}/></label>
              <label>Relationship<input required maxLength="80" value={familyForm.relationship} onChange={(event) => updateFamily('relationship', event.target.value)}/></label>
              <label>Date of birth<input type="date" value={familyForm.date_of_birth} onChange={(event) => updateFamily('date_of_birth', event.target.value)}/></label>
              <label>Occupation<input maxLength="120" value={familyForm.occupation} onChange={(event) => updateFamily('occupation', event.target.value)}/></label>
              <label>Annual income (INR)<input type="number" min="0" step="0.01" value={familyForm.annual_income} onChange={(event) => updateFamily('annual_income', event.target.value)}/></label>
            </div>
            <button className="btn btn-secondary" disabled={busy}>{editingFamilyId ? 'Save family member' : 'Add family member'}</button>
            {editingFamilyId && <button type="button" className="link-button" onClick={cancelFamilyEdit}>Cancel edit</button>}
          </form>
        </section>
      </>}
    </main>
  </>
}
