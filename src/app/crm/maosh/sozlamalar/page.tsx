import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, adminmi, managermi, ROL_NOMI } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { pul, joriyDavr } from '@/lib/format'
import type { XodimMaosh, MaoshTur, MaoshDoimiy } from '@/lib/types'
import { xodimOylikSaqla } from '../actions'
import { turQosh, turFaol, guruhTuriSaqla, kechikishSaqla } from './actions'

export const metadata = { title: 'Maosh sozlamalari' }
export const dynamic = 'force-dynamic'

const YOL = '/crm/maosh/sozlamalar'

/**
 * Maosh sozlamalari (Jamshid, 05.11): har ustozning stavkasi va doimiy
 * summalari (soliq va h.k. — turini shu yerda o'zi yaratadi), guruh turi
 * stavkalari, kechikish jarimasi, xodimlar oyligi. Maosh sahifasida faqat hisob.
 */
export default async function MaoshSozlamalari({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!adminmi(profil.rol)) redirect('/crm/maosh/men')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Maosh sozlamalari" />
  const s = await searchParams
  const manager = managermi(profil.rol)

  const supabase = await createClient()
  const [{ data: ustXom }, { data: stXom }, { data: turXom }, { data: dXom }, { data: sozXom }, { data: xodimXom }] =
    await Promise.all([
      supabase.from('teachers').select('id, ism').eq('holat', 'faol').order('ism'),
      supabase.from('teacher_salaries').select('teacher_id, qiymati'),
      supabase.from('maosh_turlar').select('id, nom, ishora, faol').order('id'),
      supabase.from('maosh_doimiy').select('id, teacher_id, tur_id, summa, dan, gacha'),
      supabase.from('settings').select('kalit, qiymat').in('kalit', ['maosh.guruh_turi', 'maosh.kechikish_jarima']),
      manager ? supabase.rpc('xodim_maosh', { p_davr: joriyDavr() }) : Promise.resolve({ data: [] }),
    ])

  const ustozlar = (ustXom ?? []) as { id: string; ism: string }[]
  const stavka = new Map(((stXom ?? []) as { teacher_id: string; qiymati: number }[]).map((x) => [x.teacher_id, x.qiymati]))
  const turlar = (turXom ?? []) as MaoshTur[]
  const turi = new Map(turlar.map((t) => [t.id, t]))
  const doimiy = (dXom ?? []) as MaoshDoimiy[]
  const soz = new Map(((sozXom ?? []) as { kalit: string; qiymat: unknown }[]).map((x) => [x.kalit, x.qiymat]))
  const gt = (soz.get('maosh.guruh_turi') ?? {}) as Record<string, number>
  const kech = soz.get('maosh.kechikish_jarima') as number | null | undefined
  const xodimlar = (xodimXom ?? []) as XodimMaosh[]
  const joriy = joriyDavr()

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/maosh" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        Maosh
      </Link>
      <Sarlavha nom="Maosh sozlamalari" izoh="Stavka, soliq va boshqa doimiy summalar — har ustoz alohida" />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="flex flex-col">
          <CardHeader title="Ustozlar" meta="bosib sozlang" />
          {ustozlar.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>Faol ustoz yo‘q.</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {ustozlar.map((u) => {
                const st = stavka.get(u.id)
                const ular = doimiy.filter((d) => d.teacher_id === u.id && turi.get(d.tur_id)?.faol)
                return (
                  <li key={u.id} className="border-t border-line-soft">
                    <Link
                      href={`${YOL}/${u.id}`}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-surface-2"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13.5px] font-semibold">{u.ism}</span>
                        <span className="tnum flex flex-wrap gap-x-3 text-[12px] text-ink-3">
                          <span>{st == null ? 'stavka belgilanmagan' : `stavka ${pul(st)}`}</span>
                          {ular.map((d) => {
                            const t = turi.get(d.tur_id)!
                            const amalda = d.dan <= joriy && (!d.gacha || d.gacha >= joriy)
                            return (
                              <span key={d.id} className={amalda ? (t.ishora < 0 ? 'text-brand' : 'text-ok') : 'text-ink-4'}>
                                {t.nom} {t.ishora < 0 ? '−' : '+'}
                                {pul(d.summa)}
                              </span>
                            )
                          })}
                        </span>
                      </span>
                      {st == null && <Badge>stavkasiz</Badge>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {manager && (
            <>
              <CardHeader title="Xodimlar oyligi" meta="admin · qabulxona · manager" />
              <ul className="flex flex-col">
                {xodimlar.map((x) => (
                  <li key={x.profile_id} className="flex flex-wrap items-end justify-between gap-3 border-t border-line-soft px-5 py-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold">{x.ism}</span>
                      <span className="text-[12px] text-ink-3">{ROL_NOMI[x.rol]}</span>
                    </span>
                    <form action={xodimOylikSaqla} className="flex items-end gap-2">
                      <input type="hidden" name="profile_id" value={x.profile_id} />
                      <input type="hidden" name="qaytish" value={YOL} />
                      <input
                        name="summa"
                        inputMode="numeric"
                        defaultValue={x.oylik ?? ''}
                        placeholder="Oylik"
                        aria-label={`${x.ism} oyligi`}
                        className={`${kirishKlass} w-36`}
                      />
                      <Yuborish kutish="…">Saqlash</Yuborish>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col">
            <CardHeader title="Doimiy turlar" meta="soliq va h.k." />
            <p className="px-5 pb-3 text-[12px] leading-relaxed text-ink-3">
              Turni bir marta yarating, keyin ustoz sahifasida summasini va qaysi oydan qo‘llanishini kiriting. Har oy
              maoshdan o‘zi ayiriladi (yoki qo‘shiladi) — faqat shu oyda darsi bo‘lgan ustozga.
            </p>
            {turlar.length > 0 && (
              <ul className="flex flex-col">
                {turlar.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-2.5">
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className={t.faol ? 'font-semibold' : 'text-ink-4 line-through'}>{t.nom}</span>
                      <Badge ton={t.ishora < 0 ? 'brand' : 'ok'}>{t.ishora < 0 ? 'ayiriladi' : 'qo‘shiladi'}</Badge>
                    </span>
                    <form action={turFaol}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="faol" value={t.faol ? '0' : '1'} />
                      <input type="hidden" name="qaytish" value={YOL} />
                      <Yuborish tur={t.faol ? 'xavfli' : undefined} kutish="…">
                        {t.faol ? 'O‘chirish' : 'Yoqish'}
                      </Yuborish>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={turQosh} className="flex flex-col gap-3 border-t border-line-soft px-5 py-4">
              <input type="hidden" name="qaytish" value={YOL} />
              <Maydon nom="Yangi tur nomi">
                <input name="nom" required maxLength={60} placeholder="Masalan: Soliq" className={kirishKlass} />
              </Maydon>
              <Maydon nom="Maoshga ta’siri">
                <select name="ishora" required defaultValue="-1" className={kirishKlass}>
                  <option value="-1">Ayiriladi (−)</option>
                  <option value="1">Qo‘shiladi (+)</option>
                </select>
              </Maydon>
              <Yuborish kutish="Qo‘shilmoqda…">Tur qo‘shish</Yuborish>
            </form>
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Guruh turi stavkalari" meta="1 o‘quvchi · oyiga" />
            <form action={guruhTuriSaqla} className="flex flex-col gap-3 px-5 pb-5">
              <input type="hidden" name="qaytish" value={YOL} />
              <Maydon nom="Individual">
                <input name="individual" required inputMode="numeric" defaultValue={gt.individual ?? ''} className={kirishKlass} />
              </Maydon>
              <Maydon nom="Mini guruh">
                <input name="mini" required inputMode="numeric" defaultValue={gt.mini ?? ''} className={kirishKlass} />
              </Maydon>
              <Maydon nom="IELTS">
                <input name="ielts" required inputMode="numeric" defaultValue={gt.ielts ?? ''} className={kirishKlass} />
              </Maydon>
              <p className="text-[11.5px] text-ink-3">Umumiy guruhlarda — ustozning o‘z stavkasi.</p>
              <Yuborish kutish="…">Saqlash</Yuborish>
            </form>
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Kechikish jarimasi" meta="1 daqiqa uchun" />
            <form action={kechikishSaqla} className="flex items-end gap-2 px-5 pb-5">
              <input type="hidden" name="qaytish" value={YOL} />
              <Maydon nom="So‘m" className="flex-1">
                <input name="summa" required inputMode="numeric" defaultValue={kech ?? ''} className={kirishKlass} />
              </Maydon>
              <Yuborish kutish="…">Saqlash</Yuborish>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
