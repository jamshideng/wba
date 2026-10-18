import Link from 'next/link'
import { talabRol, getUstoz, staffmi, ustozRejimi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty, Button } from '@/components/ui'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconAttendance } from '@/components/icons'
import { sana, vaqt, jadval, bugunToshkent, joriyDavr, guruhQisqa, guruhUstozsiz } from '@/lib/format'
import type { BugungiDars } from '@/lib/types'

export const metadata = { title: 'Davomat' }
export const dynamic = 'force-dynamic'

export default async function Davomat({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const xabar = await searchParams
  const profil = await talabRol('admin', 'direktor', 'qabulxona', 'ustoz')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Davomat" />

  const ustoz = await getUstoz()
  const supabase = await createClient()
  const bugun = bugunToshkent()

  /* v_bugungi_darslar security_invoker — ustozga faqat o'z guruhlari
     ko'rinadi, adminga hammasi. */
  const { data: darslar } = await supabase
    .from('v_bugungi_darslar')
    .select('*')
    .order('boshlanish')

  /* Xodim "Ustoz" rolida (rol-holat.ts): RLS hammasini beradi — o'zinikiga cheklaymiz */
  const dList = ((darslar ?? []) as unknown as BugungiDars[]).filter(
    (d) => !ustozRejimi(profil) || d.teacher_id === ustoz?.id || d.zamena_teacher_id === ustoz?.id,
  )

  // Oylik eksport uchun — RLS ustozga faqat o'z guruhlarini beradi
  const { data: guruhlar } = await supabase
    .from('groups')
    .select('id, nom, boshlanish, tugash, kunlar, teacher_id')
    .eq('holat', 'faol')
    .order('nom')
  // Bugungi zamena guruhi (0075) "Guruhlarim" ro'yxatiga kirmaydi — u faqat yuqorida
  const gList = ((guruhlar ?? []) as { id: string; nom: string; boshlanish: string; tugash: string; kunlar: number[]; teacher_id: string | null }[])
    .filter((g) => staffmi(profil.rol) || !ustoz || g.teacher_id === ustoz.id)

  /* Ustoz faqat o'z guruhlarini ko'radi — nomdagi o'z ismi va vaqt ortiqcha,
     telefonda "Beginner · Komila Bo…" bo'lib kesilardi. Xodimga to'liq nom. */
  const ozimniki = !staffmi(profil.rol)

  /* 0082 — o'rinbosar sifatida kelgusi darslarim (jurnal o'sha kuni ochiladi) */
  const { data: zXom } = ustoz ? await supabase.rpc('mening_zamenalarim') : { data: [] }
  const zamenalarim = (zXom ?? []) as { sana: string; group_id: string; guruh: string; boshlanish: string; tugash: string; kimning_orniga: string | null; sabab: string | null }[]

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Bugungi darslar"
        izoh={`${sana(bugun)}${ustoz ? ` · ${ustoz.ism}` : ''}`}
        amal={
          staffmi(profil.rol) ? (
            <Button href="/crm/davomat/umumiy" variant="ikkilamchi">
              Umumiy davomat
            </Button>
          ) : undefined
        }
      />

      <Xabar ok={xabar.ok} xato={xabar.xato === 'huquq' ? 'Bu bo‘lim sizga ochiq emas.' : xabar.xato} />

      {zamenalarim.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Zamenalarim" meta={`${zamenalarim.length} ta dars`} />
          <ul className="flex flex-col">
            {zamenalarim.map((z) => (
              <li key={`${z.group_id}-${z.sana}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold">
                    {sana(z.sana)} · {vaqt(z.boshlanish)}–{vaqt(z.tugash)}
                  </span>
                  <span className="truncate text-[12px] text-ink-2">
                    {guruhUstozsiz(z.guruh)} — {z.kimning_orniga ?? 'ustoz'} o‘rniga{z.sabab ? ` · ${z.sabab}` : ''}
                  </span>
                </span>
                {z.sana === bugun ? (
                  <Button href={`/crm/davomat/${z.group_id}`}>Jurnal</Button>
                ) : (
                  <Badge ton="jim">jurnal {sana(z.sana)} kuni ochiladi</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dList.length === 0 ? (
        <Card className="p-5">
          <Empty>
            Bugun dars yo‘q.
            {ustoz
              ? ' Guruhingiz jadvali boshqa kunga to‘g‘ri kelsa, o‘sha kuni shu yerda chiqadi.'
              : ' Bugunga to‘g‘ri keladigan faol guruh topilmadi.'}
          </Empty>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {dList.map((d) => (
            <li key={d.group_id}>
              <Link
                href={`/crm/davomat/${d.group_id}`}
                className="flex items-center gap-4 rounded-[12px] border border-line bg-surface px-4 py-3.5 transition hover:border-ink-3"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-brand">
                  <IconAttendance size={19} />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[14px] font-semibold">{ozimniki ? guruhQisqa(d.nom) : d.nom}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                    {vaqt(d.boshlanish)}–{vaqt(d.tugash)} · {d.oquvchilar} o‘quvchi
                  </span>
                  {d.zamena_teacher_id && (
                    <span className="text-[11.5px] font-semibold text-accent">
                      {ustoz && d.zamena_teacher_id === ustoz.id ? 'Zamena — bugun siz o‘tasiz' : `Zamena — ${d.zamena_ism ?? ''}`}
                    </span>
                  )}
                </span>

                <Badge ton={d.belgilangan ? 'ok' : 'accent'} nuqta>
                  {d.belgilangan ? 'belgilangan' : 'kutilmoqda'}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {gList.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title={staffmi(profil.rol) ? 'Barcha guruhlar — jurnal' : 'Guruhlarim — jurnal'} meta={`${gList.length} ta guruh`} />
          <ul className="flex flex-col gap-1.5 px-3 pb-3">
            {gList.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/crm/davomat/${g.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-[9px] bg-surface-2 px-3 py-2 transition hover:bg-line-soft hover:ring-1 hover:ring-line"
                >
                  <span className="min-w-0 truncate text-[13.5px] font-semibold">{ozimniki ? guruhQisqa(g.nom) : g.nom}</span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                    {jadval(g.boshlanish, g.tugash, g.kunlar)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {gList.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Oylik davomat (Excel)" meta="Excel ochadigan fayl" />
          <form action="/crm/davomat/eksport" className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <Maydon nom="Guruh">
              <select name="guruh" required className={kirishKlass}>
                {gList.map((g) => (
                  <option key={g.id} value={g.id}>{ozimniki ? guruhUstozsiz(g.nom) : g.nom}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Oy">
              <input type="month" name="davr" required defaultValue={joriyDavr()} className={kirishKlass} />
            </Maydon>
            <button type="submit" className="min-h-11 rounded-[9px] border border-line px-5 text-[13.5px] text-ink-2 transition hover:border-ink-3 hover:text-ink">
              Yuklab olish
            </button>
          </form>
        </Card>
      )}
    </div>
  )
}
