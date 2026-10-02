import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi, SUPABASE_YOQ } from '@/lib/supabase/env'
import { Logo } from '@/components/ui'
import { ParolInput } from '@/components/parol'
import { loginEmail } from '@/lib/login'
import { ichkiYol } from '@/lib/kiritish'
import { MARKAZ } from '@/lib/markaz'

export const metadata = { title: 'Tizimga kirish' }

const XATOLAR: Record<string, string> = {
  notogri: 'Login yoki parol noto‘g‘ri.',
  bosh: 'Login va parolni kiriting.',
  bloklangan: 'Hisobingiz vaqtincha to‘xtatilgan. Admin bilan bog‘laning.',
  huquq: 'Bu bo‘limga kirish huquqingiz yo‘q.',
  ulanmagan: SUPABASE_YOQ,
}

async function kirish(formData: FormData) {
  'use server'

  // "aziza" ham, "aziza@wba.uz" ham qabul qilinadi
  const email = loginEmail(formData.get('email')) ?? ''
  const parol = String(formData.get('parol') ?? '')
  // /crm rolga qarab yo'naltiradi: xodim boshqaruvga, ustoz davomatga,
  // o'quvchi o'z sahifasiga. Hammani dashboardga yuborish "ochiq emas"
  // degan keraksiz xabar chiqarardi.
  const keyin = ichkiYol(formData.get('keyin'))

  if (!email || !parol) redirect('/kirish?xato=bosh')
  if (!supabaseSozlanganmi()) redirect('/kirish?xato=ulanmagan')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: parol })

  if (error) redirect('/kirish?xato=notogri')
  redirect(keyin)
}

export default async function Kirish({
  searchParams,
}: {
  searchParams: Promise<{ xato?: string; keyin?: string }>
}) {
  const { xato, keyin } = await searchParams
  const ulangan = supabaseSozlanganmi()

  const afzalliklar = [
    `Guruhda ${MARKAZ.guruhMaksimal} kishidan ortiq emas`,
    'Har rol o‘z panelini ko‘radi — xodim, ustoz, o‘quvchi',
    'Davomat, to‘lov, qarz va woblar — bir joyda',
  ]

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Chap — brend paneli (faqat kattaroq ekranda) */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(160deg, #1a0c0b 0%, #0d0706 100%)' }}
      >
        <span className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full" style={{ background: 'rgba(255,77,74,0.16)', filter: 'blur(90px)' }} />
        <span className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full" style={{ background: 'rgba(255,77,74,0.08)', filter: 'blur(90px)' }} />

        <Image src="/logo-oq.png" alt={MARKAZ.nom} width={52} height={52} className="relative object-contain" style={{ width: 52, height: 52 }} priority />

        <div className="relative">
          <h2 className="h-display text-[32px] leading-tight text-white">
            {MARKAZ.nom}
          </h2>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/55">
            Toshkent · {MARKAZ.tashkilYili} yildan beri. O‘quv markazining ichki tizimi.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {afzalliklar.map((f) => (
              <li key={f} className="flex items-center gap-3 text-[13.5px] text-white/80">
                <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: 'rgba(255,77,74,0.18)', color: '#ff6a5a' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-[11px] uppercase tracking-[0.14em] text-white/35">
          {MARKAZ.nom} · {MARKAZ.tashkilYili}
        </div>
      </div>

      {/* O'ng — forma */}
      <div className="grid place-items-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo size="lg" />
          </div>

          <div className="rounded-[18px] border border-line bg-surface p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-20px_rgba(0,0,0,0.35)] sm:p-9">
            <h1 className="h-display text-[24px]">Tizimga kirish</h1>
            <p className="mt-1 mb-6 text-[13.5px] text-ink-2">
              Hisobni markaz admini ochadi. Parolni bilmasangiz — admin bilan bog‘laning.
            </p>

            {xato && (
              <p role="alert" className="mb-4 rounded-[10px] border border-brand-line bg-brand-soft px-4 py-3 text-[13px]">
                {XATOLAR[xato] ?? 'Nimadir noto‘g‘ri ketdi. Qaytadan urinib ko‘ring.'}
              </p>
            )}

            {!ulangan && (
              <p className="mb-4 rounded-[10px] border border-dashed border-line px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-2">
                {SUPABASE_YOQ} Kalitlar qo‘yilmaguncha tizimga kirib bo‘lmaydi.
              </p>
            )}

            <form action={kirish} className="flex flex-col gap-4">
              <input type="hidden" name="keyin" value={keyin ?? ''} />

              <label className="flex flex-col gap-1.5">
                <span className="lbl">Login</span>
                <input
                  name="email"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  autoFocus
                  placeholder="masalan: aziza yoki 10001"
                  className="min-h-12 rounded-[10px] border border-line bg-surface px-3.5 text-[16px] sm:text-[14px] text-ink outline-none transition placeholder:text-ink-4 focus:border-brand-line"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="lbl">Parol</span>
                <ParolInput name="parol" />
              </label>

              <button
                type="submit"
                disabled={!ulangan}
                className="mt-1 min-h-12 rounded-[10px] bg-brand text-[14.5px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kirish
              </button>
            </form>
          </div>

          <Link href="/" className="mt-5 block text-center text-[13px] text-ink-3 transition hover:text-ink">
            ← Saytga qaytish
          </Link>
        </div>
      </div>
    </div>
  )
}
