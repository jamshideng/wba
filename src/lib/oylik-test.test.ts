import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asosiy, ballOqi, bolimlarniOqi, natijaMatni } from './oylik-test'

const IELTS = [
  { nom: 'Listening', maks: 9 },
  { nom: 'Reading', maks: 9 },
  { nom: 'Writing', maks: 9 },
  { nom: 'Speaking', maks: 9 },
]

test('natijaMatni — ball va foiz', () => {
  assert.equal(natijaMatni({ turi: 'ball', maks: 40, bolimlar: [], ball: 34, bolim_ballar: null, keldi: true }), '34 / 40')
  assert.equal(natijaMatni({ turi: 'foiz', maks: null, bolimlar: [], ball: 72.5, bolim_ballar: null, keldi: true }), '72.5%')
  assert.equal(natijaMatni({ turi: 'ball', maks: 40, bolimlar: [], ball: null, bolim_ballar: null, keldi: false }), 'Kelmadi')
})

test('natijaMatni — bo‘limlar har biri o‘z shkalasida, yozilmagani chiqmaydi', () => {
  const bolimlar = [
    { nom: 'Grammar', maks: 100 },
    { nom: 'Writing', maks: 9 },
    { nom: 'Speaking', maks: 9 },
  ]
  assert.equal(
    natijaMatni({ turi: 'bolimlar', maks: null, bolimlar, ball: null, bolim_ballar: [70, 7, 3], keldi: true }),
    'Grammar 70% · Writing 7/9 · Speaking 3/9',
  )
  assert.equal(
    natijaMatni({ turi: 'bolimlar', maks: null, bolimlar, ball: null, bolim_ballar: [85, null, 6], keldi: true }),
    'Grammar 85% · Speaking 6/9',
  )
})

test('natijaMatni va asosiy — IELTS Overall band', () => {
  const n = { turi: 'ielts' as const, maks: 9, bolimlar: IELTS, ball: 7, bolim_ballar: [7, 6.5, 6, 7.5], keldi: true, foiz: 77.8 }
  assert.equal(natijaMatni(n), 'L 7.0 · R 6.5 · W 6.0 · S 7.5 · Overall 7.0')
  assert.equal(asosiy(n), '7.0')
  assert.equal(asosiy({ turi: 'ball', ball: 34, foiz: 85 }), '85%')
})

test('bolimlarniOqi — bo‘sh qator tashlanadi, maks majburiy', () => {
  assert.deepEqual(bolimlarniOqi(['Grammar', 'Writing', ''], ['100', '9', '']), [
    { nom: 'Grammar', maks: 100 },
    { nom: 'Writing', maks: 9 },
  ])
  assert.equal(typeof bolimlarniOqi(['Speaking'], ['']), 'string')
  assert.equal(typeof bolimlarniOqi([''], ['']), 'string')
})

test('ballOqi — vergul, bo‘sh, manfiy', () => {
  assert.equal(ballOqi('6,5'), 6.5)
  assert.equal(ballOqi(''), null)
  assert.equal(ballOqi('-1'), 'xato')
  assert.equal(ballOqi('abc'), 'xato')
})
