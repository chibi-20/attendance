import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { studentFullName } from '../lib/attendance'

const emptyForm = { lrn: '', last_name: '', first_name: '', middle_name: '', sex: 'M' }

export default function Roster() {
  const { sectionId } = useParams()
  const [section, setSection] = useState(null)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const fileInputRef = useRef(null)
  const [importSummary, setImportSummary] = useState(null)

  async function loadData() {
    setLoading(true)
    const [{ data: sectionData }, { data: studentData, error: studentError }] = await Promise.all([
      supabase.from('sections').select('*').eq('id', sectionId).single(),
      supabase.from('students').select('*').eq('section_id', sectionId).order('last_name'),
    ])
    setSection(sectionData)
    if (studentError) setError(studentError.message)
    else setStudents(studentData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const payload = {
      lrn: form.lrn || null,
      last_name: form.last_name,
      first_name: form.first_name,
      middle_name: form.middle_name || null,
      sex: form.sex,
    }
    if (editingId) {
      const { error } = await supabase.from('students').update(payload).eq('id', editingId)
      if (error) return setError(error.message)
    } else {
      const { error } = await supabase.from('students').insert({ ...payload, section_id: sectionId })
      if (error) return setError(error.message)
    }
    resetForm()
    loadData()
  }

  function startEdit(s) {
    setEditingId(s.id)
    setForm({
      lrn: s.lrn ?? '',
      last_name: s.last_name,
      first_name: s.first_name,
      middle_name: s.middle_name ?? '',
      sex: s.sex ?? 'M',
    })
  }

  async function toggleActive(s) {
    const { error } = await supabase.from('students').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) setError(error.message)
    else loadData()
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this student and all their attendance history?')) return
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) setError(error.message)
    else loadData()
  }

  function handleCsvSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/_/g, ' '),
      complete: async (results) => {
        const rows = results.data
          .map((r) => ({
            lrn: (r.lrn || '').trim() || null,
            last_name: (r['last name'] || '').trim(),
            first_name: (r['first name'] || '').trim(),
            middle_name: (r['middle name'] || '').trim() || null,
            sex: (r.sex || '').trim().toUpperCase() || null,
            section_id: sectionId,
          }))
          .filter((r) => r.last_name && r.first_name)

        if (rows.length === 0) {
          setImportSummary({ ok: false, message: 'No valid rows found. Expected columns: LRN, Last Name, First Name, Middle Name, Sex.' })
          return
        }

        const { error, data } = await supabase.from('students').insert(rows).select()
        if (error) {
          setImportSummary({ ok: false, message: error.message })
        } else {
          setImportSummary({ ok: true, message: `Imported ${data.length} student(s).` })
          loadData()
        }
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
      error: (err) => setImportSummary({ ok: false, message: err.message }),
    })
  }

  const visibleStudents = students.filter((s) => showInactive || s.is_active)

  return (
    <div>
      <Link to="/sections" className="text-sm font-medium text-blue-600 hover:underline">
        ← All sections
      </Link>
      <h1 className="mb-4 mt-1 text-2xl font-bold text-gray-800">
        {section ? section.name : 'Roster'}
      </h1>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">LRN</label>
          <input
            value={form.lrn}
            onChange={(e) => setForm({ ...form, lrn: e.target.value })}
            className="w-36 rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Last name</label>
          <input
            required
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">First name</label>
          <input
            required
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Middle name</label>
          <input
            value={form.middle_name}
            onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Sex</label>
          <select
            value={form.sex}
            onChange={(e) => setForm({ ...form, sex: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
          {editingId ? 'Save changes' : 'Add student'}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="rounded-md px-4 py-2 font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
        )}
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-gray-700">Bulk import CSV (LRN, Last Name, First Name, Middle Name, Sex):</label>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvSelect} className="text-sm" />
        {importSummary && (
          <span className={`text-sm ${importSummary.ok ? 'text-green-600' : 'text-red-600'}`}>
            {importSummary.message}
          </span>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <label className="mb-2 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show inactive (dropped/transferred) students
      </label>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : visibleStudents.length === 0 ? (
        <p className="text-gray-500">No students yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-sm text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">LRN</th>
                <th className="px-4 py-2">Sex</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleStudents.map((s) => (
                <tr key={s.id} className={s.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium text-gray-800">{studentFullName(s)}</td>
                  <td className="px-4 py-3 text-gray-600">{s.lrn || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.sex || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    <button onClick={() => startEdit(s)} className="text-sm font-medium text-gray-600 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => toggleActive(s)} className="text-sm font-medium text-amber-600 hover:underline">
                      {s.is_active ? 'Mark inactive' : 'Mark active'}
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
