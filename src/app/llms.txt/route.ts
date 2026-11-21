import { llmsMatn } from '@/lib/seo'

/** /llms.txt — AI-qidiruv uchun markaz haqida qisqa matn (GEO). Statik quriladi. */
export const dynamic = 'force-static'

export function GET() {
  return new Response(llmsMatn(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
