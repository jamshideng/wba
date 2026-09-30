import { ImageResponse } from 'next/og'

/** Havola ulashilganda (Telegram, Instagram) ko'rinadigan rasm. */
export const alt = 'World Bridge Academy — Toshkentda o‘quv markazi'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgRasm() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#0D0A09',
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 6, color: '#FF4D4D' }}>
          WORLD BRIDGE ACADEMY
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            Bir guruhda 12 kishidan ortiq bo‘lmaydi.
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 34, color: '#B8B0AC' }}>
            Toshkent · 2018 yildan beri · birinchi dars bepul
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#B8B0AC' }}>wbalc.uz</div>
      </div>
    ),
    size,
  )
}
