import assert from 'node:assert/strict'
import test from 'node:test'
import { clearRateLimit, isRateLimited, recordRateLimitFailure } from '../src/lib/rate-limit'

test('authentication rate limiter blocks the sixth attempt inside the window', () => {
  const key = 'test:blocked'
  clearRateLimit(key)
  for (let attempt = 0; attempt < 5; attempt += 1) recordRateLimitFailure(key, 1_000 + attempt)
  assert.equal(isRateLimited(key, 2_000), true)
  clearRateLimit(key)
})

test('authentication rate limiter can be cleared after success', () => {
  const key = 'test:clear'
  for (let attempt = 0; attempt < 5; attempt += 1) recordRateLimitFailure(key, 1_000 + attempt)
  clearRateLimit(key)
  assert.equal(isRateLimited(key, 2_000), false)
})
