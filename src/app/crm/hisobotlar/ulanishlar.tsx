import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, Stat, Badge, Empty } from '@/components/ui'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { Yuborish } from '@/components/yuborish'
import { NusxaTugma } from '@/components/nusxa-tugma'
import { BOT_NOMI } from '@/lib/telegram'
import { sanaQisqa } from '@/lib/format'
import { TAKLIF_COOKIE, taklifMatni, type Taklif } from '@/lib/telegram-taklif'
import { taklifOl, takliflarOl } from '../telegram/actions'
import { IlovaBolimi } from './bolimlar'
import type { HisobotIlova } from '@/lib/types'

/**
 * Hisobotlar › Ulanishlar (0121, Jamshid 08.11).
 *
 * Har faol o'quvchi — o'zi va ota-onasi: profilga kirganmi, ilovani
 * o'rnatganmi, Telegram botga ulanganmi. Eski "Telegram ulanishi"
 * sahifasi (0072) shu yerga ko'chdi: taklif havolalari ham shu yerda.
 */

type Qator = {
  student_id: string
  fish: string
  guruhlar: string | null
  guruh_idlar: string[]
  oquvchi_ulangan: number
  ota_ona_ulangan: number
  shaxsiy_tel: boolean
  ota_ona_tel: boolean
  login_bor: boolean
  ota_ona_hisob: boolean
  oquvchi_kirgan: string | null
  ota_ona_kirgan: string | null
  oquvchi_ilova: boolean
  ota_ona_ilova: boolean
}

export type UlanishQidiruv = {
  kim?: string; profil?: string; kirish?: string; ilova?: string; bot?: string
  guruh?: string; q?: string; ok?: string; xato?: string
}

/** Bitta tomon (o'zi yoki ota-ona) holati */
function tomon(r: Qator, kim: 'oquvchi' | 'ota_ona') {
  return kim === 'ota_ona'
    ? { hisob: r.ota_ona_hisob, kirgan: r.ota_ona_kirgan, ilova: r.ota_ona_ilova, tg: r.ota_ona_ulangan }
    : { hisob: r.login_bor, kirgan: r.oquvchi_kirgan, ilova: r.oquvchi_ilova, tg: r.oquvchi_ulangan }
}

/** Filtrlar — har biri alohida, birgalikda ishlaydi */
const tanlov = <T extends string>(v: string | undefined, ruxsat: readonly T[]): T | null =>
  (ruxsat as readonly string[]).includes(v ?? '') ? (v as T) : null
const PROFIL = ['kirgan', 'kirmagan', 'hisob_yoq'] as const
const KIRISH = ['7', '30', 'eski'] as const
const BOR = ['bor', 'yoq'] as const

const YOL = '/crm/hisobotlar'

export async function UlanishlarBolimi({ s }: { s: UlanishQidiruv }) {
  const supabase = await createClient()
  const [{ data, error }, { data: guruhlar }, { data: ilova }] = await Promise.all([
    supabase.rpc('ulanishlar_holati'),
    supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom'),
    supabase.rpc('hisobot_ilova'),
  ])
  const hammasi = (data ?? []) as unknown as Qator[]

  // Oxirgi olingan taklif havolalari (telegram/actions.ts → cookie, 10 daqiqa)
  const kuki = (await cookies()).get(TAKLIF_COOKIE)?.value
  let takliflar: Taklif[] = []
  try {
    takliflar = kuki ? (JSON.parse(kuki) as Taklif[]) : []
  } catch {}

  const kim: 'oquvchi' | 'ota_ona' = s.kim === 'oquvchi' ? 'oquvchi' : 'ota_ona'
  const profil = tanlov(s.profil, PROFIL)
  const kirish = tanlov(s.kirish, KIRISH)
  const ilovaF = tanlov(s.ilova, BOR)
  const bot = tanlov(s.bot, BOR)
  const q = (s.q ?? '').trim().toLowerCase()
  const hozir = Date.now()
  const kunOldin = (t: string) => (hozir - new Date(t).getTime()) / 86_400_000
  const royxat = hammasi.filter((r) => {
    const t = tomon(r, kim)
    return (
      (!s.guruh || r.guruh_idlar.includes(s.guruh)) &&
      (!q || r.fish.toLowerCase().includes(q) || r.student_id.toLowerCase() === q) &&
      (!profil || (profil === 'kirgan' ? !!t.kirgan : profil === 'kirmagan' ? t.hisob && !t.kirgan : !t.hisob)) &&
      (!kirish || (!!t.kirgan && (kirish === 'eski' ? kunOldin(t.kirgan) > 30 : kunOldin(t.kirgan) <= Number(kirish)))) &&
      (!ilovaF || (ilovaF === 'bor') === t.ilova) &&
      (!bot || (bot === 'bor') === t.tg > 0)
    )
  })
  const filtrda = !!(profil || kirish || ilovaF || bot || s.guruh || q)

  const qs = (o: Record<string, string>) => `${YOL}?${new URLSearchParams({ bolim: 'ulanishlar', ...o }).toString()}`
  const qaytish = qs(
    Object.fromEntries(
      Object.entries({ kim, profil: profil ?? '', kirish: kirish ?? '', ilova: ilovaF ?? '', bot: bot ?? '', guruh: s.guruh ?? '', q: s.q ?? '' }).filter(([, v]) => v),
    ),
  )
  const ulanmaganlar = royxat.filter((r) => r.ota_ona_ulangan === 0)

  const sanoq = (k: 'oquvchi' | 'ota_ona') => {
    const t = hammasi.map((r) => tomon(r, k))
    return {
      hisob: t.filter((x) => x.hisob).length,
      kirgan: t.filter((x) => x.kirgan).length,
      kirmagan: t.filter((x) => x.hisob && !x.kirgan).length,
      ilova: t.filter((x) => x.ilova).length,
      tg: t.filter((x) => x.tg > 0).length,
    }
  }
  const qatorlar = [
    { k: 'ota_ona' as const, nom: 'Ota-onalar', n: sanoq('ota_ona') },
    { k: 'oquvchi' as const, nom: 'O‘quvchilar (o‘zi)', n: sanoq('oquvchi') },
  ]

  const kirishBelgi = (hisob: boolean, kirgan: string | null) =>
    !hisob ? <Badge>profil yo‘q</Badge> : kirgan ? <Badge ton="ok">kirgan · {sanaQisqa(kirgan.slice(0, 10))}</Badge> : <Badge ton="brand">kirmagan</Badge>

  return (
    <>
      <Xabar ok={s.ok} xato={s.xato ?? (error ? error.message : undefined)} />

      {qatorlar.map(({ k, nom, n }) => (
        <section key={k} className="flex flex-col gap-2">
          <span className="lbl">{nom} · {hammasi.length} ta faol o‘quvchi</span>
          <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            <Stat label="Profilga kirgan" value={`${n.kirgan} / ${n.hisob}`} sub="hisobi borlardan" ton="ok" href={qs({ kim: k, profil: 'kirgan' })} />
            <Stat label="Kirmagan" value={n.kirmagan} sub="hisobi bor, hali kirmagan" ton="brand" href={qs({ kim: k, profil: 'kirmagan' })} />
            <Stat label="Ilova o‘rnatgan" value={n.ilova} sub="telefon ekraniga" href={qs({ kim: k, ilova: 'bor' })} />
            <Stat label="Botga ulangan" value={`${n.tg} / ${hammasi.length}`} sub={`@${BOT_NOMI}`} href={qs({ kim: k, bot: 'bor' })} />
          </div>
        </section>
      ))}

      {takliflar.length > 0 && (
        <Card className="flex flex-col border-accent-line">
          <CardHeader title="Taklif havolalari" meta={`${takliflar.length} ta`} />
          <div className="flex flex-wrap items-center gap-3 px-5">
            <p className="min-w-0 flex-1 basis-64 text-[12.5px] text-ink-3">
              Har havola 7 kun amal qiladi va <b>bir marta</b> ishlaydi. WhatsApp yoki SMS bilan yuboring — odam bosadi, botda
              <b> Start</b> ni bosadi va ulanadi.
            </p>
            {takliflar.length > 1 && <NusxaTugma matn={takliflar.map(taklifMatni).join('\n\n')} nom="Hammasini nusxalash" />}
          </div>
          <ul className="mt-2">
            {takliflar.map((t) => (
              <li key={t.havola} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">
                    {t.fish} <span className="text-[12px] font-normal text-ink-3">· {t.kim === 'ota_ona' ? 'ota-onasi uchun' : 'o‘zi uchun'}</span>
                  </div>
                  <div className="truncate font-[family-name:var(--font-mono)] text-[12px] text-ink-3">{t.havola}</div>
                </div>
                <NusxaTugma matn={taklifMatni(t)} nom="Matn" />
                <NusxaTugma matn={t.havola} nom="Havola" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <input type="hidden" name="bolim" value="ulanishlar" />
        <Maydon nom="Kim">
          <select name="kim" defaultValue={kim} className={kirishKlass}>
            <option value="ota_ona">Ota-ona</option>
            <option value="oquvchi">O‘quvchi (o‘zi)</option>
          </select>
        </Maydon>
        <Maydon nom="Profil">
          <select name="profil" defaultValue={profil ?? ''} className={kirishKlass}>
            <option value="">Hammasi</option>
            <option value="kirgan">Kirgan</option>
            <option value="kirmagan">Hisobi bor, kirmagan</option>
            <option value="hisob_yoq">Hisobi yo‘q</option>
          </select>
        </Maydon>
        <Maydon nom="Oxirgi kirish">
          <select name="kirish" defaultValue={kirish ?? ''} className={kirishKlass}>
            <option value="">Farqi yo‘q</option>
            <option value="7">Oxirgi 7 kunda</option>
            <option value="30">Oxirgi 30 kunda</option>
            <option value="eski">30 kundan oldin</option>
          </select>
        </Maydon>
        <Maydon nom="Ilova">
          <select name="ilova" defaultValue={ilovaF ?? ''} className={kirishKlass}>
            <option value="">Hammasi</option>
            <option value="bor">O‘rnatgan</option>
            <option value="yoq">O‘rnatmagan</option>
          </select>
        </Maydon>
        <Maydon nom="Telegram bot">
          <select name="bot" defaultValue={bot ?? ''} className={kirishKlass}>
            <option value="">Hammasi</option>
            <option value="bor">Ulangan</option>
            <option value="yoq">Ulanmagan</option>
          </select>
        </Maydon>
        <Maydon nom="Guruh">
          <select name="guruh" defaultValue={s.guruh ?? ''} className={kirishKlass}>
            <option value="">Hammasi</option>
            {((guruhlar ?? []) as { id: string; nom: string }[]).map((g) => (
              <option key={g.id} value={g.id}>{g.nom}</option>
            ))}
          </select>
        </Maydon>
        <Maydon nom="Qidiruv">
          <input name="q" defaultValue={s.q ?? ''} placeholder="Ism yoki ID" className={kirishKlass} />
        </Maydon>
      </JonliForma>
      {filtrda && (
        <a href={qs({ kim })} className="-mt-2 self-start text-[12px] text-ink-3 hover:text-ink">
          Filtrni tozalash ×
        </a>
      )}

      <Card className="flex flex-col">
        <CardHeader title="O‘quvchilar" meta={`${royxat.length} ta · filtr ${kim === 'ota_ona' ? 'ota-ona' : 'o‘quvchi'} bo‘yicha`} />
        {ulanmaganlar.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
            <p className="min-w-0 flex-1 basis-64 text-[12.5px] text-ink-3">
              Ro‘yxatdagi ota-onasi botga ulanmaganlarning hammasiga birdaniga havola (bir martada 25 tagacha).
            </p>
            <form action={takliflarOl}>
              <input type="hidden" name="kim" value="ota_ona" />
              <input type="hidden" name="qaytish" value={qaytish} />
              <input type="hidden" name="idlar" value={ulanmaganlar.slice(0, 25).map((r) => r.student_id).join(',')} />
              <input type="hidden" name="nomlar" value={ulanmaganlar.slice(0, 25).map((r) => `${r.student_id}\t${r.fish}`).join('\n')} />
              <Yuborish tur="ikkilamchi" kutish="Tayyorlanmoqda…">
                {`Ota-onalarga havola (${Math.min(ulanmaganlar.length, 25)} ta)`}
              </Yuborish>
            </form>
          </div>
        )}
        {royxat.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Hech kim topilmadi.</Empty>
          </div>
        ) : (
          <ul>
            {royxat.map((r) => (
              <li key={r.student_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft px-5 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="truncate text-[13.5px] font-semibold">
                    {r.fish} <span className="text-[12px] font-normal text-ink-3">· {r.student_id}</span>
                  </div>
                  <div className="truncate text-[12px] text-ink-3">{r.guruhlar ?? 'guruhsiz'}</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {(['ota_ona', 'oquvchi'] as const).map((k) => {
                    const t = tomon(r, k)
                    return (
                      <div key={k} className="flex flex-wrap items-center gap-1.5">
                        <span className="w-16 text-[12px] text-ink-3">{k === 'ota_ona' ? 'ota-ona' : 'o‘zi'}</span>
                        {kirishBelgi(t.hisob, t.kirgan)}
                        <Badge ton={t.ilova ? 'ok' : 'jim'}>ilova {t.ilova ? 'bor' : '—'}</Badge>
                        <Badge ton={t.tg ? 'ok' : 'jim'}>bot {t.tg ? `ulangan${t.tg > 1 ? ` · ${t.tg}` : ''}` : '—'}</Badge>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-1.5">
                  {(['ota_ona', 'oquvchi'] as const).map((k) => (
                    <form key={k} action={taklifOl}>
                      <input type="hidden" name="student_id" value={r.student_id} />
                      <input type="hidden" name="fish" value={r.fish} />
                      <input type="hidden" name="kim" value={k} />
                      <input type="hidden" name="qaytish" value={qaytish} />
                      <Yuborish tur="ikkilamchi" kutish="…">{k === 'ota_ona' ? 'Ota-onaga bot havolasi' : 'O‘ziga bot havolasi'}</Yuborish>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ilova && <IlovaBolimi i={ilova as HisobotIlova} />}

      <p className="text-[12px] leading-relaxed text-ink-3">
        <b>Profilga kirgan</b> — saytga yoki ilovaga o‘z logini bilan kamida bir marta kirgan (Supabase kirish vaqti; 08.11 dan
        boshlab har kungi ochish ham sanaladi). Botga ulanishning yana ikki yo‘li: botga <b>/start</b> yozib telefon raqamini
        yuborish (raqam bazadagiga mos bo‘lsa, o‘zi ulanadi) va saytdagi <b>Telegramga ulash</b> tugmasi.
      </p>
    </>
  )
}
