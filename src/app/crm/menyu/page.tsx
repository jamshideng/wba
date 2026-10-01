import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { talabProfil, getUstoz, ROL_NOMI } from '@/lib/auth'
import { menyular } from '@/lib/menyu'
import { createClient } from '@/lib/supabase/server'
import { Sarlavha } from '@/components/crm'
import { TemaTugma } from '@/components/tema'
import { IconLogout } from '@/components/icons'

export const metadata = { title: 'Menyu' }
export const dynamic = 'force-dynamic'

async function chiqish() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Brauzer xotirasidagi (staleTimes) sahifalar keyingi odamga ko'rinmasin
  revalidatePath('/', 'layout')
  redirect('/kirish')
}

/** Telefondagi to'liq menyu — pastki panelga sig'magan hamma bo'lim shu yerda. */
export default async function Menyu() {
  const profil = await talabProfil()
  const ustoz = await getUstoz()
  const bolimlar = menyular(profil.rol, Boolean(ustoz))

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <Sarlavha nom="Menyu" izoh={`${profil.ism} · ${ustoz ? 'ustoz · ' : ''}${ROL_NOMI[profil.rol]}`} />

      {bolimlar.map((b) => (
        <section key={b.nom} className="flex flex-col gap-2">
          <h2 className="lbl">{b.nom}</h2>
          <div className="grid grid-cols-2 gap-2">
            {b.bandlar.filter((x) => x.tayyor).map((x) => (
              <Link
                key={x.href}
                href={x.href}
                className="flex min-h-14 items-center gap-3 rounded-[11px] border border-line bg-surface px-4 text-[13.5px] transition hover:border-ink-3"
              >
                <x.Icon size={18} />
                {x.nom}
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-2">
        <form action={chiqish} className="flex-1">
          <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[11px] border border-line text-[13.5px] text-ink-3 hover:text-ink">
            <IconLogout size={17} /> Chiqish
          </button>
        </form>
        <TemaTugma />
      </div>
    </div>
  )
}
