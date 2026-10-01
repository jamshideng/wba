import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, getUstoz, ROL_NOMI, staffmi, tasdiqlaydimi } from '@/lib/auth'
import { menyular, type MenyuBand } from '@/lib/menyu'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Logo } from '@/components/ui'
import { bosh } from '@/lib/format'
import { IconLogout, IconChevronDown } from '@/components/icons'
import { TemaTugma } from '@/components/tema'

async function chiqish() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/kirish')
}

/** Menyu bandi. Tayyor bo'lmasa — havola emas: bosib 404 ga tushmasin. */
function Band({ band, nishon }: { band: MenyuBand; nishon?: number }) {
  const ichi = (
    <>
      <band.Icon size={17} />
      <span className="flex-1">{band.nom}</span>
      {band.tayyor ? (
        nishon ? (
          <span className="tnum font-[family-name:var(--font-mono)] text-[11px] text-brand">
            {nishon}
          </span>
        ) : null
      ) : (
        <span className="lbl text-[8.5px]">tez orada</span>
      )}
    </>
  )

  if (!band.tayyor) {
    return (
      <span
        aria-disabled="true"
        title="Bu sahifa prototipda hali yo‘q"
        className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-[13.5px] text-ink-4"
      >
        {ichi}
      </span>
    )
  }

  return (
    <Link
      href={band.href}
      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13.5px] text-ink-2 transition hover:bg-surface-2 hover:text-ink"
    >
      {ichi}
    </Link>
  )
}

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const profil = await talabProfil()
  const ustoz = await getUstoz()
  const bolimlar = menyular(profil.rol, Boolean(ustoz))

  /* Tasdiqlanmagan to'lovlar soni — pul ko'radiganlarga.
     Ustozga umuman chiqmaydi (botdagi qoida). */
  let tasdiqlanmagan = 0
  if (staffmi(profil.rol) && supabaseSozlanganmi()) {
    const supabase = await createClient()
    const { count } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('bekor', false)
      .eq('tasdiqlangan', false)
    tasdiqlanmagan = count ?? 0
  }

  const nishon = (band: MenyuBand) =>
    band.href.startsWith('/crm/tolovlar') ? tasdiqlanmagan : undefined

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
    <div className="flex min-h-dvh">
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3.5 py-5 max-lg:hidden">
        <Link href="/crm" className="px-2">
          <Logo />
        </Link>

        <nav className="flex flex-col gap-5">
          {bolimlar.map((bolim) => (
            <div key={bolim.nom} className="flex flex-col gap-0.5">
              <span className="lbl px-3 pb-1">{bolim.nom}</span>
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
        <span className="flex items-center gap-1">
          <span className="lbl text-[9px] text-brand">
            {kim.length ? kim[0] : ROL_NOMI[profil.rol]}
          </span>
          <form action={chiqish}>
            <button
              type="submit"
              aria-label="Chiqish"
              className="flex size-10 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            >
              <IconLogout size={18} />
            </button>
          </form>
        </span>
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
        {/* Kompyuter: o'ng yuqori burchakda kim kirgani, tema va chiqish */}
        <header className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-line bg-surface/90 px-5 py-2 backdrop-blur max-lg:hidden lg:px-7">
          <Link
            href="/crm/profil"
            className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2"
          >
            <span className="flex min-w-0 flex-col items-end">
              <span className="truncate text-[12.5px] font-semibold">{profil.ism}</span>
              <span className="lbl text-[9px] text-brand">
                {kim.length ? kim.join(' · ') : ROL_NOMI[profil.rol]}
              </span>
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-[family-name:var(--font-display)] text-xs font-bold">
              {bosh(profil.ism)}
            </span>
          </Link>
          <TemaTugma />
          <form action={chiqish}>
            <button
              type="submit"
              className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[13px] text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            >
              <IconLogout size={17} />
              Chiqish
            </button>
          </form>
        </header>

        <main className="min-w-0 flex-1 max-lg:pt-14 max-lg:pb-16">{children}</main>
      </div>
    </div>
  )
}
