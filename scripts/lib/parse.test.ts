import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pulga, telefonga, sanaga, davrga, usulga, bosqichNormal,
  yonalishAniqla, ismVaId, axlatmi, kunTuriga, vaqtAjrat, kalitAjrat,
  oyRaqami, davrdan, oylarSoni, chegirmaOyda, narxTarixi, narxOyda, CHEKSIZ,
} from './parse'

test('pulga — Sheets formatlari', () => {
  assert.equal(pulga('650,000'), 650000)
  assert.equal(pulga('1 950 000'), 1950000)
  assert.equal(pulga('550000.00'), 550000)
  assert.equal(pulga(650000), 650000)
  assert.equal(pulga(''), 0)
  assert.equal(pulga('—'), 0)
})

test('telefonga — turli ko‘rinishlar bitta formatga tushadi', () => {
  assert.equal(telefonga('+998-90-123-45-67'), '+998901234567')
  assert.equal(telefonga('90 123 45 67'), '+998901234567')
  assert.equal(telefonga('998901234567'), '+998901234567')
  assert.equal(telefonga('nomalum'), null)
  assert.equal(telefonga(''), null)
})

test('sanaga', () => {
  assert.equal(sanaga('15.09.2026'), '2026-09-15')
  assert.equal(sanaga('2026-09-15'), '2026-09-15')
  assert.equal(sanaga('1.9.2026'), '2026-09-01')
  assert.equal(sanaga(''), null)
})

test('davrga', () => {
  assert.equal(davrga('2026-09'), '2026-09')
  assert.equal(davrga('2026-9'), '2026-09')
  assert.equal(davrga('15.09.2026'), '2026-09')
  assert.equal(davrga('axlat'), null)
})

test('usulga — aniqlanmasa null', () => {
  assert.equal(usulga('Naqd'), 'naqd')
  assert.equal(usulga('karta orqali'), 'karta')
  assert.equal(usulga('CLICK'), 'click')
  assert.equal(usulga('Payme'), 'payme')
  assert.equal(usulga(''), null)
  assert.equal(usulga('???'), null)
})

test('bosqichNormal — Pre-Inter va Pre-Intermediate birlashadi', () => {
  assert.equal(bosqichNormal('Pre-Inter'), 'Pre-Intermediate')
  assert.equal(bosqichNormal('Pre-Intermediate'), 'Pre-Intermediate')
  assert.equal(bosqichNormal('Beginner'), 'Beginner')
})

test('yonalishAniqla', () => {
  assert.equal(yonalishAniqla('Beginner'), 'ingliz-tili')
  assert.equal(yonalishAniqla('IELTS'), 'ingliz-tili')
  assert.equal(yonalishAniqla('Rus tili'), 'rus-tili')
  assert.equal(yonalishAniqla('Arab tili'), 'arab-tili')
  assert.equal(yonalishAniqla('Matematika'), 'matematika')
  assert.equal(yonalishAniqla('Scratch'), 'scratch')
  assert.equal(yonalishAniqla('Nomalum fan'), null)
})

test('kunTuriga — shanba ikki turga kiradi, shuning uchun uchta tur bor', () => {
  assert.equal(kunTuriga('Toq kun'), 'toq')
  assert.equal(kunTuriga('Juft kun'), 'juft')
  assert.equal(kunTuriga('Dam olish'), 'dam_olish')
  assert.equal(kunTuriga(''), null)
  assert.equal(kunTuriga('nomalum'), null)
})

test('vaqtAjrat', () => {
  assert.deepEqual(vaqtAjrat('08:30-10:00'), { boshlanish: '08:30', tugash: '10:00' })
  assert.deepEqual(vaqtAjrat('8:30 – 10:00'), { boshlanish: '08:30', tugash: '10:00' })
  assert.deepEqual(vaqtAjrat('18:30/20:00'), { boshlanish: '18:30', tugash: '20:00' })
  assert.equal(vaqtAjrat(''), null)
})

test('kalitAjrat — guruh nomining ichida ham "·" bor', () => {
  assert.deepEqual(kalitAjrat("Muslima G'ayratova (S001) · Elementary · Diyora · 18:30-20:00"), {
    fish: "Muslima G'ayratova",
    id: 'S001',
    guruh: 'Elementary · Diyora · 18:30-20:00',
  })
  assert.deepEqual(kalitAjrat('Dilbek (S077)'), { fish: 'Dilbek', id: 'S077', guruh: null })
  assert.deepEqual(kalitAjrat(''), { fish: '', id: null, guruh: null })
})

test('oyRaqami va davrdan — bir-birining teskarisi', () => {
  assert.equal(oyRaqami('2026-09'), 2026 * 12 + 9)
  assert.equal(oyRaqami('15.09.2026'), 2026 * 12 + 9)
  assert.equal(oyRaqami('axlat'), 0)
  assert.equal(davrdan(2026 * 12 + 9), '2026-09')
  assert.equal(davrdan(2026 * 12 + 12), '2026-12')
  assert.equal(davrdan(2027 * 12 + 1), '2027-01')
})

test('oylarSoni — kalendar oy (oyning 1-sanasidan)', () => {
  const bugun = new Date('2026-09-17T00:00:00Z')
  assert.equal(oylarSoni('2026-09-01', null, bugun), 1)
  assert.equal(oylarSoni('2026-07-01', null, bugun), 3)
  // 20-avgustda kelgan — sentabr ham to'liq oy
  assert.equal(oylarSoni('2026-08-20', null, bugun), 2)
  assert.equal(oylarSoni('2026-09-25', null, new Date('2026-10-02T00:00:00Z')), 2)
  assert.equal(oylarSoni('2026-09-01', '2026-11-01', bugun), 3)
  assert.equal(oylarSoni('', null, bugun), 0)
})

test('chegirmaOyda — ikki bosqich, bo‘sh "necha oy" muddatsiz degani', () => {
  const bir = { summa: 100000, oylar: 1 }
  const ikki = { summa: 50000, oylar: 2 }
  assert.equal(chegirmaOyda(1, bir, ikki), 100000)
  assert.equal(chegirmaOyda(2, bir, ikki), 50000)
  assert.equal(chegirmaOyda(3, bir, ikki), 50000)
  assert.equal(chegirmaOyda(4, bir, ikki), 0)

  // Direktor qoidasi: 600 to'lagan -> 50 000 DOIMIY
  const doimiy = { summa: 50000, oylar: null }
  const yoq = { summa: 0, oylar: null }
  assert.equal(chegirmaOyda(1, doimiy, yoq), 50000)
  assert.equal(chegirmaOyda(99, doimiy, yoq), 50000)
  assert.equal(chegirmaOyda(1, yoq, yoq), 0)
})

test('narxTarixi va narxOyda — o‘tgan oylar narx ko‘tarilganda o‘zgarmaydi', () => {
  const tarix = narxTarixi([
    { guruh: 'Elementary · Komila', narx: 650000, oydan: '2026-01' },
    { guruh: 'Elementary · Komila', narx: 750000, oydan: '2027-01' },
  ])
  const el = tarix.get('Elementary · Komila')!
  assert.equal(el.length, 2)
  // Birinchi qator orqaga cheksiz amal qiladi
  assert.equal(el[0].dan, 0)
  assert.equal(el[1].gacha, CHEKSIZ)

  assert.equal(narxOyda(el, oyRaqami('2025-05'), 0), 650000)
  assert.equal(narxOyda(el, oyRaqami('2026-09'), 0), 650000)
  assert.equal(narxOyda(el, oyRaqami('2027-03'), 0), 750000)

  // Tarixi yo'q guruh — guruhning joriy narxi
  assert.equal(narxOyda(tarix.get('Yo‘q guruh'), oyRaqami('2026-09'), 650000), 650000)
})

test('ismVaId', () => {
  assert.deepEqual(ismVaId('Madina Abduganiyeva (S015)'), {
    fish: 'Madina Abduganiyeva',
    id: 'S015',
  })
  assert.deepEqual(ismVaId('Dilbek'), { fish: 'Dilbek', id: null })
})

test('axlatmi — buzilgan qatorlarni ushlaydi', () => {
  assert.equal(axlatmi('Dars Soati: 19:30-21:00'), true)
  assert.equal(axlatmi('namuna'), true)
  assert.equal(axlatmi('sdfd'), true)
  assert.equal(axlatmi(''), true)
  assert.equal(axlatmi('123'), true)
  assert.equal(axlatmi('—'), true)
  assert.equal(axlatmi('Muslima G‘ayratova'), false)
  assert.equal(axlatmi('Dilbek'), false)
})
