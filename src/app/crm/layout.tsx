import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { talabProfil, getUstoz, ROL_NOMI, staffmi, tasdiqlaydimi } from '@/lib/auth'
import { menyular, type MenyuBand } from '@/lib/menyu'
import { MENYU_COOKIE } from '@/lib/menyu-holat'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Logo } from '@/components/ui'
import { bosh } from '@/lib/format'
import { IconChevronDown } from '@/components/icons'
import { TemaTugma } from '@/components/tema'
import { ProfilMenyu } from '@/components/profil-menyu'
import { MenyuTugma } from '@/components/menyu-tugma'
import { YuklanishChizigi, HavolaHolati } from '@/components/yuklanish'
import { BildirishnomaJoyi } from '@/components/bildirishnomalar'
import type { MeningBildirishnomam } from '@/lib/bildirishnoma'

async function chiqish() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Brauzer xotirasidagi (staleTimes) sahifalar keyingi odamga ko'rinmasin
  revalidatePath('/', 'layout')
  redirect('/kirish')
}

/** Menyu bandi. Tayyor bo'lmasa — havola emas: bosib 404 ga tushmasin. */
function Band({ band, nishon }: { band: MenyuBand; nishon?: number }) {
  const ichi = (
    <>
      <band.Icon size={17} className="shrink-0" />
      <span className="flex-1 truncate group-data-[menyu=yopiq]/qobiq:hidden">{band.nom}</span>
      {band.tayyor ? (
        nishon ? (
          <span className="tnum font-[family-name:var(--font-mono)] text-[11px] text-brand group-data-[menyu=yopiq]/qobiq:hidden">
            {nishon}
          </span>
        ) : null
      ) : (
        <span className="lbl text-[8.5px] group-data-[menyu=yopiq]/qobiq:hidden">tez orada</span>
      )}
    </>
  )

  if (!band.tayyor) {
    return (
      <span
        aria-disabled="true"
        title={`${band.nom} — tez orada`}
        className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-[13.5px] whitespace-nowrap text-ink-4 group-data-[menyu=yopiq]/qobiq:justify-center group-data-[menyu=yopiq]/qobiq:px-0"
      >
        {ichi}
      </span>
    )
  }

  return (
    <Link
      href={band.href}
      title={band.nom}
      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13.5px] whitespace-nowrap text-ink-2 transition hover:bg-surface-2 hover:text-ink group-data-[menyu=yopiq]/qobiq:justify-center group-data-[menyu=yopiq]/qobiq:px-0"
    >
      {ichi}
      <HavolaHolati />
    </Link>
  )
}

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const profil = await talabProfil()
  const xodim = staffmi(profil.rol) && supabaseSozlanganmi()
  const supabase = xodim ? await createClient() : null

  /* Bir-biriga bog'liq bo'lmagan so'rovlar — parallel (ketma-ket emas).
     Tasdiqlanmagan to'lovlar soni — pul ko'radiganlarga; ustozga umuman
     chiqmaydi (botdagi qoida). Market: olib ketilmagan buyurtmalar (0040). */
  const [kuki, ustoz, tolovSoni, marketSoni, bildirish] = await Promise.all([
    cookies(),
    getUstoz(),
    supabase
      ? supabase.from('payments').select('id', { count: 'exact', head: true }).eq('bekor', false).eq('tasdiqlangan', false)
      : Promise.resolve({ count: 0 }),
    supabase
      ? supabase.from('woblr_redemptions').select('id', { count: 'exact', head: true }).eq('holat', 'kutilmoqda')
      : Promise.resolve({ count: 0 }),
    // Sayt ichidagi bildirishnomalar — faqat menga tegishli faollari (0047)
    supabaseSozlanganmi()
      ? createClient().then((c) => c.rpc('mening_bildirishnomalarim'))
      : Promise.resolve({ data: [] }),
  ])
  const bildirishnomalar = (Array.isArray(bildirish.data) ? bildirish.data : []) as MeningBildirishnomam[]
  const menyuYopiq = kuki.get(MENYU_COOKIE)?.value === 'yopiq'
  const bolimlar = menyular(profil.rol, Boolean(ustoz))
  const tasdiqlanmagan = tolovSoni.count ?? 0
  const marketKutilmoqda = marketSoni.count ?? 0

  const nishon = (band: MenyuBand) =>
    band.href.startsWith('/crm/tolovlar')
      ? tasdiqlanmagan
      : band.href === '/crm/market/boshqaruv'
        ? marketKutilmoqda
        : undefined

  /* Telefon uchun: eng kerakli 4 ta band + "Menyu" (qolgan hammasi).
     Pastki panelga 5 tadan ortig'i sig'maydi, bo'limlar esa ko'p. */
  const mobilBandlar = bolimlar
    .flatMap((b) => b.bandlar.filter((x) => x.mobil && x.tayyor))
    .slice(0, 4)

  /* Kim ekani — botdagi menyuMatni() kabi: ikki rol bo'lsa ikkalasi ham. */
  const kim = [
    ustoz ? `ustoz — ${ustoz.ism}` : null,
    tasdiqlaydimi(profil.rol) ? 'direktor' : null,
    profil.rol === 'admin' ? 'administrator' : null,
    profil.rol === 'qabulxona' ? 'qabulxona' : null,
  ].filter((x): x is string => Boolean(x))

  return (
    <div id="crm-qobiq" data-menyu={menyuYopiq ? 'yopiq' : 'ochiq'} className="group/qobiq flex min-h-dvh">
      <Suspense fallback={null}>
        <YuklanishChizigi />
      </Suspense>
      {/* Menyu sahifa bilan birga surilmaydi: o'z joyida qotgan, kengligi o'zgarmaydi.
          Yig'ilganda faqat ikonkalar (nomi — sichqoncha ustida). */}
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col gap-6 overflow-x-hidden overflow-y-auto [scrollbar-width:none] border-r border-line bg-surface px-3.5 py-5 transition-[width] max-lg:hidden group-data-[menyu=yopiq]/qobiq:w-[68px] group-data-[menyu=yopiq]/qobiq:px-2">
        <Link href="/crm" className="px-2 group-data-[menyu=yopiq]/qobiq:px-0">
          <Logo matnKlass="group-data-[menyu=yopiq]/qobiq:hidden" />
        </Link>

        <nav className="flex flex-col gap-5">
          {bolimlar.map((bolim) => (
            <div key={bolim.nom} className="flex flex-col gap-0.5">
              <span className="lbl truncate px-3 pb-1 group-data-[menyu=yopiq]/qobiq:hidden">{bolim.nom}</span>
              {bolim.bandlar.map((band) => (
                <Band key={band.href} band={band} nishon={nishon(band)} />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Telefon: tepada logotip, pastda asosiy bandlar */}
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-2.5 lg:hidden">
        <Link href="/crm">
          <Logo size="sm" />
        </Link>
        <span className="flex-1" />
        <span className="mr-2">
          <BildirishnomaJoyi joy="mobil" royxat={bildirishnomalar} />
        </span>
        <ProfilMenyu
          ixcham
          ism={profil.ism}
          rolMatn={kim.length ? kim[0] : ROL_NOMI[profil.rol]}
          boshHarf={bosh(profil.ism)}
          chiqish={chiqish}
        />
      </header>

      <nav
        aria-label="Asosiy menyu"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
      >
        {mobilBandlar.map((band) => (
          <Link
            key={band.href}
            href={band.href}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-ink-3 transition hover:text-ink"
          >
            <band.Icon size={18} />
            <span className="truncate text-[10.5px]">{band.nom}</span>
          </Link>
        ))}
        <Link
          href="/crm/menyu"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-ink-3 transition hover:text-ink"
        >
          <IconChevronDown size={18} />
          <span className="truncate text-[10.5px]">Menyu</span>
        </Link>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Kompyuter: o'ng yuqori burchakda tema va profil (bosilsa: Profil, Chiqish) */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface/90 px-5 py-2 backdrop-blur max-lg:hidden lg:px-7">
          <MenyuTugma />
          <span className="flex-1" />
          <TemaTugma />
          <BildirishnomaJoyi joy="kompyuter" royxat={bildirishnomalar} />
          <ProfilMenyu
            ism={profil.ism}
            rolMatn={kim.length ? kim.join(' · ') : ROL_NOMI[profil.rol]}
            boshHarf={bosh(profil.ism)}
            chiqish={chiqish}
          />
        </header>

        <main className="min-w-0 flex-1 max-lg:pt-14 max-lg:pb-16">{children}</main>
      </div>
    </div>
  )
}
