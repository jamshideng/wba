import Link from 'next/link'
import { talabRol, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Badge, Empty, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan, Sahifalash } from '@/components/crm'
import { IconSearch } from '@/components/icons'
import { pul, sanaQisqa, telefon } from '@/lib/format'
import { qidiruvTuri, telefonFiltri } from '@/lib/qidiruv'
import { JonliForma } from '@/components/jonli-forma'
import type { StudentStatus } from '@/lib/types'

export const metadata = { title: 'O‘quvchilar' }
export const dynamic = 'force-dynamic'

const SAHIFA_SONI = 25

type Sorov = {
  q?: string
  guruh?: string
  holat?: string
  qarz?: string
  sahifa?: string
}

type Qator = {
  id: string
  fish: string
  holat: StudentStatus
  tel: string | null
  guruhlar: string[]
  qarz: number
  qaytish: string | null
}

const HOLAT_NOMI: Record<StudentStatus, string> = {
  faol: 'Faol',
  tanaffus: 'Tanaffus',
  ketgan: 'Ketgan',
}

export default async function Oquvchilar({
  searchParams,
}: {
  searchParams: Promise<Sorov>
}) {
  // Ustozda faqat botdagi huquq: davomat, guruhlari, woblar. O'quvchi
  // profili (telefonlar, to'lovlar) — xodim ishi.
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="O‘quvchilar" />

  const s = await searchParams
  const sahifa = Math.max(1, Number(s.sahifa ?? 1) || 1)
  const boshi = (sahifa - 1) * SAHIFA_SONI
  const qidiruv = (s.q ?? '').trim()
  const qarzli = s.qarz === '1'

  const supabase = await createClient()

  /* Filtr ro'yxati uchun guruhlar. Ustozga RLS faqat o'zinikini beradi. */
  const { data: guruhlar } = await supabase
    .from('groups')
    .select('id, nom')
    .eq('holat', 'faol')
    .order('nom')

  /* ── Asosiy so'rov ──
     Qidiruv uch xil bo'ladi va uchalasi ham SERVER tomonda:
       S001      — ID
       901234567 — telefon bo'lagi (raqamlar bo'yicha)
       muslima   — ism bo'lagi                               */
  let soorov = supabase
    .from('students')
    .select(
      'id, fish, holat, qaytish_sana, ota_tel, ona_tel, shaxsiy_tel, enrollments(group_id, holat, groups(nom))',
      { count: 'exact' },
    )

  if (s.guruh) {
    soorov = supabase
      .from('students')
      .select(
        'id, fish, holat, qaytish_sana, ota_tel, ona_tel, shaxsiy_tel, enrollments!inner(group_id, holat, groups(nom))',
        { count: 'exact' },
      )
      .eq('enrollments.group_id', s.guruh)
      .neq('enrollments.holat', 'tugagan')
  }

  // Manzildan kelgan qiymatga ishonmaymiz — faqat ma'lum holatlar
  const holat = (['faol', 'tanaffus', 'ketgan'] as const).find((h) => h === s.holat)
  if (holat) soorov = soorov.eq('holat', holat)

  /* Telegram — alohida ustun emas, filtrning ichki varianti (Jamshid, 01.10):
     o'quvchi o'zi yoki ota-onasi botga ulanganmi. */
  const tg = s.holat === 'tg-ulangan' ? 'ulangan' : s.holat === 'tg-ulanmagan' ? 'ulanmagan' : null
  if (tg) {
    const { data: ulanish } = await supabase
      .from('telegram_ulanish')
      .select('student_id')
      .eq('holat', 'faol')
      .not('student_id', 'is', null)
    const tgIdlar = [...new Set((ulanish ?? []).map((u) => u.student_id as string))]
    if (tg === 'ulangan') soorov = soorov.in('id', tgIdlar.length ? tgIdlar : ['-'])
    else if (tgIdlar.length) soorov = soorov.not('id', 'in', `(${tgIdlar.map((x) => `"${x}"`).join(',')})`)
  }

  const qt = qidiruvTuri(qidiruv)
  if (qt?.turi === 'id') soorov = soorov.ilike('id', qt.naqsh)
  else if (qt?.turi === 'tel') soorov = soorov.or(telefonFiltri(qt.naqsh))
  else if (qt) soorov = soorov.ilike('fish', qt.naqsh)

  const { data: oquvchilar, count } = await soorov
    .order('fish')
    .range(boshi, boshi + SAHIFA_SONI - 1)

  type XomOquvchi = {
    id: string
    fish: string
    holat: StudentStatus
    ota_tel: string | null
    ona_tel: string | null
    shaxsiy_tel: string | null
    enrollments: { group_id: string; holat: string; groups: { nom: string } | null }[] | null
    qaytish_sana: string | null
  }

  const xom = (oquvchilar ?? []) as unknown as XomOquvchi[]
  const idlar = xom.map((o) => o.id)

  /* Qarz — hisob bazada (v_student_balance), ilovada emas. */
  const { data: balans } = idlar.length
    ? await supabase.from('v_student_balance').select('student_id, qarz').in('student_id', idlar)
    : { data: [] }

  const qarzlar = new Map(
    ((balans ?? []) as { student_id: string; qarz: number }[]).map((b) => [
      b.student_id,
      Number(b.qarz) || 0,
    ]),
  )

  let qatorlar: Qator[] = xom.map((o) => ({
    id: o.id,
    fish: o.fish,
    holat: o.holat,
    tel: o.shaxsiy_tel ?? o.ota_tel ?? o.ona_tel,
    guruhlar: (o.enrollments ?? [])
      .filter((e) => e.holat !== 'tugagan' && e.groups?.nom)
      .map((e) => e.groups!.nom),
    qarz: qarzlar.get(o.id) ?? 0,
    qaytish: o.qaytish_sana,
  }))

  /* "Qarzi borlar" — shu sahifadagilardan ajratiladi. Qarz boshqa
     jadvallardan hisoblanadi, ya'ni uni bitta so'rovda filtrlab
     bo'lmaydi; shuning uchun sahifa soni o'zgarmaydi, faqat ro'yxat
     qisqaradi. Prototip uchun shu yetadi. */
  if (qarzli) qatorlar = qatorlar.filter((q) => q.qarz > 0)

  const jami = count ?? qatorlar.length
  const pulKoradi = staffmi(profil.rol)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="O‘quvchilar"
        izoh={`${jami} ta yozuv${qidiruv ? ` · "${qidiruv}" bo‘yicha` : ''}`}
        amal={pulKoradi ? <Button href="/crm/oquvchilar/yangi">O‘quvchi qo‘shish</Button> : undefined}
      />

      {/* Jonli filtr — yozish bilan natija yangilanadi */}
      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <span className="lbl">Qidiruv</span>
          <span className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3">
            <IconSearch size={15} />
            <input
              name="q"
              type="search"
              defaultValue={qidiruv}
              autoComplete="off"
              placeholder="Ism, ID yoki telefon…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Guruh</span>
          <select
            name="guruh"
            defaultValue={s.guruh ?? ''}
            className="min-h-11 rounded-[9px] border border-line bg-surface px-3 text-[13.5px] text-ink"
          >
            <option value="">Hammasi</option>
            {(guruhlar ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Holat</span>
          <select
            name="holat"
            defaultValue={holat ?? (tg ? `tg-${tg}` : '')}
            className="min-h-11 rounded-[9px] border border-line bg-surface px-3 text-[13.5px] text-ink"
          >
            <option value="">Hammasi</option>
            <option value="faol">Faol</option>
            <option value="tanaffus">Tanaffus</option>
            <option value="ketgan">Ketgan</option>
            <optgroup label="Telegram bot">
              <option value="tg-ulangan">Botga ulangan</option>
              <option value="tg-ulanmagan">Botga ulanmagan</option>
            </optgroup>
          </select>
        </label>

        {pulKoradi && (
          <label className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3 text-[13.5px]">
            <input type="checkbox" name="qarz" value="1" defaultChecked={qarzli} className="size-4" />
            Qarzi borlar
          </label>
        )}

        {(qidiruv || s.guruh || s.holat || qarzli) && (
          <Link
            href="/crm/oquvchilar"
            className="flex min-h-11 items-center px-2 text-[13px] text-ink-3 hover:text-ink"
          >
            Tozalash
          </Link>
        )}
      </JonliForma>

      <Card className="flex flex-col">
        {qatorlar.length === 0 ? (
          <div className="p-5">
            <Empty>
              {qidiruv || s.guruh || s.holat || qarzli
                ? 'Shu shartlarga mos o‘quvchi topilmadi.'
                : 'Hali o‘quvchi yozilmagan. Ko‘chirish skripti ishga tushirilsa shu yerda ko‘rinadi.'}
            </Empty>
          </div>
        ) : (
          <>
            {/* Kompyuterda jadval sarlavhasi */}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_auto] gap-3 border-b border-line px-5 py-2.5 max-md:hidden">
              <span className="lbl">O‘quvchi</span>
              <span className="lbl">Guruhlari</span>
              <span className="lbl">Holat</span>
              {pulKoradi && <span className="lbl text-right">Qarz</span>}
            </div>

            <ul className="flex flex-col">
              {qatorlar.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/crm/oquvchilar/${q.id}`}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_auto] items-center gap-3 border-b border-line-soft px-5 py-3 transition last:border-0 hover:bg-surface-2 max-md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[13.5px] font-semibold">{q.fish}</span>
                      <span className="truncate font-[family-name:var(--font-mono)] text-[10.5px] text-ink-3">
                        {q.id}
                        {q.tel ? ` · ${telefon(q.tel)}` : ''}
                      </span>
                    </span>

                    <span className="truncate text-[12.5px] text-ink-2 max-md:hidden">
                      {q.guruhlar.length ? q.guruhlar.join(' · ') : '—'}
                    </span>

                    <span className="flex flex-col items-start gap-0.5 max-md:hidden">
                      <Badge ton={q.holat === 'faol' ? 'ok' : q.holat === 'tanaffus' ? 'accent' : 'jim'}>
                        {HOLAT_NOMI[q.holat]}
                      </Badge>
                      {q.holat === 'tanaffus' && q.qaytish && (
                        <span className="tnum text-[10.5px] text-ink-3">qaytadi {sanaQisqa(q.qaytish).slice(0, 5)}</span>
                      )}
                    </span>

                    {pulKoradi && (
                      <span
                        className={`tnum w-24 text-right font-[family-name:var(--font-mono)] text-[12.5px] ${
                          q.qarz > 0 ? 'text-brand' : 'text-ink-4'
                        }`}
                      >
                        {q.qarz > 0 ? pul(q.qarz) : '—'}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Sahifalash
        yol="/crm/oquvchilar"
        sorov={{ q: s.q, guruh: s.guruh, holat: s.holat, qarz: s.qarz }}
        sahifa={sahifa}
        jami={jami}
        soni={SAHIFA_SONI}
      />
    </div>
  )
}
