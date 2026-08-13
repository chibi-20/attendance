import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { daysInMonth, isSchoolDay, dayTypeLabel, toDateStr } from '../lib/calendar'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const dayTypeStyles = {
  holiday: 'bg-red-100 text-red-800 border-red-300',
  suspension: 'bg-orange-100 text-orange-800 border-orange-300',
  event: 'bg-blue-100 text-blue-800 border-blue-300',
}

export default function CalendarSetup() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex, setMonthIndex] = useState(now.getMonth())
  const [calendarRows, setCalendarRows] = useState({}) // dateStr -> row
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [form, setForm] = useState({ is_school_day: true, day_type: 'regular', remarks: '' })

  const days = useMemo(() => daysInMonth(year, monthIndex), [year, monthIndex])
  const leadingBlanks = days.length > 0 ? days[0].getDay() : 0

  async function loadMonth() {
    setLoading(true)
    setError('')
    const first = toDateStr(new Date(year, monthIndex, 1))
    const last = toDateStr(new Date(year, monthIndex + 1, 0))
    const { data, error } = await supabase
      .from('school_calendar')
      .select('*')
      .gte('date', first)
      .lte('date', last)
    if (error) setError(error.message)
    else {
      const map = {}
      for (const row of data) map[row.date] = row
      setCalendarRows(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMonth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, monthIndex])

  function prevMonth() {
    if (monthIndex === 0) {
      setYear((y) => y - 1)
      setMonthIndex(11)
    } else {
      setMonthIndex((m) => m - 1)
    }
    setSelectedDate(null)
  }

  function nextMonth() {
    if (monthIndex === 11) {
      setYear((y) => y + 1)
      setMonthIndex(0)
    } else {
      setMonthIndex((m) => m + 1)
    }
    setSelectedDate(null)
  }

  function selectDate(date) {
    const dateStr = toDateStr(date)
    setSelectedDate(dateStr)
    const row = calendarRows[dateStr]
    if (row) {
      setForm({ is_school_day: row.is_school_day, day_type: row.day_type, remarks: row.remarks ?? '' })
    } else {
      setForm({ is_school_day: isSchoolDay(date, undefined), day_type: 'regular', remarks: '' })
    }
  }

  async function handleSave() {
    if (!selectedDate) return
    const { error } = await supabase
      .from('school_calendar')
      .upsert({ date: selectedDate, ...form }, { onConflict: 'date' })
    if (error) return setError(error.message)
    setSelectedDate(null)
    loadMonth()
  }

  async function handleClear() {
    if (!selectedDate) return
    const { error } = await supabase.from('school_calendar').delete().eq('date', selectedDate)
    if (error) return setError(error.message)
    setSelectedDate(null)
    loadMonth()
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">School Calendar</h1>

      <div className="mb-4 flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <button onClick={prevMonth} className="rounded-md px-3 py-2 text-gray-600 hover:bg-gray-100">←</button>
        <span className="min-w-[160px] text-center text-lg font-semibold text-gray-800">
          {MONTH_NAMES[monthIndex]} {year}
        </span>
        <button onClick={nextMonth} className="rounded-md px-3 py-2 text-gray-600 hover:bg-gray-100">→</button>
        <div className="ml-auto flex gap-3 text-xs text-gray-500">
          <span><span className="inline-block h-3 w-3 rounded-sm bg-red-200 align-middle"></span> Holiday</span>
          <span><span className="inline-block h-3 w-3 rounded-sm bg-orange-200 align-middle"></span> Suspension</span>
          <span><span className="inline-block h-3 w-3 rounded-sm bg-blue-200 align-middle"></span> Event</span>
          <span><span className="inline-block h-3 w-3 rounded-sm bg-gray-200 align-middle"></span> Weekend</span>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-7 gap-2 rounded-lg bg-white p-4 shadow-sm">
          {WEEKDAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400">{d}</div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((date) => {
            const dateStr = toDateStr(date)
            const row = calendarRows[dateStr]
            const schoolDay = isSchoolDay(date, row)
            const weekend = date.getDay() === 0 || date.getDay() === 6
            const typeStyle = row && row.day_type !== 'regular' ? dayTypeStyles[row.day_type] : ''
            const isSelected = selectedDate === dateStr

            let classes = 'flex h-16 flex-col items-start justify-between rounded-md border p-1.5 text-sm '
            if (typeStyle) classes += typeStyle
            else if (!schoolDay) classes += 'bg-gray-100 text-gray-400 border-gray-200'
            else classes += 'bg-white text-gray-800 border-gray-200 hover:border-blue-300'
            if (isSelected) classes += ' ring-2 ring-blue-500'

            return (
              <button key={dateStr} onClick={() => selectDate(date)} className={classes}>
                <span className="font-semibold">{date.getDate()}</span>
                {row && row.day_type !== 'regular' && (
                  <span className="text-[10px] leading-none">{dayTypeLabel(row.day_type)}</span>
                )}
                {row && row.day_type === 'regular' && !row.is_school_day && (
                  <span className="text-[10px] leading-none">No class</span>
                )}
                {row && row.day_type === 'regular' && row.is_school_day && weekend && (
                  <span className="text-[10px] leading-none">Class day</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {selectedDate && (
        <div className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_school_day}
                onChange={(e) => setForm({ ...form, is_school_day: e.target.checked })}
              />
              School day
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
              <select
                value={form.day_type}
                onChange={(e) => setForm({ ...form, day_type: e.target.value })}
                className="rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
              >
                <option value="regular">Regular</option>
                <option value="holiday">Holiday</option>
                <option value="suspension">Suspension</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
              <input
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button onClick={handleSave} className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
              Save
            </button>
            {calendarRows[selectedDate] && (
              <button onClick={handleClear} className="rounded-md px-4 py-2 font-medium text-gray-600 hover:bg-gray-100">
                Clear override
              </button>
            )}
            <button onClick={() => setSelectedDate(null)} className="rounded-md px-4 py-2 font-medium text-gray-600 hover:bg-gray-100">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
