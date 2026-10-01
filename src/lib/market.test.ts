import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kodNormal, omborMatni } from './market'

test('kodNormal — WM- bilan va usiz, kichik harf, bo‘shliq', () => {
  assert.equal(kodNormal('WM-7K4P2X'), 'WM-7K4P2X')
  assert.equal(kodNormal(' wm-7k4p2x '), 'WM-7K4P2X')
  assert.equal(kodNormal('7k4p2x'), 'WM-7K4P2X')
  assert.equal(kodNormal('WM-7K4P2'), null)
  // chalkash belgilar (0, O, 1, I) kodda yo'q
  assert.equal(kodNormal('WM-0O1I22'), null)
  assert.equal(kodNormal(''), null)
})

test('omborMatni — cheksiz, tugagan, kam qolgan', () => {
  assert.deepEqual(omborMatni({ cheksiz: true, qolgan_soni: 0 }), { matn: 'Bor', tugagan: false, kam: false })
  assert.deepEqual(omborMatni({ cheksiz: false, qolgan_soni: 0 }), { matn: 'Tugagan', tugagan: true, kam: false })
  assert.deepEqual(omborMatni({ cheksiz: false, qolgan_soni: 2 }), { matn: '2 ta qoldi', tugagan: false, kam: true })
  assert.deepEqual(omborMatni({ cheksiz: false, qolgan_soni: 9 }), { matn: '9 ta qoldi', tugagan: false, kam: false })
})
