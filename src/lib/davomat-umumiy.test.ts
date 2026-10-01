import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kunlarOraligi, umumiyDavomat } from './davomat-umumiy'

test('kunlarOraligi — ikkala chet ham kiradi, oy chegarasidan o‘tadi', () => {
  assert.deepEqual(kunlarOraligi('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  assert.deepEqual(kunlarOraligi('2026-10-02', '2026-10-01'), [])
})

test('umumiyDavomat — foiz, sababli va belgilanmagan kunlar', () => {
  // 2026-09-28 dushanba (1), 2026-09-30 chorshanba (3), 2026-10-02 juma (5)
  const kunlar = kunlarOraligi('2026-09-28', '2026-10-02')
  const q = umumiyDavomat(
    kunlar,
    [{ id: 'G01', nom: 'Ingliz A', kunlar: [1, 3, 5] }],
    [{ group_id: 'G01', boshlandi: '2026-09-01', tugadi: null }],
    [
      { id: 'L1', group_id: 'G01', sana: '2026-09-28' },
      { id: 'L2', group_id: 'G01', sana: '2026-09-30' },
    ],
    [
      { lesson_id: 'L1', holat: 'keldi' },
      { lesson_id: 'L1', holat: 'kelmadi' },
      { lesson_id: 'L1', holat: 'sababli' },
      { lesson_id: 'L1', holat: 'kechikdi' },
    ],
  )
  assert.equal(q.length, 1)
  assert.equal(q[0].darslar, 1)
  assert.equal(q[0].keldi, 2)
  assert.equal(q[0].foiz, 50)
  // L2 ochilgan, lekin belgi yo'q; 10-02 — dars kuni, dars yo'q
  assert.deepEqual(q[0].belgilanmagan, ['2026-09-30', '2026-10-02'])
})

test('umumiyDavomat — o‘quvchisiz kun belgilanmagan sanalmaydi', () => {
  const q = umumiyDavomat(
    ['2026-09-28'],
    [{ id: 'G02', nom: 'Yangi', kunlar: [1] }],
    [{ group_id: 'G02', boshlandi: '2026-10-01', tugadi: null }],
    [],
    [],
  )
  assert.deepEqual(q[0].belgilanmagan, [])
  assert.equal(q[0].foiz, null)
})
