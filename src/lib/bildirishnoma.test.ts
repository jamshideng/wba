import { test } from 'node:test'
import assert from 'node:assert/strict'
import { havolaToza, savollarniOqi, variantlarniOqi } from './bildirishnoma'

test('variantlarniOqi — bo‘sh va takrorlar tashlanadi, 10 tagacha', () => {
  assert.deepEqual(variantlarniOqi('Ha\n\n Yo‘q \nHa\r\nBilmayman'), ['Ha', 'Yo‘q', 'Bilmayman'])
  assert.equal(variantlarniOqi(Array.from({ length: 15 }, (_, i) => `v${i}`).join('\n')).length, 10)
})

test('havolaToza — faqat ichki yo‘l yoki https', () => {
  assert.equal(havolaToza('/crm/market'), '/crm/market')
  assert.equal(havolaToza('https://t.me/wba'), 'https://t.me/wba')
  assert.equal(havolaToza('//evil.com'), null)
  assert.equal(havolaToza('javascript:alert(1)'), null)
  assert.equal(havolaToza('http://x.uz'), null)
  assert.equal(havolaToza('  '), null)
})

test('savollarniOqi — bo‘sh savol nomi sarlavhadan, 2 variantsizlar tashlanadi', () => {
  const xom = JSON.stringify([
    { matn: '', kop_tanlov: false, variantlar: ['Ha', 'Yo‘q'] },
    { matn: 'Qaysi fan?', kop_tanlov: true, variantlar: ['Ingliz', 'Matematika', 'Ingliz'] },
    { matn: 'Bitta variant', variantlar: ['Faqat'] },
  ])
  assert.deepEqual(savollarniOqi(xom, 'Fikringiz'), [
    { matn: 'Fikringiz', kop_tanlov: false, variantlar: ['Ha', 'Yo‘q'] },
    { matn: 'Qaysi fan?', kop_tanlov: true, variantlar: ['Ingliz', 'Matematika'] },
  ])
  assert.deepEqual(savollarniOqi('buzuq', 'x'), [])
  assert.equal(savollarniOqi(JSON.stringify(Array.from({ length: 15 }, () => ({ matn: 's', variantlar: ['a', 'b'] }))), 'x').length, 10)
})
