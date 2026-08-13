import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Sections() {
  const { user } = useAuth()
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [editingId, setEditingId] = useState(null)

  async function loadSections() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sections')
      .select('*, students(count)')
      .order('name')
    if (error) setError(error.message)
    else setSections(data)
    setLoading(false)
  }

  useEffect(() => {
    loadSections()
  }, [])

  function resetForm() {
    setName('')
    setSchoolYear('')
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (editingId) {
      const { error } = await supabase
        .from('sections')
        .update({ name, school_year: schoolYear })
        .eq('id', editingId)
      if (error) return setError(error.message)
    } else {
      const { error } = await supabase
        .from('sections')
        .insert({ name, school_year: schoolYear, teacher_id: user.id })
      if (error) return setError(error.message)
    }
    resetForm()
    loadSections()
  }

  function startEdit(section) {
    setEditingId(section.id)
    setName(section.name)
    setSchoolYear(section.school_year)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this section and all its students and attendance history? This cannot be undone.')) return
    const { error } = await supabase.from('sections').delete().eq('id', id)
    if (error) setError(error.message)
    else loadSections()
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Sections</h1>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Section name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="AP10 - Masikap"
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">School year</label>
          <input
            required
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            placeholder="2026-2027"
            className="w-32 rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
          {editingId ? 'Save changes' : 'Add section'}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="rounded-md px-4 py-2 font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
        )}
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : sections.length === 0 ? (
        <p className="text-gray-500">No sections yet. Add one above.</p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-sm text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">School Year</th>
                <th className="px-4 py-2">Students</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sections.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.school_year}</td>
                  <td className="px-4 py-3 text-gray-600">{s.students?.[0]?.count ?? 0}</td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    <Link to={`/sections/${s.id}/roster`} className="text-sm font-medium text-blue-600 hover:underline">
                      Roster
                    </Link>
                    <button onClick={() => startEdit(s)} className="text-sm font-medium text-gray-600 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="text-sm font-medium text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
