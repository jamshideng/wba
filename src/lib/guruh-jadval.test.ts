import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kunlarSanada } from './guruh-jadval'

const jadval = [
  { dan: '2000-01-01', kunlar: [1, 3, 5] },
  { dan: '2026-11-10', kunlar: [2, 4, 6] },
]

test('kunlarSanada — sana chegarasi', () => {
  assert.deepEqual(kunlarSanada(jadval, [2, 4, 6], '2026-11-09'), [1, 3, 5])
  assert.deepEqual(kunlarSanada(jadval, [1, 3, 5], '2026-11-10'), [2, 4, 6])
})

test('kunlarSanada — tarix bo‘lmasa joriy kunlar', () => {
  assert.deepEqual(kunlarSanada([], [1, 2], '2026-11-09'), [1, 2])
})
