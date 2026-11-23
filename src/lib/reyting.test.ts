import { test } from 'node:test'
import assert from 'node:assert/strict'
import { davrNomi, ketishIzohiYaroqli, vaznXatosi } from './reyting'

test('vaznXatosi — yig‘indi 100 bo‘lishi kerak', () => {
  assert.equal(vaznXatosi('O‘quvchi', { test: 50, davomat: 30, woblar: 20 }), null)
  assert.match(vaznXatosi('O‘quvchi', { test: 50, davomat: 30, woblar: 30 }) ?? '', /110/)
  assert.match(vaznXatosi('O‘quvchi', { test: 120, davomat: -20 }) ?? '', /manfiy/)
  assert.match(vaznXatosi('O‘quvchi', { test: Number.NaN }) ?? '', /son/)
})

test('ketishIzohiYaroqli — 3 so‘z va 15 belgi', () => {
  assert.equal(ketishIzohiYaroqli('Oilasi boshqa shaharga ko‘chdi'), true)
  assert.equal(ketishIzohiYaroqli('vaqt yo‘q'), false)
  assert.equal(ketishIzohiYaroqli('juda-juda-uzun-bitta-so‘z'), false)
  assert.equal(ketishIzohiYaroqli('  '), false)
  assert.equal(ketishIzohiYaroqli(null), false)
})

test('davrNomi', () => {
  assert.equal(davrNomi('oylik', '2026-11-01', '2026-11-30'), 'Noyabr 2026')
  assert.equal(davrNomi('haftalik', '2026-11-17', '2026-11-23'), '17.11–23.11')
})
