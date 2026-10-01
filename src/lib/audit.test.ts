import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditFarqi, qiymatMatni } from './audit'

test('auditFarqi — faqat o‘zgargan maydonlar, updated_at e’tiborsiz', () => {
  const f = auditFarqi(
    { id: 1, summa: 500000, bekor: false, updated_at: 'a' },
    { id: 1, summa: 550000, bekor: false, updated_at: 'b' },
  )
  assert.deepEqual(f, [{ maydon: 'summa', eski: 500000, yangi: 550000 }])
})

test('auditFarqi — INSERT: bo‘sh maydonlar chiqmaydi', () => {
  const f = auditFarqi(null, { id: 7, fish: 'Ali', izoh: null, ota_tel: '' })
  assert.deepEqual(f.map((x) => x.maydon), ['id', 'fish'])
})

test('auditFarqi — DELETE: eski qiymatlar', () => {
  const f = auditFarqi({ id: 3, nom: 'G01' }, null)
  assert.deepEqual(f, [
    { maydon: 'id', eski: 3, yangi: null },
    { maydon: 'nom', eski: 'G01', yangi: null },
  ])
})

test('qiymatMatni — bo‘sh, mantiqiy va uzun qiymatlar', () => {
  assert.equal(qiymatMatni(null), '—')
  assert.equal(qiymatMatni(true), 'ha')
  assert.equal(qiymatMatni('x'.repeat(80)).length, 58)
})
