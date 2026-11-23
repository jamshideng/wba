import { NextResponse, type NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { getProfile, adminmi } from '@/lib/auth'

/**
 * Kitoblar hisoboti — Excel (0143). Faqat rahbariyat (bazadagi funksiyalar
 * ham app_is_admin() bilan cheklangan). Kataklar matn/son — formula emas.
 */

const sanami = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

function vaqt(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "=", "+", "-", "@" bilan boshlangan matn Excel'da formula bo'lib ketmasin */
const xavfsiz = (v: string | null | undefined) => {
  const s = v ?? ''
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

export async function GET(req: NextRequest) {
  if (!supabaseSozlanganmi()) return new NextResponse('Supabase ulanmagan', { status: 503 })
  const profil = await getProfile()
  if (!profil) return new NextResponse('Tizimga kiring', { status: 401 })
  if (!adminmi(profil.asl_rol ?? profil.rol)) return new NextResponse('Bu fayl sizga ochiq emas', { status: 403 })

  const dan = sanami(req.nextUrl.searchParams.get('dan'))
  const gacha = sanami(req.nextUrl.searchParams.get('gacha'))
  if (!dan || !gacha) return new NextResponse('dan va gacha (YYYY-MM-DD) kerak', { status: 400 })

  const supabase = await createClient()
  const [{ data: davr }, { data: berilganlar }, { data: qoldiq }] = await Promise.all([
    supabase.rpc('kitob_hisobot', { p_dan: dan, p_gacha: gacha }),
    supabase.rpc('kitob_berilganlar', { p_dan: dan, p_gacha: gacha }),
    supabase.rpc('kitob_qoldiq'),
  ])

  const kitob = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    kitob,
    XLSX.utils.aoa_to_sheet([
      [`Davr: ${dan} — ${gacha}`],
      ['Kitob', 'Holat', 'Kelgan (davrda)', 'Berilgan (davrda)', 'Qaytgan (davrda)'],
      ...(davr ?? []).map((r) => [xavfsiz(r.nom), r.holat, r.kelgan, r.berilgan, r.qaytarilgan]),
    ]),
    'Davr',
  )
  XLSX.utils.book_append_sheet(
    kitob,
    XLSX.utils.aoa_to_sheet([
      ['Kitob', 'Holat', 'Kelgan', 'Berilgan', 'Qaytgan', 'Omborda', 'Band', 'Bo‘sh'],
      ...(qoldiq ?? []).map((r) => [xavfsiz(r.nom), r.holat, r.kelgan, r.berilgan, r.qaytarilgan, r.omborda, r.band, r.bosh]),
    ]),
    'Qoldiq',
  )
  XLSX.utils.book_append_sheet(
    kitob,
    XLSX.utils.aoa_to_sheet([
      ['O‘quvchi ID', 'O‘quvchi', 'Kitob', 'Kod', 'Ustoz', 'Guruh', 'Berildi', 'Holat', 'Qaytarish sababi'],
      ...(berilganlar ?? []).map((r) => [
        r.student_id, xavfsiz(r.fish), xavfsiz(r.kitob), r.kod, xavfsiz(r.ustoz), xavfsiz(r.guruh),
        vaqt(r.berildi_vaqt), r.holat === 'qaytarildi' ? 'Qaytarildi' : 'Olgan', xavfsiz(r.sabab),
      ]),
    ]),
    'O‘quvchilar',
  )

  const bufer = XLSX.write(kitob, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new NextResponse(new Uint8Array(bufer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="kitoblar-${dan}-${gacha}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
