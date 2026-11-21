# Eslatma: wbalc.uz uchun SEO / GEO

Repozitoriy: `jamshideng/wba` (Next.js 15 + Supabase). Prod: https://wbalc.uz (Vercel, `fra1`; baza — Frankfurtdagi Supabase).

## SEO / GEO uchun nimani qayerda o'zgartirasan
- `src/app/layout.tsx` — umumiy meta-teglar, shriftlar, mavzu.
- `src/app/(site)/` — ommaviy sayt sahifalari (lending va boshqalar).
- `src/app/sitemap.ts`, `src/app/robots.ts` — sayt xaritasi va robots.
- `src/app/opengraph-image.tsx`, `icon.png`, `apple-icon.png`, `manifest.ts` — ko'rinish va ikonkalar.
- `next.config.ts` — sarlavhalar va CSP. Tashqi skript, xarita, analitika yoki shrift ulasang, uning domenini CSP ga qo'shish kerak, aks holda brauzer to'sadi.
- `/crm/*` — yopiq qism (CRM). SEO uchun kerak emas, tegilmaydi.

## Qanday chiqariladi
1. `git pull`, keyin `main` dan yangi branch.
2. O'zgarish, keyin `npm run typecheck` va `npm test`.
3. Branch'ni push qil, `main` ga Pull Request och.
4. CI yashil bo'lishi kerak: «test · typecheck · eslint · build» va «migratsiya + RLS testi».
5. **Merge-commit** bilan qo'shiladi. `main` ga tushsa Vercel prodga o'zi chiqaradi — shuning uchun `main` ga merge Jamshid bilan kelishib.
6. Vercel'da build Google Fonts (Manrope) yuklashda yiqilsa, bu tasodifiy tarmoq nosozligi. Deploy'ni qayta ishga tushir, kod aybdor emas.

## Jamshidsiz qilinmaydi
- **Bazaga migratsiya** (`supabase db push`) — faqat uning aniq «ha»sidan keyin. Fayllar `supabase/migrations/` da, raqam oxirgisidan keyingisi.
- Prod bazaga har qanday yozuv, ko'chirish skriptlari (`npm run migrate`), ma'lumot o'chirish.
- CRM'dagi rol va huquqlarni o'zgartirish, to'lovlarga tegish.
- `.secrets/`, `.env.local`, Supabase `service_role` kaliti, bot tokenlari — nusxalama, commit qilma, hech qayerga yuborma.

## Bilish kerak
- Trafik yo'li: Toshkent → Gonkong (Vercel edge) → Frankfurt. Yengil sahifa ~0,5–0,9 s da ochiladi.
- CRM sahifalari dinamik, ularga indekslash kerak emas.
- Bazaning zaxirasi Jamshidda (`.secrets/zaxira`); prodda avtomatik zaxira hozircha yo'q.
