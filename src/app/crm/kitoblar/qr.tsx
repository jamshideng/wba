import QRCode from 'qrcode'
import { headers } from 'next/headers'

/**
 * Buyurtma QR'i (0143). Ichida — buyurtma havolasi: admin telefonning oddiy
 * kamerasi bilan skanerlaydi, sahifa o'sha buyurtma bilan ochiladi.
 * "Berildi" tugmasi faqat rahbariyatga chiqadi (sahifa + bazada kitob_berildi).
 * Saytda kamera ruxsati yopiq qoladi (Permissions-Policy camera=()).
 */
export async function kodHavolasi(kod: string): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'wbalc.uz'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}/crm/kitoblar?kod=${encodeURIComponent(kod)}`
}

export async function KodQR({ kod, olcham = 168 }: { kod: string; olcham?: number }) {
  const havola = await kodHavolasi(kod)
  // Faqat bizning kodimiz va havolamiz kiradi — SVG xavfsiz (foydalanuvchi matni yo'q)
  const svg = await QRCode.toString(havola, { type: 'svg', margin: 1, width: olcham, errorCorrectionLevel: 'M' })
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <div
        role="img"
        aria-label={`QR kod: ${kod}`}
        className="rounded-[10px] border border-line bg-white p-2"
        style={{ width: olcham + 18, height: olcham + 18 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="tnum text-[15px] font-bold tracking-[0.08em]">{kod}</figcaption>
    </figure>
  )
}
