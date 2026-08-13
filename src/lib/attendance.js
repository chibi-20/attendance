// Shared helpers for mark-by-exception attendance logic.
// attendance_records only ever stores 'late' or 'absent' rows.
// Any school day with no row for a student is implicitly Present.

export function statusFor(recordsByStudentAndDate, studentId, dateStr) {
  return recordsByStudentAndDate[studentId]?.[dateStr] ?? 'present'
}

export function isWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function studentFullName(s) {
  const middle = s.middle_name ? ` ${s.middle_name[0]}.` : ''
  return `${s.last_name}, ${s.first_name}${middle}`
}

export function computeSummary(records, schoolDayStrs) {
  const totalDays = schoolDayStrs.length
  let late = 0
  let absent = 0
  for (const dateStr of schoolDayStrs) {
    const status = records[dateStr]
    if (status === 'late') late++
    else if (status === 'absent') absent++
  }
  const present = totalDays - late - absent
  const rate = totalDays > 0 ? (present / totalDays) * 100 : 0
  return { totalDays, present, late, absent, rate }
}
