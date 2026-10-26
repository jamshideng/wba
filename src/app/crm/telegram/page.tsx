import { cookies } from 'next/headers'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { Yuborish } from '@/components/yuborish'
import { NusxaTugma } from '@/components/nusxa-tugma'
import { BOT_NOMI } from '@/lib/telegram'
import { TAKLIF_COOKIE, taklifMatni, type Taklif } from '@/lib/telegram-taklif'
import { taklifOl, takliflarOl } from './actions'

export const metadata = { title: 'Telegram ulanishi' }
export const dynamic = 'force-dynamic'

/**
 * Botga ulanish (0072) — admin / qabulxona uchun.
 *
 * Har faol o'quvchi: o'zi va ota-onasi botga ulanganmi. Ulanmaganga
 * TAKLIF HAVOLASI olinadi (7 kun, bir martalik) va WhatsApp/SMS orqali
 * yuboriladi: odam bosadi → Start → ulandi. Sayt logini ham, raqam
 * mosligi ham kerak emas.
 *
 * Boshqa ikki yo'l ham ishlaydi: botga telefon raqamini yuborish
 * (bazadagi raqamga mos bo'lsa) va saytdagi "Telegramga ulash" tugmasi.
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
}

type Qidiruv = { guruh?: string; holat?: string; q?: string; ok?: string; xato?: string }

export default async function TelegramUlanishi({ searchParams }: { searchParams: Promise<Qidiruv> }) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Telegram ulanishi" />
  const s = await searchParams
  const supabase = await createClient()

  const [{ data, error }, { data: guruhlar }] = await Promise.all([
    supabase.rpc('telegram_holati'),
    supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom'),
  ])
  const hammasi = (data ?? []) as Qator[]

  // Oxirgi olingan havolalar (actions.ts → cookie, 10 daqiqa)
  const kuki = (await cookies()).get(TAKLIF_COOKIE)?.value
  let takliflar: Taklif[] = []
  try {
    takliflar = kuki ? (JSON.parse(kuki) as Taklif[]) : []
  } catch {}

  const holat = s.holat ?? 'ulanmagan'
  const q = (s.q ?? '').trim().toLowerCase()
  const royxat = hammasi.filter(
    (r) =>
      (!s.guruh || r.guruh_idlar.includes(s.guruh)) &&
      (!q || r.fish.toLowerCase().includes(q) || r.student_id.toLowerCase() === q) &&
      (holat === 'hammasi' ||
        (holat === 'ulanmagan' && r.oquvchi_ulangan + r.ota_ona_ulangan === 0) ||
        (holat === 'ulangan' && r.oquvchi_ulangan + r.ota_ona_ulangan > 0) ||
        // Kartalardan (26.10): raqam = ro'yxat
        (holat === 'ota_ona' && r.ota_ona_ulangan > 0) ||
        (holat === 'ozi' && r.oquvchi_ulangan > 0)),
  )

  const ulangan = hammasi.filter((r) => r.oquvchi_ulangan + r.ota_ona_ulangan > 0).length
  const otaOna = hammasi.filter((r) => r.ota_ona_ulangan > 0).length
  const ozi = hammasi.filter((r) => r.oquvchi_ulangan > 0).length

  const qaytish = `/crm/telegram?${new URLSearchParams(
    Object.entries({ guruh: s.guruh ?? '', holat, q: s.q ?? '' }).filter(([, v]) => v),
  ).toString()}`
  const ulanmaganlar = royxat.filter((r) => r.ota_ona_ulangan === 0)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Telegram ulanishi" izoh={`@${BOT_NOMI} · o‘quvchi va ota-onalar`} />
      <Xabar ok={s.ok} xato={s.xato ?? (error ? error.message : undefined)} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="Botda" value={`${ulangan} / ${hammasi.length}`} sub="kamida bittasi ulangan" ton="ok" href="/crm/telegram?holat=ulangan" />
        <Stat label="Ota-onasi ulangan" value={otaOna} sub="o‘quvchi" href="/crm/telegram?holat=ota_ona" />
        <Stat label="O‘zi ulangan" value={ozi} sub="o‘quvchi" href="/crm/telegram?holat=ozi" />
        <Stat label="Hech kim ulanmagan" value={hammasi.length - ulangan} sub="taklif yuboring" ton="brand" href="/crm/telegram?holat=ulanmagan" />
      </div>

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
        <Maydon nom="Holat">
          <select name="holat" defaultValue={holat} className={kirishKlass}>
            <option value="ulanmagan">Hech kim ulanmagan</option>
            <option value="ulangan">Ulangan</option>
            <option value="hammasi">Hammasi</option>
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

      <Card className="flex flex-col">
        <CardHeader title="O‘quvchilar" meta={`${royxat.length} ta`} />
        {ulanmaganlar.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
            <p className="min-w-0 flex-1 basis-64 text-[12.5px] text-ink-3">
              Ro‘yxatdagi ota-onasi ulanmaganlarning hammasiga birdaniga havola (bir martada 25 tagacha).
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
            <Empty>{holat === 'ulanmagan' ? 'Hammasi botga ulangan.' : 'Hech kim topilmadi.'}</Empty>
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge ton={r.oquvchi_ulangan ? 'ok' : 'jim'}>o‘zi {r.oquvchi_ulangan ? 'ulangan' : '—'}</Badge>
                  <Badge ton={r.ota_ona_ulangan ? 'ok' : 'jim'}>
                    ota-ona {r.ota_ona_ulangan ? `ulangan${r.ota_ona_ulangan > 1 ? ` · ${r.ota_ona_ulangan}` : ''}` : '—'}
                  </Badge>
                </div>
                <div className="flex gap-1.5">
                  {(['ota_ona', 'oquvchi'] as const).map((kim) => (
                    <form key={kim} action={taklifOl}>
                      <input type="hidden" name="student_id" value={r.student_id} />
                      <input type="hidden" name="fish" value={r.fish} />
                      <input type="hidden" name="kim" value={kim} />
                      <input type="hidden" name="qaytish" value={qaytish} />
                      <Yuborish tur="ikkilamchi" kutish="…">{kim === 'ota_ona' ? 'Ota-onaga havola' : 'O‘ziga havola'}</Yuborish>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-[12px] leading-relaxed text-ink-3">
        Yana ikki yo‘l: botga <b>/start</b> yozib telefon raqamini yuborish (raqam bazadagi ota/ona yoki o‘quvchi raqamiga mos
        bo‘lsa, o‘zi ulanadi) va o‘quvchi saytga kirganda bosh sahifadagi <b>Telegramga ulash</b> tugmasi.
      </p>
    </div>
  )
}
