import { test } from 'node:test'
import assert from 'node:assert/strict'
import { qaytaHisobHolati, somProbel } from './qayta-hisob'

// Misol: oylik 450 000, 13 dars, bir dars 34 615; 5 dars → S = 173 075
const S = 34615 * 5

test('a) oy to\'liq to\'langan, avval qayta hisob yo\'q — jami = shu safar', () => {
  assert.deepEqual(qaytaHisobHolati(S, 450000, 450000, 0), { tur: 'tolangan', shuSafar: 173075, jami: 173075, naqd: 173075 })
})

test('a) avvalgi qayta hisob 69 230 hali ishlatilmagan — jami va naqd 242 305', () => {
  // F hozirgi: 450 000 − 69 230 = 380 770, P = 450 000; umumiy balans +69 230
  assert.deepEqual(qaytaHisobHolati(S, 380770, 450000, 69230), { tur: 'tolangan', shuSafar: 173075, jami: 242305, naqd: 242305 })
})

test('a) sentabr ortiqchasi oktabrda ishlatilgan — naqd faqat shu safargi', () => {
  // umumiy balans 0: 69 230 oktabr to'lovidan ayirilib bo'lgan
  assert.deepEqual(qaytaHisobHolati(S, 380770, 450000, 0), { tur: 'tolangan', shuSafar: 173075, jami: 242305, naqd: 173075 })
})

test('a) boshqa kursda qarz bor — naqd yana kamayadi', () => {
  assert.deepEqual(qaytaHisobHolati(S, 450000, 450000, -100000), { tur: 'tolangan', shuSafar: 173075, jami: 173075, naqd: 73075 })
})

test('b) oy umuman to\'lanmagan — tanlov yo\'q, endi to\'lanadi F − S', () => {
  assert.deepEqual(qaytaHisobHolati(S, 450000, 0), { tur: 'tolanmagan', endiTolanadi: 276925 })
})

test('c) qisman, S ≤ qarz — faqat ma\'lumot, endi to\'lanadi F − P − S', () => {
  assert.deepEqual(qaytaHisobHolati(S, 450000, 200000), { tur: 'qisman', qarz: 250000, endiTolanadi: 76925 })
})

test('c) qisman, S > qarz — qarz 0, ortgani uchun tanlov', () => {
  assert.deepEqual(qaytaHisobHolati(S, 450000, 400000, -50000), { tur: 'qisman_ortiqcha', qarz: 50000, jami: 123075, naqd: 123075 })
})

test('c) chegarada S = qarz — ortiqcha yo\'q, endi to\'lanadi 0', () => {
  assert.deepEqual(qaytaHisobHolati(S, 450000, 450000 - S), { tur: 'qisman', qarz: S, endiTolanadi: 0 })
})

test('somProbel — oddiy probel bilan', () => {
  assert.equal(somProbel(173075), '173 075')
  assert.equal(somProbel(242305), '242 305')
  assert.equal(somProbel(34615), '34 615')
  assert.equal(somProbel(999), '999')
})
