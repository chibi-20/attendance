import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { studentFullName, toDateStr } from '../lib/attendance'

export default function DailyAttendance() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sections, setSections] = useState([])
  const [students, setStudents] = useState([])
  const [statusByStudent, setStatusByStudent] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(null) // student id currently being saved

  const sectionId = searchParams.get('section') || ''
  const date = searchParams.get('date') || toDateStr(new Date())

  useEffect(() => {
    supabase
      .from('sections')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setSections(data)
        if (!sectionId && data.length > 0) {
          setSearchParams({ section: data[0].id, date })
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadRoster() {
    if (!sectionId) return
    setLoading(true)
    setError('')
    const [{ data: studentData, error: studentError }, { data: records, error: recError }] = await Promise.all([
      supabase.from('students').select('*').eq('section_id', sectionId).eq('is_active', true).order('last_name'),
      supabase.from('attendance_records').select('student_id, status').eq('date', date),
    ])
    if (studentError) setError(studentError.message)
    else setStudents(studentData)

    if (!recError && records) {
      const relevantIds = new Set((studentData || []).map((s) => s.id))
      const map = {}
      for (const r of records) {
        if (relevantIds.has(r.student_id)) map[r.student_id] = r.status
      }
      setStatusByStudent(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, date])

  function updateSection(id) {
    setSearchParams({ section: id, date })
  }

  function updateDate(d) {
    setSearchParams({ section: sectionId, date: d })
  }

  async function setStatus(studentId, status) {
    setSaving(studentId)
    const current = statusByStudent[studentId]
    const next = current === status ? 'present' : status // tap same button again -> revert to present

    if (next === 'present') {
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('student_id', studentId)
        .eq('date', date)
      if (error) {
        setError(error.message)
      } else {
        setStatusByStudent((prev) => {
          const copy = { ...prev }
          delete copy[studentId]
          return copy
        })
      }
    } else {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({ student_id: studentId, date, status: next }, { onConflict: 'student_id,date' })
      if (error) {
        setError(error.message)
      } else {
        setStatusByStudent((prev) => ({ ...prev, [studentId]: next }))
      }
    }
    setSaving(null)
  }

  const presentCount = students.length - Object.keys(statusByStudent).length
  const lateCount = Object.values(statusByStudent).filter((s) => s === 'late').length
  const absentCount = Object.values(statusByStudent).filter((s) => s === 'absent').length

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Take Attendance</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Section</label>
          <select
            value={sectionId}
            onChange={(e) => updateSection(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => updateDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="font-semibold text-green-700">{presentCount} present</span>
          <span className="font-semibold text-amber-600">{lateCount} late</span>
          <span className="font-semibold text-red-600">{absentCount} absent</span>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-gray-500">No active students in this section.</p>
      ) : (
        <ul className="space-y-2">
          {students.map((s) => {
            const status = statusByStudent[s.id] ?? 'present'
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow-sm"
              >
                <span className="text-lg font-medium text-gray-800">{studentFullName(s)}</span>
                <div className="flex gap-2">
                  <button
                    disabled={saving === s.id}
                    onClick={() => setStatus(s.id, 'late')}
                    className={`min-w-[96px] rounded-lg px-5 py-3 text-lg font-bold disabled:opacity-50 ${
                      status === 'late'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    Late
                  </button>
                  <button
                    disabled={saving === s.id}
                    onClick={() => setStatus(s.id, 'absent')}
                    className={`min-w-[96px] rounded-lg px-5 py-3 text-lg font-bold disabled:opacity-50 ${
                      status === 'absent'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    Absent
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
