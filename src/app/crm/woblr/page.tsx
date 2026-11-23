import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, getUstoz, adminmi, ustozRejimi } from '@/lib/auth'
import { woblarChegara } from '@/lib/woblar-chegara'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { WoblarBerishForma, type BerishOquvchi } from './berish-forma'
import { royxatOl, royxatVariantlari } from '@/lib/royxat'
import { WoblarLimitKartasi } from '@/components/woblar-limit'
import type { WoblarLimiti } from '@/lib/woblar-chegara'
import { guruhUstozsiz } from '@/lib/format'

export const metadata = { title: 'Woblar' }
export const dynamic = 'force-dynamic'

/**
 * Woblar berish (ustoz — o'z o'quvchisiga, admin — hammaga). Woblar odatda
 * darsda davomat bilan birga beriladi (/crm/davomat) — reytingga faqat
 * DARSDAGI woblar kiradi; bu yerda berilgani (lesson_id yo'q) kirmaydi.
 *
 * Eski "woblar balansi reytingi" (0061/0070) 0139 dan /crm/reyting bilan
 * almashtirildi. Woblar berolmaydiganlar (o'quvchi, ota-ona) o'sha yerga o'tadi.
 */
export default async function Woblr({
  searchParams,
}: {
  searchParams: Promise<{ guruh?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Woblar" />

  const ustoz = await getUstoz()
  const admin = adminmi(profil.rol)
  if (!ustoz && !admin) redirect('/crm/reyting')

  const s = await searchParams
  const supabase = await createClient()
  const sabablar = await royxatOl(supabase, 'woblar_sabab')

  // RLS: ustozga o'z guruhlari, xodimga hammasi
  const { data: guruhlar } = await supabase.from('groups').select('id, nom, teacher_id').eq('holat', 'faol').order('nom')
  const ustozIdsi = ustozRejimi(profil) ? ustoz?.id : undefined
  const berishGuruhlari = ((guruhlar ?? []) as { id: string; nom: string; teacher_id: string | null }[])
    .filter((g) => (admin && !ustozIdsi) || g.teacher_id === ustoz?.id)
    .map((g) => ({ id: g.id, nom: admin ? g.nom : guruhUstozsiz(g.nom) }))

  const { data: qatnashuvchilar } = berishGuruhlari.length
    ? await supabase
        .from('enrollments')
        .select('student_id, group_id, students(fish, holat)')
        .in('group_id', berishGuruhlari.map((g) => g.id))
        .neq('holat', 'tugagan')
    : { data: [] }

  const berishMap = new Map<string, BerishOquvchi>()
  for (const e of (qatnashuvchilar ?? []) as unknown as { student_id: string; group_id: string; students: { fish: string; holat: string } | null }[]) {
    if (e.students?.holat && e.students.holat !== 'faol') continue
    const o = berishMap.get(e.student_id) ?? { id: e.student_id, fish: e.students?.fish ?? e.student_id, guruhlar: [] }
    o.guruhlar.push(e.group_id)
    berishMap.set(e.student_id, o)
  }
  const berishOquvchilar = [...berishMap.values()].sort((a, b) => a.fish.localeCompare(b.fish, 'uz'))
  const boshGuruh = berishGuruhlari.find((g) => g.id === s.guruh)?.id ?? null

  const { data: stavka } = await supabase.from('settings').select('qiymat').eq('kalit', 'woblr.oylik_stavka').maybeSingle()

  // 0064 — ustozning oylik limiti (admin limitsiz)
  const { data: limitXom } = !admin && ustoz ? await supabase.rpc('ustoz_woblar_limiti', {}) : { data: null }
  const limit = limitXom as WoblarLimiti | null

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Woblar" izoh="woblar berish" />
      <Xabar ok={s.ok} xato={s.xato} />

      <p className="rounded-[10px] border border-line bg-surface px-4 py-3 text-[12.5px] text-ink-2">
        Reyting endi davomat, darsdagi woblar va oylik test bo‘yicha hisoblanadi —{' '}
        <Link href="/crm/reyting" className="font-semibold text-accent hover:text-brand">Reyting</Link>.
        Bu yerda berilgan woblar balansga qo‘shiladi, lekin reytingga faqat darsda (davomat ekranida) berilgani kiradi.
      </p>

      {limit && <WoblarLimitKartasi limit={limit} guruh={null} kim="Sizning woblar limitingiz" />}

      {berishGuruhlari.length > 0 ? (
        <Card className="flex flex-col">
          <CardHeader title="Woblar berish" meta={admin ? 'barcha o‘quvchilar' : 'faqat o‘z o‘quvchilaringiz'} />
          <WoblarBerishForma
            sabablar={royxatVariantlari(sabablar)}
            guruhlar={berishGuruhlari}
            oquvchilar={berishOquvchilar}
            boshGuruh={boshGuruh}
            chegara={woblarChegara()}
            admin={admin}
            qaytish="/crm/woblr"
            limit={limit ? { jami: limit.jami.qoldi, guruhlar: Object.fromEntries(limit.guruhlar.map((x) => [x.group_id, x.qoldi])) } : null}
          />
        </Card>
      ) : (
        <Empty>Faol guruh yo‘q.</Empty>
      )}

      <p className="text-[12px] text-ink-3">
        Ustozning oylik limiti: darslar × o‘quvchilar × {stavka?.qiymat != null ? String(stavka.qiymat) : '3'} (bir darsda bitta bolaga).
        Xohlasa bir kunda, xohlasa bo‘lib beradi; minus woblar limitga qaytadi. Admin — limitsiz.
      </p>
    </div>
  )
}
