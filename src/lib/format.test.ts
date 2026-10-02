import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guruhQisqa, guruhUstozsiz } from './format'

test('guruhQisqa — Sheets nomidan faqat yo‘nalish', () => {
  assert.equal(guruhQisqa('Beginner · Komila Bozorova · 15:00-16:30, Toq kun'), 'Beginner')
  assert.equal(guruhQisqa('English  · Sanobar Ergasheva · 08:30-10:00, Toq kun'), 'English')
  assert.equal(guruhQisqa('Turk tili IND · Komila Bozorova · 9:00-10:00, Dam olish'), 'Turk tili IND')
})

test('guruhQisqa — boshqa shakldagi nom o‘zgarmaydi', () => {
  assert.equal(guruhQisqa('SINOV jurnal'), 'SINOV jurnal')
  assert.equal(guruhQisqa('Ingliz · A1'), 'Ingliz · A1')
  assert.equal(guruhQisqa(null), '—')
})

test('guruhUstozsiz — yo‘nalish va vaqt', () => {
  assert.equal(guruhUstozsiz('Beginner · Komila Bozorova · 15:00-16:30, Toq kun'), 'Beginner · 15:00-16:30, Toq kun')
  assert.equal(guruhUstozsiz('SINOV jurnal'), 'SINOV jurnal')
})
