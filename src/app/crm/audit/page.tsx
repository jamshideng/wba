import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan, Sahifalash } from '@/components/crm'
import { kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { auditFarqi, qiymatMatni, AMAL_NOMI, JADVAL_NOMI, WOBLR_SABAB } from '@/lib/audit'

export const metadata = { title: 'Audit' }
export const dynamic = 'force-dynamic'

const SAHIFA_SONI = 40

type Yozuv = {
  id: number
  amal: string
  jadval: string
  obyekt_id: string | null
  eski: unknown
  yangi: unknown
  created_at: string
  profiles: { ism: string } | null
}

/** Obyektga havola — CRM'da sahifasi borlari uchun. */
function havola(jadval: string, id: string | null, yangi: unknown, eski: unknown): string | null {
  if (!id) return null
  const q = (yangi ?? eski) as Record<string, unknown> | null
  if (jadval === 'students') return `/crm/oquvchilar/${id}`
  if (jadval === 'groups') return `/crm/guruhlar/${id}`
  const sid = q?.student_id
  if (typeof sid === 'string' && ['payments', 'enrollments', 'woblr'].includes(jadval)) return `/crm/oquvchilar/${sid}`
  return null
}

const vaqtFmt = new Intl.DateTimeFormat('uz-UZ', {
  timeZone: 'Asia/Tashkent',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Audit jurnali (LevelUp "Audit" bo'limi o'rni): kim, qachon, nimani
 * o'zgartirdi. Faqat admin va direktor ko'radi (audit_admin_read).
 * Yozuvlar trigger orqali avtomatik tushadi — bu sahifa faqat o'qiydi.
 */
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ jadval?: string; amal?: string; sana?: string; id?: string; sahifa?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Audit" />

  const s = await searchParams
  const jadval = s.jadval && s.jadval in JADVAL_NOMI ? s.jadval : ''
  const amal = s.amal && s.amal in AMAL_NOMI ? s.amal : ''
  const sana = /^\d{4}-\d{2}-\d{2}$/.test(s.sana ?? '') ? s.sana! : ''
  const obyekt = (s.id ?? '').trim().slice(0, 40)
  const sahifa = Math.max(1, Number(s.sahifa ?? 1) || 1)
  const boshi = (sahifa - 1) * SAHIFA_SONI

  const supabase = await createClient()
  let sorov = supabase
    .from('audit_log')
    .select('id, amal, jadval, obyekt_id, eski, yangi, created_at, profiles(ism)', { count: 'exact' })
  if (jadval) sorov = sorov.eq('jadval', jadval)
  if (amal) sorov = sorov.eq('amal', amal)
  if (obyekt) sorov = sorov.eq('obyekt_id', obyekt)
  if (sana) {
    // Toshkent kuni (UTC+5) — o'sha kunning 00:00 dan keyingi kunning 00:00 gacha
    const dan = new Date(`${sana}T00:00:00+05:00`)
    const gacha = new Date(dan.getTime() + 24 * 3600 * 1000)
    sorov = sorov.gte('created_at', dan.toISOString()).lt('created_at', gacha.toISOString())
  }

  const { data, count } = await sorov
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(boshi, boshi + SAHIFA_SONI - 1)

  const yozuvlar = (data ?? []) as unknown as Yozuv[]

  // Woblar yozuvlari uchun ustoz va o'quvchi ismlari — "U02 → S004" emas, odam o'qiydigan qilib
  const woblrQator = (y: Yozuv) => ((y.yangi ?? y.eski) as Record<string, unknown> | null) ?? {}
  const woblarlar = yozuvlar.filter((y) => y.jadval === 'woblr').map(woblrQator)
  const idlar = (k: string) => [...new Set(woblarlar.map((q) => q[k]).filter((v): v is string => typeof v === 'string'))]
  const [ustozlar, oquvchilar] = woblarlar.length
    ? await Promise.all([
        supabase.from('teachers').select('id, ism').in('id', idlar('teacher_id')),
        supabase.from('students').select('id, fish').in('id', idlar('student_id')),
      ])
    : [{ data: [] }, { data: [] }]
  const ustozIsm = new Map((ustozlar.data ?? []).map((u) => [u.id as string, u.ism as string]))
  const oquvchiIsm = new Map((oquvchilar.data ?? []).map((o) => [o.id as string, o.fish as string]))
  const woblrMatn = (y: Yozuv): string => {
    const q = woblrQator(y)
    const ball = Number(q.ball ?? 0)
    const ustoz = typeof q.teacher_id === 'string' ? (ustozIsm.get(q.teacher_id) ?? q.teacher_id) : (y.profiles?.ism ?? 'admin')
    const oquvchi = typeof q.student_id === 'string' ? `${oquvchiIsm.get(q.student_id) ?? ''} (${q.student_id})`.trim() : '—'
    const sabab = WOBLR_SABAB[String(q.sabab)] ?? String(q.sabab ?? '')
    const izoh = q.izoh ? ` · ${q.izoh}` : ''
    const fel = y.amal === 'DELETE' ? 'yozuvi o‘chirildi' : ball > 0 ? 'berdi' : 'ayirdi'
    return `${ustoz} → ${oquvchi}: ${ball > 0 ? '+' : ''}${ball} woblar ${fel} · ${sabab}${izoh}`
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Audit" izoh={`${count ?? 0} ta yozuv · kim, qachon, nimani o‘zgartirdi`} />

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Bo‘lim</span>
          <select name="jadval" defaultValue={jadval} className={kirishKlass}>
            <option value="">Hammasi</option>
            {Object.entries(JADVAL_NOMI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Amal</span>
          <select name="amal" defaultValue={amal} className={kirishKlass}>
            <option value="">Hammasi</option>
            {Object.entries(AMAL_NOMI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Kun</span>
          <input type="date" name="sana" defaultValue={sana} className={kirishKlass} />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[200px]">
          <span className="lbl">ID</span>
          <input name="id" defaultValue={obyekt} placeholder="S004, G05, 123…" className={kirishKlass} />
        </label>
      </JonliForma>

      <Card className="flex flex-col">
        {yozuvlar.length === 0 ? (
          <div className="p-5">
            <Empty>Shu shartlarga mos yozuv yo‘q.</Empty>
          </div>
        ) : (
          <ul className="flex flex-col">
            {yozuvlar.map((y) => {
              const farq = auditFarqi(y.eski, y.yangi).slice(0, 8)
              const h = havola(y.jadval, y.obyekt_id, y.yangi, y.eski)
              return (
                <li key={y.id} className="flex flex-col gap-2 border-b border-line-soft px-5 py-3.5 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <Badge ton={y.amal === 'DELETE' ? 'brand' : y.amal === 'INSERT' ? 'ok' : 'accent'}>
                        {AMAL_NOMI[y.amal] ?? y.amal}
                      </Badge>
                      <b>{JADVAL_NOMI[y.jadval] ?? y.jadval}</b>
                      {y.obyekt_id &&
                        (h ? (
                          <Link href={h} className="font-[family-name:var(--font-mono)] text-[12px] text-brand hover:underline">
                            {y.obyekt_id}
                          </Link>
                        ) : (
                          <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3">{y.obyekt_id}</span>
                        ))}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                      {vaqtFmt.format(new Date(y.created_at))} · {y.profiles?.ism ?? 'tizim'}
                    </span>
                  </div>
                  {y.jadval === 'woblr' && <p className="text-[13px]">{woblrMatn(y)}</p>}
                  {farq.length > 0 && y.amal === 'UPDATE' && (
                    <ul className="flex flex-col gap-0.5 text-[12px]">
                      {farq.map((f) => (
                        <li key={f.maydon} className="flex flex-wrap gap-1.5">
                          <span className="text-ink-3">{f.maydon}:</span>
                          <span className="text-ink-4 line-through">{qiymatMatni(f.eski)}</span>
                          <span>→ {qiymatMatni(f.yangi)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {farq.length > 0 && y.amal !== 'UPDATE' && y.jadval !== 'woblr' && (
                    <p className="text-[12px] text-ink-3">
                      {farq
                        .filter((f) => f.maydon !== 'id')
                        .map((f) => `${f.maydon}: ${qiymatMatni(y.amal === 'DELETE' ? f.eski : f.yangi)}`)
                        .join(' · ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Sahifalash
        yol="/crm/audit"
        sorov={{ jadval, amal, sana, id: obyekt }}
        sahifa={sahifa}
        jami={count ?? 0}
        soni={SAHIFA_SONI}
      />
    </div>
  )
}
