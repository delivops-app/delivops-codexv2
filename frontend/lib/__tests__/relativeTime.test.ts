import assert from 'node:assert/strict'
import test from 'node:test'

import { formatRelativeLastSeen } from '../relativeTime'

test('returns fallback when value is null', () => {
  assert.equal(
    formatRelativeLastSeen(null, new Date('2024-01-01T00:00:00Z')),
    'Jamais connecté'
  )
})

test('formats past dates relative to now', () => {
  const now = new Date('2024-01-01T12:00:00Z')
  const seen = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago

  assert.equal(
    formatRelativeLastSeen(seen.toISOString(), now),
    'il y a 5 minutes'
  )
})

test('assumes UTC when the backend sends naive timestamps', () => {
  const now = new Date('2024-01-01T12:00:00Z')
  const naiveTimestamp = '2024-01-01T12:00:00'

  assert.equal(formatRelativeLastSeen(naiveTimestamp, now), 'maintenant')
})

test('handles invalid dates', () => {
  assert.equal(
    formatRelativeLastSeen('not-a-date', new Date('2024-01-01T00:00:00Z')),
    'Jamais connecté'
  )
})
