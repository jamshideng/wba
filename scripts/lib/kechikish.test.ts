import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kechikishlarniQur, sanaVaqtga } from './kechikish'
import type { Qator } from './sheets'

const q = (n: number, x: Record<string, unknown>): Qator => ({ _qator: n, ...x })

test('sana-vaqt seriyasi Toshkent vaqti sifatida o‘qiladi', () => {
  // 06.10.2026 14:30 Toshkent = 09:30 UTC
  const seriya = 46301 + (14.5 / 24)
  assert.equal(sanaVaqtga(seriya), '2026-10-06T09:30:00.000Z')
  assert.equal(sanaVaqtga('06.10.2026 14:30'), '2026-10-06T09:30:00.000Z')
  assert.equal(sanaVaqtga(''), null)
})

test('to‘g‘ri qator o‘qiladi, xatolilar ajratiladi', () => {
  const { royxat, xatolar } = kechikishlarniQur([
    q(2, { ID: 'UK0001', Sana: 46301, Guruh: 'Beginner · Diana', Ustoz: 'Diana', 'Kech (daqiqa)': 12, 'Sabab / izoh': 'tirbandlik', Kiritilgan: 46301.6, 'Guruh ID': 'G01', 'Ustoz ID': 'U01' }),
    q(3, { ID: 'UK0002', Sana: 46301, Guruh: 'X', Ustoz: '', 'Kech (daqiqa)': 5, 'Guruh ID': '', 'Ustoz ID': '' }),
    q(4, { ID: 'UK0003', Sana: 46301, Guruh: 'X', 'Kech (daqiqa)': '', 'Ustoz ID': 'U01' }),
    q(5, { ID: '', Sana: '', Guruh: '', 'Kech (daqiqa)': '' }),
    q(6, { ID: 'UK0001', Sana: 46301, Guruh: 'Y', 'Kech (daqiqa)': 3, 'Ustoz ID': 'U02' }),
  ])
  assert.equal(royxat.length, 1)
  assert.deepEqual(royxat[0], {
    sheets_id: 'UK0001', sana: '2026-10-06', group_id: 'G01', teacher_id: 'U01',
    daqiqa: 12, sabab: 'tirbandlik', kiritilgan: royxat[0].kiritilgan,
  })
  assert.equal(xatolar.length, 3)
  assert.match(xatolar.join('\n'), /ustoz topilmadi/)
  assert.match(xatolar.join('\n'), /daqiqa/)
  assert.match(xatolar.join('\n'), /takrorlangan/)
})
