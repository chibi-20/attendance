import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toDateStr } from '../lib/attendance'

export default function Dashboard() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = toDateStr(new Date())

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: sectionData, error: sectionError } = await supabase
        .from('sections')
        .select('id, name, school_year, students(id, is_active)')
        .order('name')

      if (sectionError) {
        setError(sectionError.message)
        setLoading(false)
        return
      }

      const { data: records, error: recError } = await supabase
        .from('attendance_records')
        .select('student_id, status, students(section_id)')
        .eq('date', today)

      if (recError) {
        setError(recError.message)
        setLoading(false)
        return
      }

      const enriched = sectionData.map((s) => {
        const activeCount = s.students.filter((st) => st.is_active).length
        const sectionRecords = records.filter((r) => r.students?.section_id === s.id)
        const late = sectionRecords.filter((r) => r.status === 'late').length
        const absent = sectionRecords.filter((r) => r.status === 'absent').length
        const present = activeCount - late - absent
        return { ...s, activeCount, present, late, absent }
      })

      setSections(enriched)
      setLoading(false)
    }
    load()
  }, [today])

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-800">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">
        {new Date(today + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : sections.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="mb-3 text-gray-500">No sections yet.</p>
          <Link to="/sections" className="font-medium text-blue-600 hover:underline">
            Create your first section →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <div key={s.id} className="flex flex-col justify-between rounded-lg bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{s.name}</h2>
                <p className="mb-3 text-sm text-gray-500">{s.school_year} · {s.activeCount} students</p>
                <div className="flex gap-4 text-sm">
                  <span className="font-semibold text-green-700">{s.present} present</span>
                  <span className="font-semibold text-amber-600">{s.late} late</span>
                  <span className="font-semibold text-red-600">{s.absent} absent</span>
                </div>
              </div>
              <Link
                to={`/attendance?section=${s.id}&date=${today}`}
                className="mt-4 block rounded-md bg-blue-600 py-2.5 text-center font-semibold text-white hover:bg-blue-700"
              >
                Take Attendance
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
