import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daqiqa, haftalikJadval, type JadvalGuruh } from './jadval'

const g = (id: string, kunlar: number[], bosh: string, tug: string | null, teacher: string | null): JadvalGuruh => ({
  id, nom: id, kunlar, boshlanish: bosh, tugash: tug, teacher_id: teacher, ustoz: teacher, oquvchilar: 5,
})

test('daqiqa', () => {
  assert.equal(daqiqa('14:30:00'), 870)
  assert.equal(daqiqa(null), null)
  assert.equal(daqiqa('buzuq'), null)
})

test('haftalikJadval — kunlarga taqsimlaydi va vaqt bo‘yicha tartiblaydi', () => {
  const j = haftalikJadval([g('B', [1, 3], '16:00', '17:30', 'U1'), g('A', [1], '14:00', '15:30', 'U2')])
  assert.deepEqual(j[0].darslar.map((d) => d.id), ['A', 'B'])
  assert.deepEqual(j[2].darslar.map((d) => d.id), ['B'])
  assert.equal(j[1].darslar.length, 0)
})

test('haftalikJadval — bitta ustoz ustma-ust bo‘lsa to‘qnashuv, ketma-ket bo‘lsa yo‘q', () => {
  const j = haftalikJadval([
    g('G1', [2], '14:00', '15:30', 'U1'),
    g('G2', [2], '15:00', '16:30', 'U1'),
    g('G3', [2], '15:30', '17:00', 'U1'),
    g('G4', [2], '14:00', '15:30', 'U2'),
  ])
  const d = Object.fromEntries(j[1].darslar.map((x) => [x.id, x.toqnash]))
  assert.deepEqual(d.G1, ['G2'])
  assert.deepEqual(d.G2, ['G1', 'G3'])
  assert.deepEqual(d.G4, [])
})
