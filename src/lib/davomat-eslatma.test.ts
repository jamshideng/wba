import { test } from 'node:test'
import assert from 'node:assert/strict'
import { navbatdagiEslatma, daqiqa, ESLATMA_DAQIQA } from './davomat-eslatma'

const dars = { tugash: '09:30:00', yuborilgan: [] as number[] }

test('daqiqa — HH:MM va HH:MM:SS', () => {
  assert.equal(daqiqa('09:30'), 570)
  assert.equal(daqiqa('09:30:00'), 570)
  assert.equal(daqiqa('00:00'), 0)
})

test('tugash + 10 daqiqa — 1-eslatma', () => {
  assert.equal(ESLATMA_DAQIQA[1], 10)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '09:35' }), null)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '09:39' }), null)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '09:40' }), 1)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '10:00' }), 1)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '10:00', yuborilgan: [1] }), null)
})

test('tugash + 60 daqiqa — 2-eslatma, bir marta', () => {
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '10:29', yuborilgan: [1] }), null)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '10:30', yuborilgan: [1] }), 2)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '12:00', yuborilgan: [1, 2] }), null)
})

test('cron kechiksa — faqat 2-eslatma ketadi, 1-si keyin ketmaydi', () => {
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '11:00' }), 2)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '11:05', yuborilgan: [2] }), null)
})

test('yarim tunga yaqin dars — kun o‘tadigan eslatma yuborilmaydi', () => {
  // 23:20 tugaydi: 1-eslatma 23:30 da, 2-si 00:20 ga o'tadi — yo'q
  assert.equal(navbatdagiEslatma({ tugash: '23:20', yuborilgan: [], hozir: '23:30' }), 1)
  assert.equal(navbatdagiEslatma({ tugash: '23:20', yuborilgan: [1], hozir: '23:59' }), null)
  // 23:55 tugaydi: ikkalasi ham ertaga — hech biri
  assert.equal(navbatdagiEslatma({ tugash: '23:55', yuborilgan: [], hozir: '23:59' }), null)
  // 22:30 tugaydi: 2-eslatma 23:30 — shu kun ichida
  assert.equal(navbatdagiEslatma({ tugash: '22:30', yuborilgan: [1], hozir: '23:30' }), 2)
})

test('o‘sha kuni darsi yo‘q guruh — hech qachon', () => {
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '10:30', darsBor: false }), null)
  assert.equal(navbatdagiEslatma({ ...dars, hozir: '09:00' }), null)
})
