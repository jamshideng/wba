/**
 * Matnni so'zlarga bo'lib chiqaradi — har so'z o'z "derazasi"da (overflow
 * yashirin), Harakat ularni pastdan birma-bir chiqaradi ([data-sozlab]).
 * Server komponent: so'zlar HTML'da tayyor, JS faqat animatsiya qiladi.
 */
export function Sozlab({ matn, className = '' }: { matn: string; className?: string }) {
  return (
    <>
      {matn.split(' ').map((s, i) => (
        <span key={`${s}-${i}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className={`lb-w inline-block ${className}`}>{s}</span>
          {'\u00a0'}
        </span>
      ))}
    </>
  )
}
