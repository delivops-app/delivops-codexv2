export function formatRelativeLastSeen(
  lastSeenAt: string | null,
  now: Date = new Date()
): string {
  if (!lastSeenAt) {
    return 'Jamais connecté'
  }

  const trimmed = lastSeenAt.trim()
  const hasTimezone = /(?:[zZ]|[+-]\d\d(?::?\d\d)?)$/.test(trimmed)
  const normalizedIso = hasTimezone ? trimmed : `${trimmed}Z`

  const seenDate = new Date(normalizedIso)
  if (Number.isNaN(seenDate.getTime())) {
    return 'Jamais connecté'
  }

  const diffMs = seenDate.getTime() - now.getTime()
  const formatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

  const diffInSeconds = Math.round(diffMs / 1000)
  const diffInMinutes = Math.round(diffInSeconds / 60)
  const diffInHours = Math.round(diffInMinutes / 60)
  const diffInDays = Math.round(diffInHours / 24)
  const diffInWeeks = Math.round(diffInDays / 7)
  const diffInMonths = Math.round(diffInDays / 30)
  const diffInYears = Math.round(diffInDays / 365)

  if (Math.abs(diffInSeconds) < 60) {
    return formatter.format(diffInSeconds, 'second')
  }
  if (Math.abs(diffInMinutes) < 60) {
    return formatter.format(diffInMinutes, 'minute')
  }
  if (Math.abs(diffInHours) < 24) {
    return formatter.format(diffInHours, 'hour')
  }
  if (Math.abs(diffInDays) < 7) {
    return formatter.format(diffInDays, 'day')
  }
  if (Math.abs(diffInWeeks) < 5) {
    return formatter.format(diffInWeeks, 'week')
  }
  if (Math.abs(diffInMonths) < 12) {
    return formatter.format(diffInMonths, 'month')
  }
  return formatter.format(diffInYears, 'year')
}
