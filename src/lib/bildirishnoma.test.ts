import { test } from 'node:test'
import assert from 'node:assert/strict'
import { havolaToza, variantlarniOqi } from './bildirishnoma'

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
