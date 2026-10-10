import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arizaIzohi, izohniAjrat } from './ariza-izoh'
import { SAVOL_SONI, TEST_FANLAR, testDaraja, testFan, testFoiz, testTanla } from './test-savollar'

test('arizaIzohi — bo‘sh bo‘lsa null', () => {
  assert.equal(arizaIzohi({}), null)
})

test('arizaIzohi → izohniAjrat — test va vaqt qaytib ajraladi', () => {
  const izoh = arizaIzohi({
    test: { fan: 'Rus tili', togri: 6, jami: 8, foiz: 75, daraja: 'O‘rta' },
    qulay: 'Toq kunlar, ertalab (08:00 – 12:00)',
    izoh: '2-sinf',
  })
  const a = izohniAjrat(izoh)
  assert.deepEqual(a.test, { matn: 'Rus tili · 6/8 (75%) · O‘rta', foiz: 75 })
  assert.equal(a.vaqt, 'Toq kunlar, ertalab (08:00 – 12:00)')
  assert.equal(a.qolgan, '2-sinf')
})

test('izohniAjrat — eski oddiy izoh o‘zgarmaydi', () => {
  assert.deepEqual(izohniAjrat('narxni so‘radi'), { test: null, vaqt: null, qolgan: 'narxni so‘radi' })
  assert.deepEqual(izohniAjrat(null), { test: null, vaqt: null, qolgan: '' })
})

test('test banki — jami 200: har fanda 40 savol, har qiyinlikda 10 ta, takrorsiz, arab tili yo‘q', () => {
  assert.ok(!TEST_FANLAR.some((f) => f.yonalish === 'arab-tili'))
  assert.equal(TEST_FANLAR.reduce((n, f) => n + f.bank.length, 0), 200)
  for (const f of TEST_FANLAR) {
    assert.equal(f.bank.length, 40, f.id)
    for (const d of [1, 2, 3, 4]) assert.equal(f.bank.filter((q) => q.d === d).length, 10, `${f.id} d=${d}`)
    assert.equal(new Set(f.bank.map((q) => q.s)).size, f.bank.length, `${f.id}: takror savol`)
    for (const s of f.bank) {
      assert.ok(s.t >= 0 && s.t < s.v.length, `${f.id}: ${s.s}`)
      assert.equal(new Set(s.v).size, 3, `${f.id}: bir xil variant — ${s.s}`)
    }
    assert.equal(f.darajalar.at(-1)?.gacha, SAVOL_SONI, f.id)
  }
})

test('testTanla — 8 savol, har qiyinlikdan 2 tadan, osondan qiyinga, to‘g‘ri javob saqlanadi', () => {
  // Takrorlanadigan "tasodif" — natija barqaror bo'lsin
  let x = 7
  const tasodif = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  for (const f of TEST_FANLAR) {
    for (let urinish = 0; urinish < 20; urinish++) {
      const t = testTanla(f, tasodif)
      assert.equal(t.length, SAVOL_SONI, f.id)
      assert.deepEqual(t.map((q) => q.d), [1, 1, 2, 2, 3, 3, 4, 4], f.id)
      assert.equal(new Set(t.map((q) => q.s)).size, SAVOL_SONI, `${f.id}: bitta urinishda takror`)
      for (const q of t) {
        const asl = f.bank.find((b) => b.s === q.s)!
        assert.equal(q.v[q.t], asl.v[asl.t], `${f.id}: to‘g‘ri javob almashib ketdi — ${q.s}`)
        assert.deepEqual([...q.v].sort(), [...asl.v].sort(), f.id)
      }
    }
  }
})

test('testTanla — urinishlar har xil bo‘ladi', () => {
  const f = testFan('ingliz')!
  const toplamlar = new Set(Array.from({ length: 10 }, () => testTanla(f).map((q) => q.s).join('|')))
  assert.ok(toplamlar.size > 1)
})

test('testDaraja va testFoiz — chegaralar', () => {
  const ingliz = testFan('ingliz')!
  assert.equal(testDaraja(ingliz, 0).nom, 'Beginner')
  assert.equal(testDaraja(ingliz, 7).nom, 'Intermediate')
  assert.equal(testDaraja(ingliz, 99).nom, 'Pre-IELTS')
  assert.equal(testFoiz(6, 8), 75)
  assert.equal(testFoiz(12, 8), 100)
  assert.equal(testFoiz(1, 0), 0)
  assert.equal(testFan('arab'), undefined)
})
