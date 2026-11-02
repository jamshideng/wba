import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summaOqi, telefonOqi, sanaOqi, davrOqi, sonOqi, xabarliYol, xatoMatni, ichkiYol, telegramUserOqi } from './kiritish'

test('summaOqi — botdagi qoida: 3000 dan kichik raqam minglarda', () => {
  assert.equal(summaOqi('550'), 550_000)
  assert.equal(summaOqi('650 000'), 650_000)
  assert.equal(summaOqi('650,000'), 650_000)
  assert.equal(summaOqi('1.2 mln'), 1_200_000)
  assert.equal(summaOqi('600 ming'), 600_000)
  assert.equal(summaOqi('3000'), 3000)
  assert.equal(summaOqi(''), null)
  assert.equal(summaOqi('abc'), null)
  assert.equal(summaOqi('0'), null)
})

test('telefonOqi — bo‘sh null, noto‘g‘ri undefined', () => {
  assert.equal(telefonOqi('90 123 45 67'), '+998901234567')
  assert.equal(telefonOqi('+998-90-123-45-67'), '+998901234567')
  assert.equal(telefonOqi(''), null)
  assert.equal(telefonOqi('12345'), undefined)
})

test('sanaOqi / davrOqi / sonOqi', () => {
  assert.equal(sanaOqi('2026-09-17'), '2026-09-17')
  assert.equal(sanaOqi('17.09.2026'), null)
  assert.equal(davrOqi('2026-09'), '2026-09')
  assert.equal(davrOqi('2026-13'), null)
  assert.equal(sonOqi('3'), 3)
  assert.equal(sonOqi(''), null)
  assert.equal(sonOqi('2.5'), null)
})

test('xabarliYol — eski xabar almashtiriladi, boshqa parametrlar qoladi', () => {
  assert.equal(xabarliYol('/crm/tolovlar', { ok: 'Saqlandi' }), '/crm/tolovlar?ok=Saqlandi')
  assert.equal(
    xabarliYol('/crm/tolovlar?filtr=tasdiqlanmagan&xato=eski', { ok: 'Tasdiqlandi' }),
    '/crm/tolovlar?filtr=tasdiqlanmagan&ok=Tasdiqlandi',
  )
})

test('xatoMatni — bazadagi o‘zbekcha xabar o‘zgarmaydi, texnik kod tarjima qilinadi', () => {
  assert.equal(xatoMatni({ message: 'Guruh tanlanmagan — avval guruhni belgilang.' }), 'Guruh tanlanmagan — avval guruhni belgilang.')
  assert.equal(xatoMatni({ code: '42501', message: 'new row violates row-level security policy' }), 'Bu amal uchun huquqingiz yo‘q.')
})

test('ichkiYol — faqat ichki yo‘l, ochiq yo‘naltirish rad etiladi', () => {
  assert.equal(ichkiYol('/crm'), '/crm')
  assert.equal(ichkiYol('/crm/tolovlar?filtr=x'), '/crm/tolovlar?filtr=x')
  assert.equal(ichkiYol('//evil.com'), '/crm')
  assert.equal(ichkiYol('/\\evil.com'), '/crm')
  assert.equal(ichkiYol('https://evil.com'), '/crm')
  assert.equal(ichkiYol('/%2F%2Fevil.com'), '/crm')
  assert.equal(ichkiYol(''), '/crm')
  assert.equal(ichkiYol(null), '/crm')
})

test('telegramUserOqi — username va havolalar (0116)', () => {
  assert.equal(telegramUserOqi('@komila_ustoz'), 'komila_ustoz')
  assert.equal(telegramUserOqi('komila_ustoz'), 'komila_ustoz')
  assert.equal(telegramUserOqi('https://t.me/komila_ustoz'), 'komila_ustoz')
  assert.equal(telegramUserOqi('t.me/komila_ustoz/'), 'komila_ustoz')
  assert.equal(telegramUserOqi('telegram.me/Komila2026'), 'Komila2026')
  assert.equal(telegramUserOqi(''), null)
  assert.equal(telegramUserOqi(null), null)
  assert.equal(telegramUserOqi('abc'), undefined) // 5 belgidan kam
  assert.equal(telegramUserOqi('1komila'), undefined) // raqam bilan boshlanadi
  assert.equal(telegramUserOqi('komila ustoz'), undefined)
  assert.equal(telegramUserOqi('https://instagram.com/komila_ustoz'), undefined)
  assert.equal(telegramUserOqi('+998901234567'), undefined)
  assert.equal(telegramUserOqi('komila_'), undefined)
})
