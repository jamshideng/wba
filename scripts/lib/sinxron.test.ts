import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uchTomon, juftla, teng, type Toplam, type Yozuv } from './sinxron'

const t = (o: Record<string, Yozuv>): Toplam => new Map(Object.entries(o))
const S = { maydonlar: ['fish', 'tel'], sheetsgaYozilmaydi: [] as string[] }

test('teng — bo‘sh joy, null, son-matn', () => {
  assert.ok(teng(' Ali  Vali ', 'Ali Vali'))
  assert.ok(teng('', null))
  assert.ok(teng(650000, '650000'))
  assert.ok(!teng(0, null))
})

test('1-qoida: ikkalasi bir xil — amal yo‘q', () => {
  const r = uchTomon(t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '1' } }), S)
  assert.deepEqual(r.amallar, [])
})

test('2-qoida: saytda o‘zgargan — Sheets’ga yoziladi', () => {
  const r = uchTomon(t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '2' } }), S)
  assert.deepEqual(r.amallar, [{ tur: 'sheetsga', kalit: 'S1', ozgarish: { tel: '2' }, eski: { tel: '1' } }])
  assert.equal(r.yangiBaza.get('S1')!.tel, '2')
})

test('Sheets’da o‘zgargan — saytga yoziladi', () => {
  const r = uchTomon(t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Alisher', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '1' } }), S)
  assert.deepEqual(r.amallar, [{ tur: 'saytga', kalit: 'S1', ozgarish: { fish: 'Alisher' }, eski: { fish: 'Ali' } }])
})

test('ikkalasi turlicha o‘zgargan — ziddiyat, baza o‘zgarmaydi', () => {
  const r = uchTomon(t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '3' } }), t({ S1: { fish: 'Ali', tel: '2' } }), S)
  assert.equal(r.amallar.length, 1)
  assert.equal(r.amallar[0].tur, 'ziddiyat')
  assert.equal(r.yangiBaza.get('S1')!.tel, '1')
})

test('ikkalasi bir xil o‘zgargan — amal yo‘q, baza yangilanadi', () => {
  const r = uchTomon(t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '2' } }), t({ S1: { fish: 'Ali', tel: '2' } }), S)
  assert.deepEqual(r.amallar, [])
  assert.equal(r.yangiBaza.get('S1')!.tel, '2')
})

test('baza yo‘q (birinchi yurish) va farq — ziddiyat', () => {
  const r = uchTomon(null, t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '2' } }), S)
  assert.equal(r.amallar[0].tur, 'ziddiyat')
})

test('4-qoida: faqat Sheets’da yangi — saytga qo‘shiladi', () => {
  const r = uchTomon(t({}), t({ S2: { fish: 'Vali', tel: null } }), t({}), S)
  assert.deepEqual(r.amallar, [{ tur: 'saytga-yangi', kalit: 'S2', yozuv: { fish: 'Vali', tel: null } }])
})

test('faqat saytda yangi — Sheets’ga qo‘shiladi', () => {
  const r = uchTomon(t({}), t({}), t({ 'sayt:1': { fish: 'Vali', tel: null } }), S)
  assert.equal(r.amallar[0].tur, 'sheetsga-yangi')
})

test('bazada bor, bir tomonda yo‘qolgan — o‘chirilmaydi, xabar', () => {
  const r = uchTomon(t({ S1: { fish: 'Ali', tel: '1' } }), t({}), t({ S1: { fish: 'Ali', tel: '1' } }), S)
  assert.equal(r.amallar[0].tur, 'yoqoldi')
  assert.ok(r.yangiBaza.has('S1'))
})

test('Sheets’ga yozilmaydigan maydon — qo‘lda', () => {
  const r = uchTomon(
    t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '1' } }), t({ S1: { fish: 'Ali', tel: '2' } }),
    { maydonlar: ['fish', 'tel'], sheetsgaYozilmaydi: ['tel'] },
  )
  assert.equal(r.amallar[0].tur, 'qolda')
  assert.equal(r.yangiBaza.get('S1')!.tel, '1')   // keyingi yurishda ham eslatiladi
})

test('juftla — ikkala tomonda kiritilgan bir xil to‘lov', () => {
  const m = juftla(
    [['T0200', { student_id: 'S1', summa: 600000, davr: '2026-10' }], ['T0201', { student_id: 'S2', summa: 600000, davr: '2026-10' }]],
    [['sayt:9', { student_id: 'S2', summa: 600000, davr: '2026-10' }]],
    (a, b) => a.student_id === b.student_id && a.summa === b.summa && a.davr === b.davr,
  )
  assert.deepEqual([...m], [['sayt:9', 'T0201']])
})
