import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sana } from '@/lib/format'
import { BOT_NOMI } from '@/lib/telegram'
import { elonYuborish } from './actions'
import { elonFormadan, shaxsiyMatn, TURLAR, KIMLAR, SARLAVHA } from '@/lib/elon'
import type { Elon, ElonOluvchi, TelegramKim } from '@/lib/types'

export const metadata = { title: 'Xabarlar' }
export const dynamic = 'force-dynamic'
// Yuborish shu sahifaning server amalida bajariladi — bir necha yuz chat uchun vaqt kerak
export const maxDuration = 60

const KIM_NOMI = Object.fromEntries(KIMLAR.map((k) => [k.qiymat, k.nom])) as Record<TelegramKim, string>

/**
 * ADMIN XABARLARI — @WBAlcBot orqali o'quvchi, ota-ona, ustoz, xodimga.
 *
 * Ikki qadam: avval "Ko'rib chiqish" (GET — hech narsa yuborilmaydi):
 * kimga boradi, kim botga ulanmagan, namunaviy xabar. Keyin "Yuborish".
 * Adashib ommaviy xabar ketib qolmasin.
 */
export default async function Xabarlar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Xabarlar" />

  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) for (const x of [v].flat()) if (x != null) qs.append(k, x)
  const e = elonFormadan(qs)
  const birinchi = !qs.has('matn') && !qs.has('k')
  const tanlangan = birinchi ? (['oquvchi', 'ota_ona'] as TelegramKim[]) : e.kimga
  const korish = Boolean(e.matn && e.kimga.length)

  const supabase = await createClient()
  const [{ data: ulanish }, { data: guruhlar }, { data: tarix }, aud] = await Promise.all([
    supabase.from('telegram_ulanish').select('kim').eq('holat', 'faol'),
    supabase.from('groups').select('id, nom, subject_id, subjects(nom)').eq('holat', 'faol').order('nom'),
    supabase.from('elonlar').select('*').order('created_at', { ascending: false }).limit(15),
    korish
      ? supabase.rpc('elon_oluvchilar', { p_kimga: e.kimga, p_filtr: e.filtr })
      : Promise.resolve({ data: null, error: null }),
  ])

  const ulanganSoni = (k: TelegramKim) => (ulanish ?? []).filter((u) => u.kim === k).length
  type G = { id: string; nom: string; subject_id: string | null; subjects: { nom: string } | null }
  const gList = (guruhlar ?? []) as unknown as G[]
  const fanlar = [...new Map(gList.filter((g) => g.subject_id).map((g) => [g.subject_id!, g.subjects?.nom ?? g.subject_id!]))]
    .sort((a, b) => a[1].localeCompare(b[1], 'uz'))

  /* Ko'rib chiqish: odamlar (kim + nishon) va chatlar (yuboriladigan xabarlar) */
  const rows = ((aud.data ?? []) as ElonOluvchi[])
  const odamlar = new Map<string, { kim: TelegramKim; ism: string; ulangan: boolean }>()
  for (const r of rows) {
    const k = `${r.kim}|${r.nishon}`
    const bor = odamlar.get(k)
    odamlar.set(k, { kim: r.kim, ism: r.ism, ulangan: Boolean(bor?.ulangan || r.chat_id) })
  }
  const chatlar = new Set(rows.filter((r) => r.chat_id).map((r) => `${r.chat_id}|${r.student_id ?? ''}`))
  const ulanmagan = [...odamlar.values()].filter((o) => !o.ulangan)
  const namuna = rows.find((r) => r.chat_id) ?? rows[0]

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Xabarlar" izoh={`@${BOT_NOMI} orqali e’lon va eslatmalar`} />
      <Xabar ok={typeof sp.ok === 'string' ? sp.ok : undefined} xato={typeof sp.xato === 'string' ? sp.xato : aud.error?.message} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {KIMLAR.map((k) => (
          <Stat key={k.qiymat} label={`${k.nom} · botda`} value={ulanganSoni(k.qiymat)} sub="ulangan chat" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Yangi xabar" meta="avval ko‘rib chiqiladi" />
          <form className="flex flex-col gap-3 px-5 pb-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Maydon nom="Turi">
                <select name="turi" defaultValue={e.turi} className={kirishKlass}>
                  {TURLAR.map((t) => (
                    <option key={t.qiymat} value={t.qiymat}>{t.nom}</option>
                  ))}
                </select>
              </Maydon>
              <Maydon nom="Qaysilariga">
                <select name="f" defaultValue={e.f} className={kirishKlass}>
                  <option value="hammasi">Hammasi</option>
                  <option value="qarzdor">Faqat qarzdorlar</option>
                  {fanlar.length > 0 && (
                    <optgroup label="Fan bo‘yicha">
                      {fanlar.map(([id, nom]) => (
                        <option key={id} value={`fan:${id}`}>{nom}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Guruh bo‘yicha">
                    {gList.map((g) => (
                      <option key={g.id} value={`guruh:${g.id}`}>{g.nom}</option>
                    ))}
                  </optgroup>
                </select>
              </Maydon>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="lbl mb-1">Kimga</legend>
              <div className="flex flex-wrap gap-2">
                {KIMLAR.map((k) => (
                  <label key={k.qiymat} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[9px] border border-line px-3.5 text-[13px] has-[:checked]:border-brand has-[:checked]:text-ink">
                    <input type="checkbox" name="k" value={k.qiymat} defaultChecked={tanlangan.includes(k.qiymat)} className="accent-[var(--color-brand)]" />
                    {k.nom}
                  </label>
                ))}
              </div>
            </fieldset>

            <Maydon nom="Matn" izoh="Andozalar: {ism} — ism (ota-onaga farzandining), {qarz} — qarzi, {oy} — joriy oy">
              <textarea
                name="matn"
                required
                maxLength={3500}
                rows={6}
                defaultValue={e.matn}
                placeholder={'Hurmatli {ism}! {oy} uchun to‘lov: {qarz}. Iltimos, 10-sanagacha to‘lang.'}
                className={`${kirishKlass} min-h-36 py-2.5 leading-relaxed`}
              />
            </Maydon>

            <button type="submit" className="min-h-11 rounded-[9px] border border-line px-5 text-[13.5px] text-ink-2 hover:text-ink">
              Ko‘rib chiqish
            </button>
          </form>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Ko‘rib chiqish" meta={korish ? `${chatlar.size} ta xabar` : undefined} />
          <div className="flex flex-col gap-3 px-5 pb-5">
            {!korish ? (
              <Empty>Matn va kimga yuborilishini tanlab, “Ko‘rib chiqish” ni bosing — hech narsa yuborilmaydi.</Empty>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-ink-2">
                  {odamlar.size} kishiga mo‘ljallangan ·{' '}
                  <b className="text-ink">{chatlar.size} ta chatga yuboriladi</b>
                  {ulanmagan.length > 0 && <> · {ulanmagan.length} kishi botga ulanmagan</>}
                </p>

                {namuna && (
                  <div className="rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap">
                    <b>{SARLAVHA[e.turi]}</b>
                    {'\n\n'}
                    {shaxsiyMatn(e.matn, namuna)}
                  </div>
                )}

                <form action={elonYuborish}>
                  <input type="hidden" name="turi" value={e.turi} />
                  <input type="hidden" name="matn" value={e.matn} />
                  <input type="hidden" name="f" value={e.f} />
                  {e.kimga.map((k) => (
                    <input key={k} type="hidden" name="k" value={k} />
                  ))}
                  {chatlar.size > 0 ? (
                    <Yuborish kutish="Yuborilmoqda…">Yuborish · {chatlar.size} ta</Yuborish>
                  ) : (
                    <Empty>Tanlanganlardan hech kim botga ulanmagan.</Empty>
                  )}
                </form>

                {ulanmagan.length > 0 && (
                  <details className="text-[12.5px] text-ink-2">
                    <summary className="cursor-pointer text-ink-3">Botga ulanmaganlar ({ulanmagan.length})</summary>
                    <ul className="mt-2 flex flex-col gap-1">
                      {ulanmagan.slice(0, 60).map((o, i) => (
                        <li key={i}>{o.ism} <span className="text-ink-4">· {KIM_NOMI[o.kim].toLowerCase()}</span></li>
                      ))}
                    </ul>
                    <p className="mt-2 text-ink-3">
                      Ularga ayting: @{BOT_NOMI} da /start bosib, telefon raqamini yuborsin (yoki saytda Profil → Telegramga ulash).
                    </p>
                  </details>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Yuborilganlar" meta="oxirgi 15 ta" />
        <div className="flex flex-col px-5 pb-4">
          {!(tarix ?? []).length ? (
            <Empty>Hali xabar yuborilmagan.</Empty>
          ) : (
            ((tarix ?? []) as Elon[]).map((t) => (
              <div key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                <span className="tnum font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">{sana(t.created_at)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[12.5px]">{t.matn}</span>
                  <span className="text-[11px] text-ink-3">
                    {TURLAR.find((x) => x.qiymat === t.turi)?.nom} · {t.kimga.map((k) => KIM_NOMI[k].toLowerCase()).join(', ')}
                  </span>
                </span>
                <Badge ton={t.xato ? 'accent' : t.yetkazildi ? 'ok' : 'jim'}>
                  {t.yetkazildi}/{t.jami}{t.xato ? ` · ${t.xato} xato` : ''}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
