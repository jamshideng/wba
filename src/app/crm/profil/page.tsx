import { talabProfil, getUstoz, ROL_NOMI, staffmi } from '@/lib/auth'
import { BOT_NOMI } from '@/lib/telegram'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { loginNomi, LOGIN_QOIDASI } from '@/lib/login'
import { ismOzgartir, loginOzgartir, parolOzgartir, telegramUlash } from './actions'

export const metadata = { title: 'Profil' }
export const dynamic = 'force-dynamic'

/**
 * Har bir panelda: o'z ismi, logini va paroli.
 *
 * O'quvchi va ota-onaga faqat "Telegramga ulash" (0032): ism, login, parolni
 * admin o'quvchi profilidan o'zgartiradi. Xodim, ustoz va ota-ona
 * o'zinikini o'zi almashtiradi.
 */
export default async function Profil({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const men = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Profil" />

  const xabar = await searchParams
  const faqatTelegram = men.rol === 'oquvchi' || men.rol === 'ota_ona'
  const ustoz = await getUstoz()
  const supabase = await createClient()
  const { data: oquvchi } =
    men.rol === 'oquvchi'
      ? await supabase.from('students').select('id, fish').eq('profile_id', men.id).maybeSingle()
      : { data: null }

  /* Telegramga ulanganmi. Xodimga RLS hammaning ulanishini beradi —
     shuning uchun unga faqat o'ziniki (profil yoki ustoz yozuvi) filtrlanadi. */
  let tgSorov = supabase.from('telegram_ulanish').select('id', { count: 'exact', head: true }).eq('holat', 'faol')
  if (staffmi(men.rol)) tgSorov = tgSorov.or(`profile_id.eq.${men.id}${ustoz ? `,teacher_id.eq.${ustoz.id}` : ''}`)
  const { count: tgSoni } = await tgSorov

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Profil"
        izoh={[ROL_NOMI[men.rol], ustoz ? `ustoz ${ustoz.id}` : null, oquvchi ? oquvchi.id : null].filter(Boolean).join(' · ')}
        amal={<Badge ton="brand">{loginNomi(men.email)}</Badge>}
      />
      <Xabar ok={xabar.ok} xato={xabar.xato} />

      {!faqatTelegram && (
        <>
          <Card className="flex flex-col">
            <CardHeader title="Ism familya" />
            <form action={ismOzgartir} className="flex flex-col gap-3 px-5 pb-5">
              <Maydon
                nom="Ism familya"
                izoh={
                  oquvchi || ustoz
                    ? 'Tizimda ko‘rinadigan ismingiz. Markaz hujjatlaridagi ism (jurnal, to‘lovlar) admin tomonidan yuritiladi.'
                    : undefined
                }
              >
                <input name="ism" required minLength={3} defaultValue={men.ism} className={kirishKlass} />
              </Maydon>
              <Yuborish tur="ikkilamchi">Ismni saqlash</Yuborish>
            </form>
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Login" meta={`hozirgi: ${loginNomi(men.email)}`} />
            <form action={loginOzgartir} className="flex flex-col gap-3 px-5 pb-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Maydon nom="Yangi login" izoh={LOGIN_QOIDASI}>
                  <input name="login" required autoComplete="username" placeholder="masalan: aziza" className={kirishKlass} />
                </Maydon>
                <Maydon nom="Joriy parol" izoh="Tasdiqlash uchun">
                  <input name="joriy_parol" type="password" required autoComplete="current-password" className={kirishKlass} />
                </Maydon>
              </div>
              <Yuborish tur="ikkilamchi">Loginni almashtirish</Yuborish>
            </form>
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Parol" />
            <form action={parolOzgartir} className="flex flex-col gap-3 px-5 pb-5">
              <Maydon nom="Joriy parol">
                <input name="joriy_parol" type="password" required autoComplete="current-password" className={kirishKlass} />
              </Maydon>
              <div className="grid gap-3 sm:grid-cols-2">
                <Maydon nom="Yangi parol" izoh="Kamida 8 belgi">
                  <input name="yangi_parol" type="password" required minLength={8} autoComplete="new-password" className={kirishKlass} />
                </Maydon>
                <Maydon nom="Yangi parol (takror)">
                  <input name="takror_parol" type="password" required minLength={8} autoComplete="new-password" className={kirishKlass} />
                </Maydon>
              </div>
              <Yuborish>Parolni almashtirish</Yuborish>
            </form>
          </Card>
        </>
      )}

      <Card className="flex flex-col">
        <CardHeader
          title="Telegram bot"
          meta={tgSoni ? <Badge ton="ok">ulangan · {tgSoni}</Badge> : <Badge>ulanmagan</Badge>}
        />
        <div className="flex flex-col gap-3 px-5 pb-5">
          <p className="text-[13px] leading-relaxed text-ink-2">
            @{BOT_NOMI} orqali qarz, keyingi darslar, davomat va markaz e’lonlarini Telegramda olasiz.
            Tugmani bosing — bot ochiladi, <b>Start</b> ni bosing va tayyor.
          </p>
          <form action={telegramUlash}>
            <Yuborish tur={tgSoni ? 'ikkilamchi' : 'asosiy'} kutish="Ochilmoqda…">
              {tgSoni ? 'Boshqa qurilmani ulash' : 'Telegramga ulash'}
            </Yuborish>
          </form>
          <p className="lbl">Yoki botda /start bosib, telefon raqamingizni yuboring.</p>
        </div>
      </Card>

      <p className="text-[12px] leading-relaxed text-ink-3">
        {faqatTelegram
          ? 'Ism, login yoki parolni o‘zgartirish kerak bo‘lsa — markaz adminiga murojaat qiling.'
          : 'Parolni unutsangiz — markaz adminiga murojaat qiling: u sizga yangi parol qo‘yib beradi.'}
      </p>
    </div>
  )
}
