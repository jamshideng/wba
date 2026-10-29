import { NextResponse, type NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { getProfile, adminmi } from '@/lib/auth'
import { davrNomi } from '@/lib/format'
import { natijaMatni, type OylikNatija } from '@/lib/oylik-test'

/**
 * Oylik test natijalari — bitta Excel fayl (faqat admin).
 *   1-varaq "Natijalar": har o'quvchi — guruh, fan, ustoz, natija, foiz, o'rin
 *   2-varaq "Guruhlar":  guruh bo'yicha o'rtacha, eng yuqori, eng past
 * Kataklar matn/son sifatida yoziladi (formula emas).
 */
export async function GET(req: NextRequest) {
  if (!supabaseSozlanganmi()) return new NextResponse('Supabase ulanmagan', { status: 503 })
  const profil = await getProfile()
  if (!profil) return new NextResponse('Tizimga kiring', { status: 401 })
  if (!adminmi(profil.rol)) return new NextResponse('Bu fayl faqat adminga ochiq', { status: 403 })

  const davr = req.nextUrl.searchParams.get('davr') ?? ''
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(davr)) return new NextResponse('davr (YYYY-MM) kerak', { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase.from('v_oylik_natijalar').select('*').eq('davr', davr)
  const natijalar = ((data ?? []) as OylikNatija[]).sort(
    (a, b) => a.guruh.localeCompare(b.guruh, 'uz') || (a.orin ?? 999) - (b.orin ?? 999) || a.fish.localeCompare(b.fish, 'uz'),
  )

  const qatorlar: (string | number)[][] = [
    [`Oylik test natijalari — ${davrNomi(davr)}`],
    [],
    ['№', 'Guruh', 'Fan', 'Ustoz', 'ID', 'F.I.Sh', 'Natija', 'Foiz', 'IELTS Overall', 'Guruhdagi o‘rin', 'Izoh', 'Holat'],
  ]
  natijalar.forEach((n, i) => {
    qatorlar.push([
      i + 1,
      n.guruh,
      n.fan ?? '',
      n.ustoz ?? '',
      n.student_id,
      n.fish,
      natijaMatni(n),
      n.foiz != null ? Number(n.foiz) : '',
      n.turi === 'ielts' && n.ball != null ? Number(n.ball) : '',
      n.orin ?? '',
      n.izoh ?? '',
      n.elon_qilingan ? 'E’lon qilingan' : 'E’lon qilinmagan',
    ])
  })

  const guruhlar = new Map<string, OylikNatija[]>()
  for (const n of natijalar) guruhlar.set(n.guruh, [...(guruhlar.get(n.guruh) ?? []), n])
  const jamlanma: (string | number)[][] = [
    [`Guruhlar bo‘yicha — ${davrNomi(davr)}`],
    [],
    ['Guruh', 'Fan', 'Ustoz', 'Natijalar', 'Kelmadi', 'O‘rtacha %', 'Eng yuqori %', 'Eng past %'],
  ]
  for (const [nom, r] of guruhlar) {
    const f = r.filter((x) => x.foiz != null).map((x) => Number(x.foiz))
    jamlanma.push([
      nom,
      r[0].fan ?? '',
      r[0].ustoz ?? '',
      r.length,
      r.filter((x) => !x.keldi).length,
      f.length ? Math.round((f.reduce((a, b) => a + b, 0) / f.length) * 10) / 10 : '',
      f.length ? Math.max(...f) : '',
      f.length ? Math.min(...f) : '',
    ])
  }

  const v1 = XLSX.utils.aoa_to_sheet(qatorlar)
  v1['!cols'] = [{ wch: 4 }, { wch: 38 }, { wch: 14 }, { wch: 20 }, { wch: 7 }, { wch: 28 }, { wch: 44 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 24 }, { wch: 16 }]
  const v2 = XLSX.utils.aoa_to_sheet(jamlanma)
  v2['!cols'] = [{ wch: 38 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 11 }, { wch: 12 }, { wch: 10 }]
  const kitob = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(kitob, v1, 'Natijalar')
  XLSX.utils.book_append_sheet(kitob, v2, 'Guruhlar')
  const bufer = XLSX.write(kitob, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(bufer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="oylik-test-${davr}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
