import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonLdMatn, kursSchema, kurslarSchema, llmsMatn, nonKroshkaSchema, savollarSchema, tashkilotSchema, ustozSchema } from './seo'
import { MARKAZ, YONALISHLAR } from './markaz'
import { SAVOLLAR } from './savollar'

const SAYT = 'https://wbalc.uz'

/** Chuqur maydonlarni tekshirish uchun — JSON.parse natijasi erkin tipda */
const ochiq = (x: unknown) => JSON.parse(JSON.stringify(x))

test('tashkilotSchema — manzil, koordinata va telefon markaz.ts dan', () => {
  const t = ochiq(tashkilotSchema(SAYT))
  assert.equal(t['@id'], 'https://wbalc.uz/#tashkilot')
  assert.equal(t.telephone, MARKAZ.telefonRaw)
  assert.equal(t.geo.latitude, MARKAZ.koordinata.kenglik)
  assert.deepEqual(t.sameAs, [MARKAZ.telegram, MARKAZ.instagram])
  assert.equal('openingHours' in t, false)
})

test('kurslarSchema — har yo‘nalish Course, markazga bog‘langan', () => {
  const k = ochiq(kurslarSchema(SAYT))
  assert.equal(k.itemListElement.length, YONALISHLAR.length)
  assert.equal(k.itemListElement[0].item['@type'], 'Course')
  assert.equal(k.itemListElement[0].item.provider['@id'], 'https://wbalc.uz/#tashkilot')
})

test('savollarSchema — lendingdagi savollar bilan bir xil', () => {
  const f = ochiq(savollarSchema())
  assert.equal(f.mainEntity.length, SAVOLLAR.length)
  assert.equal(f.mainEntity[0].acceptedAnswer.text, SAVOLLAR[0].j)
})

test('ustozSchema — slug kodlanadi, bo‘sh fanlar qo‘shilmaydi', () => {
  const u = ochiq(ustozSchema({ ism: 'Ali', slug: 'ali vali', fanlar: [] }, SAYT))
  assert.equal(u.url, 'https://wbalc.uz/ustozlar/ali%20vali')
  assert.equal('knowsAbout' in u, false)
})

test('jsonLdMatn — </script> tegni yopib qo‘ymaydi', () => {
  const m = jsonLdMatn({ name: '</script><script>alert(1)</script>' })
  assert.equal(m.includes('</script>'), false)
  assert.equal(JSON.parse(m).name, '</script><script>alert(1)</script>')
})

test('llmsMatn — sarlavha, telefon va barcha kurslar bor', () => {
  const m = llmsMatn(SAYT)
  assert.ok(m.startsWith(`# ${MARKAZ.nom}\n`))
  assert.ok(m.includes(MARKAZ.telefon))
  for (const y of YONALISHLAR) assert.ok(m.includes(y.nom), y.nom)
  assert.ok(m.includes('650 000 so‘m'))
})

test('kursSchema — sahifa manzili, narx va tashkilot bir joyda', () => {
  const [t, k] = ochiq(kursSchema(YONALISHLAR[0], SAYT))
  assert.equal(t['@id'], 'https://wbalc.uz/#tashkilot')
  assert.equal(k.url, 'https://wbalc.uz/kurslar/ingliz-tili')
  assert.equal(k.name, 'Ingliz tili kurslari Toshkentda')
  assert.equal(k.offers.priceCurrency, 'UZS')
})

test('nonKroshkaSchema — bosh sahifadan boshlanadi, tartib raqami to‘g‘ri', () => {
  const b = ochiq(nonKroshkaSchema([{ nom: 'Kurslar', yol: '/#kurslar' }], SAYT))
  assert.equal(b.itemListElement.length, 2)
  assert.equal(b.itemListElement[0].item, 'https://wbalc.uz/')
  assert.equal(b.itemListElement[1].position, 2)
})
