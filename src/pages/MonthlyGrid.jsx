import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { studentFullName } from '../lib/attendance'
import { daysInMonth, isSchoolDay, toDateStr } from '../lib/calendar'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_CYCLE = ['present', 'late', 'absent']
const STATUS_LABEL = { present: '', late: 'L', absent: 'A' }
const STATUS_CLASS = {
  present: 'text-gray-300',
  late: 'bg-amber-100 text-amber-800 font-bold',
  absent: 'bg-red-100 text-red-800 font-bold',
}

export default function MonthlyGrid() {
  const [searchParams, setSearchParams] = useSearchParams()
  const now = new Date()
  const sectionId = searchParams.get('section') || ''
  const year = Number(searchParams.get('year')) || now.getFullYear()
  const monthIndex = searchParams.get('month') != null ? Number(searchParams.get('month')) : now.getMonth()

  const [sections, setSections] = useState([])
  const [students, setStudents] = useState([])
  const [calendarRows, setCalendarRows] = useState({})
  const [records, setRecords] = useState({}) // studentId -> { dateStr: status }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const days = useMemo(() => daysInMonth(year, monthIndex), [year, monthIndex])
  const schoolDays = useMemo(
    () => days.filter((d) => isSchoolDay(d, calendarRows[toDateStr(d)])),
    [days, calendarRows]
  )

  useEffect(() => {
    supabase
      .from('sections')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setSections(data)
        if (!sectionId && data.length > 0) {
          setSearchParams({ section: data[0].id, year: String(year), month: String(monthIndex) })
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    if (!sectionId) return
    setLoading(true)
    setError('')
    const first = toDateStr(new Date(year, monthIndex, 1))
    const last = toDateStr(new Date(year, monthIndex + 1, 0))

    const [studentsRes, calendarRes] = await Promise.all([
      supabase.from('students').select('*').eq('section_id', sectionId).eq('is_active', true).order('sex').order('last_name'),
      supabase.from('school_calendar').select('*').gte('date', first).lte('date', last),
    ])

    if (studentsRes.error) return setError(studentsRes.error.message)
    if (calendarRes.error) return setError(calendarRes.error.message)

    const calMap = {}
    for (const row of calendarRes.data) calMap[row.date] = row
    setCalendarRows(calMap)
    setStudents(studentsRes.data)

    const studentIds = studentsRes.data.map((s) => s.id)
    if (studentIds.length > 0) {
      const recRes = await supabase
        .from('attendance_records')
        .select('student_id, date, status')
        .in('student_id', studentIds)
        .gte('date', first)
        .lte('date', last)
      if (recRes.error) return setError(recRes.error.message)
      const map = {}
      for (const r of recRes.data) {
        if (!map[r.student_id]) map[r.student_id] = {}
        map[r.student_id][r.date] = r.status
      }
      setRecords(map)
    } else {
      setRecords({})
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, year, monthIndex])

  function updateParams(next) {
    setSearchParams({ section: sectionId, year: String(year), month: String(monthIndex), ...next })
  }

  function prevMonth() {
    if (monthIndex === 0) updateParams({ year: String(year - 1), month: '11' })
    else updateParams({ month: String(monthIndex - 1) })
  }
  function nextMonth() {
    if (monthIndex === 11) updateParams({ year: String(year + 1), month: '0' })
    else updateParams({ month: String(monthIndex + 1) })
  }

  async function cycleCell(studentId, dateStr) {
    const current = records[studentId]?.[dateStr] ?? 'present'
    const currentIdx = STATUS_CYCLE.indexOf(current)
    const next = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length]

    if (next === 'present') {
      const { error } = await supabase.from('attendance_records').delete().eq('student_id', studentId).eq('date', dateStr)
      if (error) return setError(error.message)
    } else {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({ student_id: studentId, date: dateStr, status: next }, { onConflict: 'student_id,date' })
      if (error) return setError(error.message)
    }

    setRecords((prev) => {
      const copy = { ...prev, [studentId]: { ...prev[studentId] } }
      if (next === 'present') delete copy[studentId][dateStr]
      else copy[studentId][dateStr] = next
      return copy
    })
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Monthly Attendance Grid</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <select
          value={sectionId}
          onChange={(e) => updateParams({ section: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button onClick={prevMonth} className="rounded-md px-3 py-2 text-gray-600 hover:bg-gray-100">←</button>
        <span className="min-w-[140px] text-center text-lg font-semibold text-gray-800">
          {MONTH_NAMES[monthIndex]} {year}
        </span>
        <button onClick={nextMonth} className="rounded-md px-3 py-2 text-gray-600 hover:bg-gray-100">→</button>
        <span className="ml-auto text-sm text-gray-500">Click a cell to cycle: blank → L → A</span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-gray-500">No active students in this section.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[200px] border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left">Name</th>
                {days.map((d) => {
                  const dateStr = toDateStr(d)
                  const schoolDay = isSchoolDay(d, calendarRows[dateStr])
                  return (
                    <th
                      key={dateStr}
                      className={`w-9 border-b border-gray-200 px-1 py-2 text-center font-normal ${
                        schoolDay ? 'text-gray-500' : 'bg-gray-100 text-gray-300'
                      }`}
                      title={dateStr}
                    >
                      {d.getDate()}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 font-medium text-gray-800">
                    {studentFullName(s)}
                  </td>
                  {days.map((d) => {
                    const dateStr = toDateStr(d)
                    const schoolDay = isSchoolDay(d, calendarRows[dateStr])
                    if (!schoolDay) {
                      return <td key={dateStr} className="bg-gray-100"></td>
                    }
                    const status = records[s.id]?.[dateStr] ?? 'present'
                    return (
                      <td key={dateStr} className="p-0 text-center">
                        <button
                          onClick={() => cycleCell(s.id, dateStr)}
                          className={`h-9 w-9 text-xs hover:bg-blue-50 ${STATUS_CLASS[status]}`}
                        >
                          {STATUS_LABEL[status]}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">{schoolDays.length} school day(s) this month</p>
    </div>
  )
}
