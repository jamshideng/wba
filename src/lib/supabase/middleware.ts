import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseSozlanganmi } from './env'

/**
 * CRM butunlay /crm ostida turadi.
 * Keyinchalik app.wba.uz → /crm rewrite'i bilan ajratiladi
 * (next.config.ts dagi rewrites qismiga qarang).
 */
const CRM_PREFIX = '/crm'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  /* Kalitlar hali qo'yilmagan — sessiyaga tegmaymiz. Aks holda
     bu yerdagi xato butun saytni yiqitadi. Sahifalarning o'zi
     "Supabase ulanmagan" holatini ko'rsatadi. */
  if (!supabaseSozlanganmi()) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // MUHIM: createServerClient bilan getClaims() orasida hech narsa bo'lmasin —
  // sessiya (muddati o'tgan token) shu yerda yangilanadi.
  // getClaims() tokenni joyida tekshiradi — har so'rovda Auth serveriga
  // tarmoq so'rovi yo'q (getUser() edi: har o'tishda Supabase'ga borardi).
  const { data: claims } = await supabase.auth.getClaims()
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null

  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith(CRM_PREFIX)) {
    const url = request.nextUrl.clone()
    url.pathname = '/kirish'
    url.searchParams.set('keyin', pathname)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/kirish') {
    const url = request.nextUrl.clone()
    // /crm har kimni o'z paneliga yuboradi (o'quvchi — o'z sahifasiga).
    // Dashboardga yuborilsa o'quvchi "ochiq emas" xabarini ko'rardi.
    url.pathname = '/crm'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
