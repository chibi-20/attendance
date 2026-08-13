import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { studentFullName, computeSummary, toDateStr } from '../lib/attendance'
import { isSchoolDay } from '../lib/calendar'

function firstOfMonth(date) {
  return toDateStr(new Date(date.getFullYear(), date.getMonth(), 1))
}
function lastOfMonth(date) {
  return toDateStr(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams()
  const now = new Date()

  const sectionId = searchParams.get('section') || ''
  const startDate = searchParams.get('start') || firstOfMonth(now)
  const endDate = searchParams.get('end') || lastOfMonth(now)

  const [sections, setSections] = useState([])
  const [students, setStudents] = useState([])
  const [schoolDayStrs, setSchoolDayStrs] = useState([])
  const [recordsByStudent, setRecordsByStudent] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('sections')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setSections(data)
        if (!sectionId && data.length > 0) {
          setSearchParams({ section: data[0].id, start: startDate, end: endDate })
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    if (!sectionId) return
    setLoading(true)
    setError('')

    const [studentsRes, calendarRes] = await Promise.all([
      supabase.from('students').select('*').eq('section_id', sectionId).eq('is_active', true).order('last_name'),
      supabase.from('school_calendar').select('*').gte('date', startDate).lte('date', endDate),
    ])
    if (studentsRes.error) return setError(studentsRes.error.message)
    if (calendarRes.error) return setError(calendarRes.error.message)

    const calMap = {}
    for (const row of calendarRes.data) calMap[row.date] = row

    const days = []
    const cursor = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    while (cursor <= end) {
      const dateStr = toDateStr(cursor)
      if (isSchoolDay(cursor, calMap[dateStr])) days.push(dateStr)
      cursor.setDate(cursor.getDate() + 1)
    }
    setSchoolDayStrs(days)
    setStudents(studentsRes.data)

    const studentIds = studentsRes.data.map((s) => s.id)
    if (studentIds.length > 0) {
      const recRes = await supabase
        .from('attendance_records')
        .select('student_id, date, status')
        .in('student_id', studentIds)
        .gte('date', startDate)
        .lte('date', endDate)
      if (recRes.error) return setError(recRes.error.message)
      const map = {}
      for (const r of recRes.data) {
        if (!map[r.student_id]) map[r.student_id] = {}
        map[r.student_id][r.date] = r.status
      }
      setRecordsByStudent(map)
    } else {
      setRecordsByStudent({})
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, startDate, endDate])

  const rows = useMemo(
    () =>
      students.map((s) => ({
        student: s,
        summary: computeSummary(recordsByStudent[s.id] ?? {}, schoolDayStrs),
      })),
    [students, recordsByStudent, schoolDayStrs]
  )

  const sectionTotals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        present: acc.present + r.summary.present,
        late: acc.late + r.summary.late,
        absent: acc.absent + r.summary.absent,
      }),
      { present: 0, late: 0, absent: 0 }
    )
  }, [rows])

  function updateParams(next) {
    setSearchParams({ section: sectionId, start: startDate, end: endDate, ...next })
  }

  function exportCsv() {
    const sectionName = sections.find((s) => s.id === sectionId)?.name ?? 'section'
    const data = rows.map((r) => ({
      'Last Name': r.student.last_name,
      'First Name': r.student.first_name,
      'Middle Name': r.student.middle_name ?? '',
      LRN: r.student.lrn ?? '',
      'School Days': r.summary.totalDays,
      Present: r.summary.present,
      Late: r.summary.late,
      Absent: r.summary.absent,
      'Attendance Rate (%)': r.summary.rate.toFixed(1),
    }))
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sectionName}_${startDate}_to_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sectionName = sections.find((s) => s.id === sectionId)?.name ?? ''

  return (
    <div>
      <h1 className="no-print mb-4 text-2xl font-bold text-gray-800">Reports</h1>

      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Section</label>
          <select
            value={sectionId}
            onChange={(e) => updateParams({ section: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateParams({ start: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => updateParams({ end: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button onClick={exportCsv} className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
          Export CSV
        </button>
        <button onClick={() => window.print()} className="rounded-md bg-gray-700 px-4 py-2 font-semibold text-white hover:bg-gray-800">
          Print / SF2 view
        </button>
      </div>

      {error && <p className="no-print mb-4 text-sm text-red-600">{error}</p>}

      <div className="hidden print:block print:mb-4">
        <h2 className="text-center text-lg font-bold">School Form 2 (SF2) — Daily Attendance Report of Learners</h2>
        <p className="text-center text-sm">{sectionName} · {startDate} to {endDate}</p>
      </div>

      {loading ? (
        <p className="no-print text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold text-gray-800">Section Summary</h2>
            <div className="flex gap-6 text-sm">
              <span>School days in range: <strong>{schoolDayStrs.length}</strong></span>
              <span className="text-green-700">Present total: <strong>{sectionTotals.present}</strong></span>
              <span className="text-amber-600">Late total: <strong>{sectionTotals.late}</strong></span>
              <span className="text-red-600">Absent total: <strong>{sectionTotals.absent}</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">LRN</th>
                  <th className="px-4 py-2">School Days</th>
                  <th className="px-4 py-2">Present</th>
                  <th className="px-4 py-2">Late</th>
                  <th className="px-4 py-2">Absent</th>
                  <th className="px-4 py-2">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(({ student, summary }) => (
                  <tr key={student.id}>
                    <td className="px-4 py-2 font-medium text-gray-800">{studentFullName(student)}</td>
                    <td className="px-4 py-2 text-gray-600">{student.lrn || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{summary.totalDays}</td>
                    <td className="px-4 py-2 text-green-700">{summary.present}</td>
                    <td className="px-4 py-2 text-amber-600">{summary.late}</td>
                    <td className="px-4 py-2 text-red-600">{summary.absent}</td>
                    <td className="px-4 py-2 text-gray-600">{summary.rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
