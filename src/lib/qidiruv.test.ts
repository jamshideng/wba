import { test } from 'node:test'
import assert from 'node:assert/strict'
import { qidiruvTuri } from './qidiruv'

test('qidiruvTuri — harfma-harf ism', () => {
  assert.deepEqual(qidiruvTuri('m'), { turi: 'ism', naqsh: '%m%' })
  assert.deepEqual(qidiruvTuri('ma'), { turi: 'ism', naqsh: '%ma%' })
  assert.deepEqual(qidiruvTuri('  ma  '), { turi: 'ism', naqsh: '%ma%' })
  assert.equal(qidiruvTuri(''), null)
  assert.equal(qidiruvTuri('   '), null)
})

test('qidiruvTuri — "s" yolg‘iz harf ism, S012 — ID boshi', () => {
  assert.deepEqual(qidiruvTuri('s'), { turi: 'ism', naqsh: '%s%' })
  assert.deepEqual(qidiruvTuri('s01'), { turi: 'id', naqsh: 'S01%' })
})

test('qidiruvTuri — telefon bo‘lagi', () => {
  assert.deepEqual(qidiruvTuri('90 123'), { turi: 'tel', naqsh: '%90123%' })
  assert.deepEqual(qidiruvTuri('+998 90'), { turi: 'tel', naqsh: '%99890%' })
  // 2 raqam — hali telefon emas
  assert.deepEqual(qidiruvTuri('90'), { turi: 'ism', naqsh: '%90%' })
})

test('qidiruvTuri — tutuq belgisi har xil yozilsa ham topiladi, filtr buzilmaydi', () => {
  assert.deepEqual(qidiruvTuri("o'g"), { turi: 'ism', naqsh: '%o_g%' })
  assert.deepEqual(qidiruvTuri('o‘g'), { turi: 'ism', naqsh: '%o_g%' })
  assert.deepEqual(qidiruvTuri('a,b(c)%'), { turi: 'ism', naqsh: '%a b c%' })
})
