import { toDateStr } from './attendance'

// Builds a list of Date objects for every day in the given month.
export function daysInMonth(year, monthIndex) {
  const days = []
  const date = new Date(year, monthIndex, 1)
  while (date.getMonth() === monthIndex) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

// Given a date and an optional school_calendar row (or undefined),
// determine whether it's a school day. Weekends are excluded by default;
// an explicit calendar row overrides the default in either direction.
export function isSchoolDay(date, calendarRow) {
  if (calendarRow) return calendarRow.is_school_day
  const day = date.getDay()
  return day !== 0 && day !== 6
}

export function dayTypeLabel(dayType) {
  switch (dayType) {
    case 'holiday':
      return 'Holiday'
    case 'suspension':
      return 'Suspension'
    case 'event':
      return 'Event'
    default:
      return 'Regular'
  }
}

export { toDateStr }
