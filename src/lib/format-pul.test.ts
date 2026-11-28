import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pul } from './format'

test('pul — lokalga bog\'liq emas, oddiy probel bilan', () => {
  assert.equal(pul(650000), '650 000')
  assert.equal(pul(1234567), '1 234 567')
  assert.equal(pul('380770.00'), '380 770')
  assert.equal(pul(-84616), '-84 616')
  assert.equal(pul(999.5), '1 000')
  assert.equal(pul(0), '0')
  assert.equal(pul(null), '0')
  assert.equal(pul('abc'), '0')
  assert.ok(!pul(450000).includes(','), 'vergul bo\'lmasin')
})
