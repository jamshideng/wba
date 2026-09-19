import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { getProfile } from '@/lib/auth'
import { bugunToshkent } from '@/lib/format'
import type { AttendanceStatus } from '@/lib/types'

/**
 * Guruhning bir oylik davomati — Excel ochadigan CSV.
 * Botdagi "Oylik davomat (Excel)" tugmasi bilan bir xil vazifa.
 *
 * Huquq RLS'da: ustoz boshqa guruhni so'rasa guruh "topilmaydi".
 * Ajratuvchi ";" va boshida BOM — o'zbek/rus sozlamali Excel ustunlarni
 * to'g'ri ajratib, kirillcha/o'zbekcha harflarni buzmay ochsin.
 */

const BELGI: Record<AttendanceStatus, string> = {
  keldi: '+',
  kechikdi: 'K',
  sababli: 'S',
  kelmadi: '-',
}

function katak(v: string | number): string {
  const s = String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  if (!supabaseSozlanganmi()) return new NextResponse('Supabase ulanmagan', { status: 503 })

  /* Eksport — xodim va ustoz ishi. O'quvchiga RLS baribir faqat o'z
     qatorini berardi, lekin guruh jurnali unga umuman kerak emas. */
  const profil = await getProfile()
  if (!profil) return new NextResponse('Tizimga kiring', { status: 401 })
  if (!['admin', 'direktor', 'qabulxona', 'ustoz'].includes(profil.rol)) {
    return new NextResponse('Bu fayl sizga ochiq emas', { status: 403 })
  }

  const guruh = req.nextUrl.searchParams.get('guruh') ?? ''
  const davr = req.nextUrl.searchParams.get('davr') ?? ''
  if (!guruh || !/^\d{4}-(0[1-9]|1[0-2])$/.test(davr)) {
    return new NextResponse('guruh va davr (YYYY-MM) kerak', { status: 400 })
  }

  const supabase = await createClient()
  const { data: g } = await supabase.from('groups').select('id, nom').eq('id', guruh).maybeSingle()
  if (!g) return new NextResponse('Guruh topilmadi', { status: 404 })

  const boshi = `${davr}-01`
  const [y, m] = davr.split('-').map(Number)
  const oxiri = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  // Kelajakdagi darslar ustun ham, foiz ham bo'lmaydi (v_attendance_monthly bilan bir qoida)
  const bugun = bugunToshkent()
  const gacha = oxiri < bugun ? oxiri : bugun

  const [{ data: darslar }, { data: yozilishlar }] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, sana')
      .eq('group_id', guruh)
      .gte('sana', boshi)
      .lte('sana', gacha)
      .order('sana'),
    supabase
      .from('enrollments')
      .select('student_id, boshlandi, tugadi, students(fish)')
      .eq('group_id', guruh)
      .lte('boshlandi', oxiri),
  ])

  const dList = (darslar ?? []) as { id: string; sana: string }[]
  type Y = { student_id: string; boshlandi: string; tugadi: string | null; students: { fish: string } | null }
  const oquvchilar = ((yozilishlar ?? []) as unknown as Y[])
    .filter((e) => !e.tugadi || e.tugadi >= boshi)
    .sort((a, b) => (a.students?.fish ?? '').localeCompare(b.students?.fish ?? '', 'uz'))

  const { data: belgilar } = dList.length
    ? await supabase
        .from('attendance')
        .select('lesson_id, student_id, holat')
        .in('lesson_id', dList.map((d) => d.id))
    : { data: [] }

  const xarita = new Map(
    ((belgilar ?? []) as { lesson_id: string; student_id: string; holat: AttendanceStatus }[]).map((b) => [
      `${b.lesson_id}|${b.student_id}`,
      b.holat,
    ]),
  )

  const qatorlar: string[] = []
  qatorlar.push([`${g.nom} — ${davr}`].map(katak).join(';'))
  qatorlar.push(['+ keldi', 'K kechikdi', 'S sababli', '- kelmadi'].map(katak).join(';'))
  qatorlar.push('')
  qatorlar.push(
    ['№', 'ID', 'F.I.Sh', ...dList.map((d) => d.sana.slice(8, 10) + '.' + d.sana.slice(5, 7)), 'Kelgan', 'Darslar', 'Foiz']
      .map(katak)
      .join(';'),
  )

  oquvchilar.forEach((o, i) => {
    let kelgan = 0
    let jami = 0
    const kataklar = dList.map((d) => {
      const h = xarita.get(`${d.id}|${o.student_id}`)
      if (!h) return ''
      jami += 1
      if (h === 'keldi' || h === 'kechikdi') kelgan += 1
      return BELGI[h]
    })
    const foiz = jami ? `${Math.round((kelgan * 100) / jami)}%` : ''
    qatorlar.push(
      [i + 1, o.student_id, o.students?.fish ?? '', ...kataklar, kelgan, jami, foiz].map(katak).join(';'),
    )
  })

  const csv = '﻿' + qatorlar.join('\r\n')
  const fayl = `davomat-${g.id}-${davr}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fayl}"`,
      'Cache-Control': 'no-store',
    },
  })
}
