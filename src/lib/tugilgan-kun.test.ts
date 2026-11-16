import { test } from 'node:test'
import assert from 'node:assert/strict'
import { qachon, tugilganMatn } from './tugilgan-kun'

test('tugilgan — qachon', () => {
  assert.equal(qachon(0), 'Bugun')
  assert.equal(qachon(1), 'Ertaga')
  assert.equal(qachon(3), '3 kundan keyin')
})

test('tugilgan — matn', () => {
  assert.equal(tugilganMatn('X', []), null)
  const m = tugilganMatn('O‘quvchilarning tug‘ilgan kuni', [
    { id: 'S001', ism: 'Ali <Vali>', sana: '2026-11-17', qoldi: 1, yosh: 12, guruhlar: ['Beginner · Luiza · 15:00-16:30'] },
  ])!
  assert.match(m, /<b>Ertaga<\/b> \(17\/11\/2026\) — Ali &lt;Vali&gt;, 12 yosh · Beginner/)
})
