# WBA — vazifalar

Yangilangan: **2026-09-19**, to'liq diagnostikadan keyin.
Har vazifadagi `B4`, `S2`, `D1` kabi belgilar [`docs/DIAGNOSTIKA.md`](docs/DIAGNOSTIKA.md)
dagi topilmaga ishora qiladi — sababi va dalili o'sha yerda.

- **Jamshid** — egasi: hisoblar, to'lov, sozlamalar, Sheets'dagi ma'lumot va biznes qarorlari. Kod yozish shart emas.
- **sxvs** — dasturchi: bot, sayt, baza, ko'chirish, CI.

Tartib muhim: 🔴 avval, keyin 🟠. Bir vazifa boshqasiga bog'liq bo'lsa, "Kutadi:" deb yozilgan.

---

## Umumiy qoidalar (ikkalasi uchun)

1. **`main` ga to'g'ridan-to'g'ri push qilinmaydi.** sxvs branch ochadi (`fix/bot-callback-huquq`), PR yuboradi; Jamshid ko'rib **"Create a merge commit"** bilan birlashtiradi. Sabab: Vercel Hobby sxvs muallifligidagi commitni joylashtirmaydi (I2), Jamshidning merge commiti esa joylashadi.
2. Commit xabari — o'zbekcha: nima va nega (`CLAUDE.md`).
3. Qo'llangan migratsiya (`0001`–`0017`) **tahrirlanmaydi** — har o'zgarish yangi raqamli fayl. `alter type … add value` alohida faylda.
4. Kalitlar (`.env.local`, `.secrets/`, Script Properties) hech qachon git'ga, chatga, PR ga yozilmaydi.
5. Sinov yozuvlari — ismi `SINOV` bilan boshlanadi va sinovdan keyin o'chiriladi. Haqiqiy o'quvchi/to'lov bilan sinalmaydi.
6. Bulutdagi bazaga qo'lda SQL yozilmaydi — faqat migratsiya yoki ko'chirish skripti orqali, Jamshidning roziligi bilan.
7. Bot: kod o'zgarsa `clasp push` **va** `clasp deploy -i AKfycbzCUCC…` (manzil o'zgarmasin). Deploy qilinmasa eski versiya ishlaydi. Dars paytida (08:00–21:00) `SINOV_*`, `BOT_TEKSHIR`, `JURNAL` bosilmaydi — ular haqiqiy varaqqa yozadi.
8. Har o'zgarishdan keyin: `npm test`, `npm run typecheck`, `npx eslint src scripts`, baza o'zgarsa `npm run db:test`.

---

# JAMSHID uchun

### J1 🔴 Ro'yxatdan o'tishni yopish (I3) — 2 daqiqa
1. https://supabase.com/dashboard/project/uxmmyrfzcccieuqaosts/auth/providers
2. **User Signups** → "Allow new users to sign up" ni **o'chiring** → **Save changes**.
3. Shu sahifada "Confirm email" qolsin.

**Tayyor, qachonki:** tugma kulrang. Hisoblarni endi faqat admin sayt ichidan ochadi.

### J2 🔴 Saytni bazaga ulash (I1) — 10 daqiqa
1. Supabase → **Project Settings → Integrations → Vercel** → Connect → Vercel hisobingiz bilan ruxsat bering → loyiha `wba` ni tanlang.
   Integratsiya `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ni Vercel'ga o'zi yozadi — kalitni qo'lda ko'chirmaysiz.
2. Vercel → `wba` → **Settings → Environment Variables**: nomlarini tekshiring (qiymatini emas), yetishmasa qo'shing. Qo'shimcha: `NEXT_PUBLIC_SITE_URL` = Vercel bergan manzil (masalan `https://wba-xxx.vercel.app`).
3. Supabase → **Authentication → URL Configuration** → Site URL = o'sha manzil (I7).
4. Vercel → **Deployments** → oxirgisi → **Redeploy**.

**Tayyor, qachonki:** Vercel manzilida `/kirish` ochiladi va `jamshid` bilan kirasiz. Istasangiz, men yordam beraman: ruxsat tugmalarini siz bosasiz, qolganini men qilaman.

### J3 🔴 Vercel: sxvs commitlari bloklanmasin (I2) — qaror
Ikkita yo'l bor:
- **A (hozir, bepul):** sxvs faqat PR yuboradi, siz GitHub'da **Merge pull request → Create a merge commit** bosasiz. Merge commit sizniki bo'lgani uchun Vercel joylashtiradi.
- **B:** Vercel **Pro** ($20/oy). sxvs'ni jamoaga qo'shasiz, uning commitlari ham joylashadi. Vercel shartlariga ko'ra tijoriy loyiha (markaz) uchun Pro kerak.

**Tavsiya:** hozir A, sayt ishga tushgach B.

### J4 🔴 Bot kodini sxvs'ga ochish — bot tuzatishlari shunga bog'liq
Bot kodi (`Desktop\wba_bot\*.js`) GitHub'da yo'q, sxvs uni ko'rmaydi. Kodda kalit yo'q (tekshirildi, hammasi Script Properties'da).
- **A (tavsiya):** alohida yopiq repozitoriy `jamshideng/wba-bot` ochiladi (men tayyorlab beraman). sxvs PR yuboradi, **deploy'ni siz qilasiz** (`clasp push` + `clasp deploy`), chunki loyiha sizning Google hisobingizda.
- **B:** Apps Script loyihasini sxvs'ning Google hisobiga "Editor" qilib ulashasiz — u o'zi ham deploy qila oladi.

### J5 🔴 Xavfli funksiyalarni bosmang (B5) — sxvs S4 ni tugatguncha
Apps Script muharririda **`KOCHIR_1/2/3`**, **`Z_*`**, **`SINOV_*`**, **`BOT_TEKSHIR`**, **`JURNAL`** ni ishga tushirmang. `KOCHIR_1` butun bazani tozalaydi.
"Выполнить" dan oldin ro'yxatda qaysi funksiya tanlanganini tekshiring: muharrir kechikib, oldingi funksiyani ishga tushirgan holat bo'lgan. Xato bosilsa: Sheets → **Fayl → Versiyalar tarixi** → kerakli vaqtni tiklang.

### J6 🔴 Proksi kaliti (B18) — 3 daqiqa
Apps Script → `PROKSI_SINOV` ni ishga tushiring.
**Tayyor, qachonki:** 2-bandda `"no"` chiqadi ("Kalitsiz: … no"). `XATO: kalitsiz so'rov ham o'tib ketdi` chiqsa — Cloudflare → Worker `wba-bot` → Settings → Variables → `SECRET` = Script Properties'dagi `WEBHOOK_SIR` qiymati. Qiymatni hech kimga yubormang.

### J7 🟠 2FA — hisoblar himoyasi (I6)
GitHub, Vercel, Supabase, Cloudflare va Google hisobingizga (Sheets va Apps Script egasi) ikki bosqichli kirishni yoqing: har birida Settings → Security → Two-factor / Authenticator app.

### J8 🟠 Sheets'dagi ma'lumotni tuzatish (D1–D14)
Qator o'chirilmaydi (`deleteRow` — formulalarni buzadi): faqat qo'lda yozilgan kataklar tozalanadi yoki tuzatiladi.

| # | Nima qilasiz |
|---|---|
| D1 | Qatnashuv, **Q088 (S079 Muhammad)**: "Boshlandi" katagini tozalab, sanani qayta tanlang (kalendardan yoki `16.09.2026`, oxirida probelsiz). O'quvchilar 80-qator va Boshqaruv panelidagi `#VALUE!` o'zi yo'qoladi |
| D2 | **S076 Oybek**: Q083 (01.09 dan) va Q086 (16.09 dan) — qaysi biri to'g'ri? Noto'g'risining O'quvchi, Guruh, Boshlandi, chegirma kataklarini tozalang. To'lovlar o'z kalitida qoladi |
| D14 | Probniylar, **P002 Muhammad**: Holat → "Doimiy" (u allaqachon S079) |
| D10 | Qatnashuv **Q031**: −1 350 000 ortiqcha — oldindan to'lovmi yoki boshqa guruhga yozilishi kerak edimi? Izoh ustuniga yozing |
| D9 | **S037, S038, S045** — "Faol", lekin guruhi yo'q: ketgan bo'lsa Holat → Ketgan; o'qiyotgan bo'lsa Qatnashuvga guruhini yozing |
| D6 | Telefonsiz 9 o'quvchi: **S020, S044, S071, S072, S073, S074, S075, S076, S077** — kamida bitta raqam |
| D7 | **S064, S066, S068** "Ota telefoni"da ikki raqam — ikkinchisini "Ona telefoni"ga (yoki Izohga) ko'chiring |
| D8 | Familiyasiz 11 o'quvchi: S033, S034, S044, S067, S068, S071, S072, S074, S077, S078 ("Kozim " — oxiridagi probelni ham oling), S079 |
| D5 | 78 o'quvchining tug'ilgan sanasi — qabulxona asta-sekin to'ldiradi (sayt yosh bo'yicha filtr beradi) |
| D11 | 16 to'lovda Usul bo'sh — ma'lum bo'lsa yozing. "Terminal" haqida — J10 |
| D12 | Narxlar (yashirin varaq): **"sdfd · Jamshid · …"** degan 2 sinov qatorini tozalang |
| D13 | Xodimlar: **1408092377** — ismini yozing |

**Tayyor, qachonki:** sxvs `npm run migrate:dry` yuritganda "Sheets'ning o'z xatosi" ro'yxati bo'sh chiqadi.

### J9 🟠 Direktor tasdig'i (D3)
40 to'lovning birortasi tasdiqlanmagan. Farrux botda **✅ Tasdiqlash** orqali o'tib chiqsin. Yoki tasdiq bosqichi kerak emasligini hal qiling (J10) — u holda saytdan ham olib tashlaymiz.

### J10 🟠 Qarorlar — javobingiz kerak (sxvs shularni kutadi)
| # | Savol | Variantlar | Kim kutadi |
|---|---|---|---|
| Q1 | **Oylik hisob qachon yoziladi** (S2) | a) har oyning 1-sanasida (kalendar) · b) o'quvchi kelgan kuni, oyma-oy (hozirgi Sheets) | W4 |
| Q2 | **Sinx tayyor bo'lgunicha qaysi manba asosiy** (S1) | a) Sheets asosiy, sayt faqat ko'rish uchun, har soatda o'zi yangilanadi (tavsiya) · b) sayt asosiy, Sheets'ga kiritish to'xtatiladi | W2 |
| Q3 | **"Terminal"** (D11) | a) karta deb hisoblash · b) alohida usul | W1 |
| Q4 | **"Dars o'tkazilmadi"** (K3) | a) davomatga kirmaydi (tavsiya) · b) hammasi "keldi" (hozirgi bot) | W1, S6 |
| Q5 | **O'tgan kun davomatini kim tuzatadi** (S4) | a) faqat admin · b) ustoz 2 kungacha · c) hech kim | W6 |
| Q6 | **Woblar reytingi** (S8) | a) o'quvchi hammaning ismini ko'radi · b) faqat o'zinikini va o'rnini | W7 |
| Q7 | Ochiq savollar (`CLAUDE.md`) | ustoz maoshi qoidasi · bir darsda eng ko'p necha wobl · chegirma miqdorlari (ikki fan, aka-uka) | keyinroq |
| Q8 | **Domen** `wba.uz` kimniki, ulaymizmi (I8) | — | W11 |

### J11 🟠 Bulutdagi davomatni tozalashga ruxsat (K1, K2)
sxvs W1 ni tugatgach: kelajakdagi 95 dars va ularning 398 "kelmadi" belgisi, hamda belgilanmagan darslar bulutdan o'chiriladi va davomat qayta ko'chiriladi. Buyruqni sxvs tayyorlaydi, siz "ha" deysiz. Pul yozuvlariga tegilmaydi.

### J12 🟠 Ustozlarga eslatma (D4, B7)
Juft kun guruhlari (Arab tili, Starter, Rus tili, IELTS, Pre-Intermediate, Matematika) davomatni belgilamayapti: 26 dars bo'sh.
**Hozircha** ustozlarga ayting: botda dars ochilganda hamma ❌ turadi, **kelganlarni bosib ✅ qilib**, keyin "Saqlash". sxvs S6 ni tugatgach, aksincha bo'ladi: hamma ✅ ochiladi, faqat kelmaganlar bosiladi.

### J13 🟡 Zaxira nusxa (I4)
Supabase **Pro** ($25/oy) — kunlik backup va to'xtab qolmaslik. Yoki sxvs'ga W12 (bepul tungi zaxira) ga ruxsat bering. Sheets o'z versiya tarixini saqlaydi.

### J14 🟡 Loginlarni tarqatish (I5)
Sayt ishga tushgach sxvs W9 skripti ustozlar va o'quvchilar uchun login ro'yxatini sizning kompyuteringizda fayl qilib chiqaradi. Parollarni har kimga shaxsan bering; kirgach har kim **Profil va parol** dan o'zinikiga almashtirsin.

---

# SXVS uchun

Ish muhiti: `README` o'rniga hozircha shu fayl + `CLAUDE.md`.
```bash
git clone https://github.com/jamshideng/wba.git && cd wba && npm install
cp .env.example .env.local      # qiymatlar Jamshiddan, xavfsiz yo'l bilan
npm run ishga                   # Windows; Docker kerak (lokal Supabase 583xx)
npx supabase@latest migration up
```
Lokal bazada Jamshidning test yozuvlari bor (S001–S003, G01–G04) — **`db reset` qilinmaydi**.

## A. Bot (Apps Script) — Kutadi: J4

### S1 🔴 Tugmalarda huquq tekshiruvi (B1, B2)
**Fayl:** `Kod.js` → `tugmaniQayta` (967-qator atrofi), `BOT_Probniy.js`.
1. `tugmaniQayta` boshida `var rol = botRol(String(cq.from.id))` va yagona jadval:
   `X, PD, PG, BS, BG` → `rol.admin`; `TD` → `direktormi` (bor); `DB, DG, DT, DS, DN, DX` → `rol.ustoz || rol.admin`; `M` → `menyuRuxsat` (bor); `L, K` → hamma.
   Rad etilsa: `javobBer(cq.id, TR(tgId,'huquq.admin'))` va hech narsa yozilmaydi.
2. Holatli oqimlarda (`DG/DT/DS…`, `S/G/U`) holatga `egasi: tgId` yozing va bosgan odam egasi ekanini tekshiring: boshqa chatdan kalit topilsa ham ishlamasin.
3. `SINOV_HUQUQ()`: begona ID (`111222333`) va ustoz ID bilan `X|T…`, `PD|…`, `TD|…` soxta callback'larini `tugmaniQayta` ga bering. Jadvalga hech narsa yozilmaganini tekshiring (Tolovlar va Probniylar qatorlarini oldin va keyin solishtiring).

**Tayyor, qachonki:** `SINOV_HUQUQ` "HAMMASI TO'G'RI"; admin uchun "Bekor" va "Doimiy" ishlaydi.

### S2 🔴 To'lovni yumshoq bekor qilish (B3)
**Fayllar:** `BOT_Baza.js` (`bTolovOchir`, `bTolovYoz`, `bBoshQator`), `D_Tolov.js`, `U_Qatnashuv.js` (To'langan formulasi), `K_Panel.js`, `BOT_Hisobot.js`, `Kod.js` (`bugungiHisobot`, `oylikHisobot`).
1. Tolovlar'ga ustunlar: **Bekor** (checkbox), **Bekor sabab**, **Bekor qildi**, **Bekor vaqti** (oxiriga, formulalar orasiga emas).
2. `bTolovOchir` qatorni **tozalamaydi**: Bekor=TRUE, sabab/kim/vaqt yoziladi. Funksiya nomini `bTolovBekor` qiling.
3. Hamma yig'indilar bekorlarni sanamasin: Qatnashuv "To'langan" (`SUMIFS(…, Bekor, "<>TRUE")`), O'quvchilar "Jami to'langan", Boshqaruv paneli, bot hisobotlari, `tasdiqRoyxat`.
4. ID qayta ishlatilmasin: yangi to'lov doim oxirgi band qatordan keyingisiga tushadi (`bBoshQator` — birinchi bo'sh emas).
5. Ko'chirish (`scripts/migrate-from-sheets.ts`): Bekor=TRUE → `payments.bekor = true`, `bekor_sabab`.
6. `BOT_TEKSHIR` ni yangilang: 1 so'mlik sinov to'lovi bekor qilingach qator va ID joyida qolsin, qarz o'zgarmasin.

**Tayyor, qachonki:** bekor qilingan to'lov Sheets'da ko'rinadi (chizilgan/kulrang), qarzga ta'sir qilmaydi, keyingi to'lov yangi ID oladi.

### S3 🔴 Jurnalni xavfsiz qilish (B4, B6)
**Fayllar:** `Q_Jurnal.js` (`JURNAL`, `_jurnalYoz`), `R_Guruh.js` (`JURNAL_AVTO`), `BOT_Davomat.js` (`davomatSaqla`).
1. **Qulf:** `JURNAL()` `LockService.getScriptLock().waitLock(30000)` oladi; `davomatSaqla` ham o'sha qulf.
2. **Zaxira:** tozalashdan OLDIN `eski.belgilar` yashirin `_Jurnal_zaxira` varag'iga yozilsin (`guruh | tanlov | sana | true/false`). Keyingi `JURNAL()` avval zaxirani o'qib qo'shsin — tozalanib, yozilmay qolsa ham belgi yo'qolmaydi.
3. **Arxiv:** faqat joriy va o'tgan oy qayta quriladi; eskiroq oylar `Davomat arxiv YYYY-MM` varag'iga qiymat sifatida bir marta ko'chiriladi va qayta qurilmaydi. `_Davomat` indeksi arxivni ham o'qiydi.
4. **Vaqt nazorati:** boshlanganidan 300 s o'tgan bo'lsa tozalashga o'tmay chiqib ketsin va `_Bot_log` ga yozsin.
5. **To'g'ri qator:** `davomatSaqla` saqlash paytida `bJurnalJoy(guruh, tur, sana)` ni qayta chaqirib, belgini qator raqami bo'yicha emas, `kalit` (tanlov) bo'yicha yozsin. Topilmagan kalit — xabarda ko'rsatilsin.

**Tayyor, qachonki:** `JURNAL_AVTO` < 120 s (ijrolar ro'yxati). Sinov: davomat ekrani ochiq turganda `JURNAL()` ishlatilib, keyin "Saqlash" bosilsa ham belgilar o'z bolasiga tushadi.

### S4 🔴 Xavfli va eski fayllarni deploydan olish (B5, B27)
1. `.claspignore` dan `X_Kochir.js`, `W_Malumot.js`, hamma `Z_*.js` ni olib tashlang (deploy qilinmasin). `test_kod.js`, `mutate.js` allaqachon tashqarida.
2. Oldin bog'liqlikni tekshiring: `grep` bilan boshqa fayllar shu fayllardagi funksiya/o'zgaruvchini chaqiradimi. Chaqirsa — kerakli yordamchini tegishli faylga ko'chiring.
3. Qolgan xavfli funksiyalarga (`KOCHIR_*` kerak bo'lsa) `A_Jadval.js` dagi kabi qorovul qo'ying: Script Property `XAVFLI_RUXSAT = <bugungi sana>` bo'lmasa hech narsa qilmasin.
4. `clasp push` → hamma `SINOV_*` (dars vaqtidan tashqari) → `clasp deploy -i …`.

**Tayyor, qachonki:** muharrir ro'yxatida `KOCHIR_*` va `Z_*` yo'q; `SINOV_MENYU`, `SINOV_HISOBOT`, `SINOV_TIL`, `SINOV_XODIM` o'tadi.

### S5 🟠 Qator chegaralari (B8, B9, B10)
1. `B_CHEGARA_ODDIY` o'rniga varaqning haqiqiy hajmi: `bOxirgiQator` `s.getMaxRows()-1` gacha o'qisin (yoki `TextFinder`/`getNextDataCell`).
2. Qatnashuv panjarasini 2000 qatorga kengaytiring va formulalarni (`QATOR_SONI`) o'sha chegaragacha qo'ying (`HIMOYA` / `B_Yangi` yo'li bilan, qo'lda emas). Tolovlar 1500 → 5000.
3. `bDavomatFoiz`: 400 chegarasini olib tashlang.
4. `probGuruhlar` tugmalari: 20 tadan keyin "Keyingi ▶" sahifalash (`PG|p2` kabi).

**Tayyor, qachonki:** 21 guruhning hammasi botdan tanlanadi; `SINOV_*` o'tadi.

### S6 🟠 Davomat: "belgilanmagan" holati (B7, B11) — Kutadi: J10-Q4
1. Har blokda har dars uchun "belgilangan" belgisi: masalan blok sarlavhasidagi sana katagiga eslatma (`note`) yoki yashirin qator `#BELGI|guruh` (1 = saqlangan). Saqlash (`davomatSaqla`, `davomatOtkazilmadi`) belgini qo'yadi.
2. `davomatGuruh`: dars **belgilanmagan** bo'lsa hamma ✅ ochilsin (asl reja); belgilangan bo'lsa jadvaldagi holat.
3. Foiz (jurnal va `_Davomat`) = kelgan / **o'tgan belgilangan** darslar; kelajakdagi va belgilanmagan darslar maxrajga kirmaydi.
4. "Dars o'tkazilmadi" — Q4 qaroriga ko'ra: (a) belgilangan, lekin foizga kirmaydi.
5. Ko'chirish (W1) shu belgini o'qiydi.

### S7 🟡 Biriktirish oqimi (B12, B13, B14)
1. `Kod.js` switch'ga `case '/biriktir': return biriktirBoshla(chat, kim);`, admin menyusiga "➕ Guruhga biriktirish" tugmasi (`MK_BIRIKTIR`, `menyuRuxsat` → admin, `BOT_Til.js` ga 5 tilda matn + `SINOV_TIL`).
2. `BG|…`, `PG|…` callback'ida indeks emas, **Guruh ID** (`G05`) ketsin.
3. `_qatnYoz`: mavjud qatorda Tugadi bo'lsa yangi qator ochsin; ochiq qator bo'lsa "allaqachon shu guruhda" deb qaytarsin (D2 takrorlanmasin).

### S8 🟡 onEdit — ko'p katak (B15)
`JADVAL_ONEDIT`: `getNumRows()>1` bo'lsa ham Tolovlar/O'quvchilar/Qatnashuv/Probniylar uchun har qatorni alohida ishlasin (Sana, Davr, narx muhri, Kiritilgan, telefon formati). Katta paste (>50 qator) — faqat `_Bot_log` ga ogohlantirish.

### S9 🟡 Xato holatlari (B16, B17, B19, B23)
1. `doPost`: `WEBHOOK_SIR` yo'q bo'lsa ham rad etsin (fail-closed).
2. `catch` ichida foydalanuvchiga qisqa javob: "Xatolik yuz berdi, qayta urinib ko'ring (kod: <update_id>)" — chat ID `u.message.chat.id` yoki `u.callback_query.message.chat.id`.
3. `tg()`: 5xx da qayta urinish faqat idempotent metodlar uchun (`getUpdates`, `answerCallbackQuery`, `editMessageText`); `sendMessage`/`sendDocument` — bir marta.
4. Sekin amallar (Excel, hisobot): avval "⏳ Tayyorlanmoqda…" xabari, keyin tahrirlash.

### S10 ⚪ Mayda tuzatishlar (B20–B26, B28)
- `T_Tasdiq`: Tasdiq himoyasidan egani ham olib bo'lmaydi — o'rniga onEdit'da "Tasdiq" ni direktor pochtasidan boshqa odam bossa qaytarib qo'yish va `_Bot_log` ga yozish.
- `excelYubor`: faqat direktor; yoki telefon ustunlarisiz nusxa.
- `bOquvchiQidir`: `S` + 3 xonadan kam bo'lsa to'ldirish, ko'p bo'lsa o'zicha (`S1000`).
- `TEKSHIR_hammasi`, `BOT_TEZLIK`, `Kod.js` sarlavhasi — webhook rejimiga moslash.
- `DAVOMAT_ESLAT`: `bBugungiTurlar()` (ro'yxat) ishlatilsin.
- Erkin matn to'lovida summa ≥ 1 000 000 yoki "<3000 → ×1000" qo'llangan bo'lsa — "Tasdiqlaysizmi?" qadami.

## B. Sayt, baza, ko'chirish

### W1 🔴 Ko'chirishni tuzatish (K1–K4) — Kutadi: J10-Q3/Q4, keyin J11
**Fayllar:** `scripts/lib/jurnal.ts`, `scripts/lib/parse.ts`, `scripts/migrate-from-sheets.ts`, testlar.
1. `jurnallarniOqi`: `sana > bugun (Toshkent)` bo'lgan darslar olinmaydi.
2. Blokdagi hamma katak `false` bo'lgan o'tgan dars — **belgilanmagan**: dars ham, belgi ham yozilmaydi. S6 tayyor bo'lsa — belgilangan belgisi bo'yicha. Istisno: `_Bot_log` da shu guruh+sana uchun `DAVOMAT` yozuvi bo'lsa — haqiqiy.
3. Izohda `dars o'tkazilmadi MM-DD` bo'lsa → `lessons.otkazildi = false`, attendance yozilmaydi.
4. "Terminal": Q3 = a bo'lsa `USUL_MAP.terminal = 'karta'`; b bo'lsa `0019_usul_terminal.sql` (0018 band — panel davomati va reyting) (`alter type payment_method add value 'terminal'`, alohida fayl) + `src/lib/types.ts` + to'lov formasi.
5. Testlar: `scripts/lib/parse.test.ts` / yangi `jurnal.test.ts` — kelajak sanasi, hammasi false, "dars o'tkazilmadi", Terminal.
6. Bulutni tozalash skripti `scripts/davomat-tozala.ts` (`--dry-run` standart): kelajakdagi va belgilanmagan darslar va ularning attendance'ini o'chiradi, sonini chiqaradi. **J11 roziligisiz yurgizilmaydi.** Keyin `npm run migrate -- --davomat`.

**Tayyor, qachonki:** bulutda `sana > bugun` darslar 0; hamma "kelmadi" bo'lgan dars faqat bot haqiqatan saqlaganlari; o'tgan davomat ~68%.

### W2 🔴 Vaqtinchalik bir tomonlama yangilanish (S1) — Kutadi: J10-Q2
Q2 = a (Sheets asosiy) bo'lsa:
1. `.github/workflows/sheets-yangila.yml`: `schedule` har soat, 07:00–22:00 Toshkent (UTC `0 2-17 * * *`) + qo'lda ishga tushirish. Qadamlar: `npm ci` → `npm run migrate -- --davomat`.
2. GitHub **Secrets** (Jamshid qo'yadi): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SHEETS_ID`, `GOOGLE_SA_JSON` (fayl mazmuni). Workflow `GOOGLE_SA_JSON` ni vaqtinchalik faylga yozadi, loglarga chiqmaydi.
3. Skript sinx rejimiga moslansin: Sheets'da bekor qilingan to'lov (S2) → `bekor=true`; Tugadi qo'yilgan qatnashuv → `tugadi/holat`; SOLISHTIRUV farqi — yiqitmasin, `_Bot_log` / GitHub Actions xulosasiga ogohlantirish.
4. Saytda Sheets'dan keladigan ma'lumotni tahrirlash tugmalari yashirilsin (to'lov kiritish, o'quvchi qo'shish), yuqorida: "Ma'lumot Sheets'dan har soatda yangilanadi · oxirgi: HH:MM". Oxirgi yangilanish vaqti `settings` jadvaliga yoziladi.

**Tayyor, qachonki:** Sheets'ga yozilgan to'lov bir soat ichida saytda chiqadi; ikki marta yurgizish hech narsani ikkilantirmaydi.

### W3 🟠 To'liq ikki tomonlama sinx (S1) — W2 dan keyin, alohida reja bilan
Qaror (`CLAUDE.md`): Sheets'da o'zgarsa bazaga, saytda o'zgarsa Sheets'ga. Bot hozircha Sheets'da qoladi.
1. Loyiha hujjati `docs/SINX.md`: yo'nalishlar, kalitlar (`sheets_id`: Q/T/P, S/G/U ID), manba belgisi (`manba='sheets'|'crm'`), to'qnashuv qoidasi (oxirgi yozgan yutadi / Sheets ustun).
2. Sheets → baza: Apps Script'da yangi `SINX_*` fayllar (mavjudlariga tegilmaydi): onEdit va bot yozuvidan keyin o'zgargan qatorni Supabase RPC'ga (`sinx_qabul(p_varaq, p_qator jsonb, p_sir)`) yuboradi. RPC `security definer`, maxfiy kalitni tekshiradi, `manba='sheets'` bilan upsert qiladi.
3. Baza → Sheets: `outbox` jadvali (trigger `manba='crm'` o'zgarishlarni yozadi); Apps Script har daqiqa oladi va jadvalning o'z yozuvchi funksiyalari (`bTolovYoz`, `_qatnYoz`) bilan qo'llaydi, `outbox.qollandi` ni belgilaydi.
4. Aylanib qolmaslik: Sheets'dan kelgan yozuv outbox'ga tushmaydi (`manba` bo'yicha).
5. `supabase/_test_logic.sql` ga testlar: RPC kalitsiz rad etadi, `manba` to'g'ri, outbox tsikli yo'q.

### W4 🟠 Oylik hisob qoidasi (S2) — Kutadi: J10-Q1
- Q1 = a (kalendar): Sheets formulalari (`U_Qatnashuv.js`, `F_Aniq.js`) kalendarga o'tadi → S-vazifa botda; baza o'zgarmaydi.
- Q1 = b (kelgan kuni): `0020_hisob_oyma_oy.sql`: `create_monthly_invoices` o'rniga har kuni "bugun oy-yubileyi kelgan" yozilishlarga navbatdagi oy hisobini yozadigan funksiya; `oy_raqami` DATEDIF mantig'ida. `_test_logic.sql` ga: 16.09 boshlangan — 15.10 da 1 hisob, 16.10 da 2.

**Tayyor, qachonki:** har kuni ko'chirish solishtiruvida "to'lashi kerak" sayt = Sheets.

### W5 🟡 Ochiq yo'naltirish (S3)
`src/app/kirish/page.tsx` → `keyinYol`: `\` ni ham rad eting yoki `new URL(y, 'http://x')` bilan `origin === 'http://x'` va `pathname.startsWith('/')`. `src/lib/…test.ts` ga: `/crm` ✓, `//evil.com` ✗, `/\evil.com` ✗, `https://evil.com` ✗, `/%2F%2Fevil.com` ✗.

### W6 🟡 O'tgan kun davomati (S4) — Kutadi: J10-Q5
`/crm/davomat/[guruh]?sana=YYYY-MM-DD`: ruxsat Q5 bo'yicha (bazada `davomat_saqla` tekshiradi, kodda emas). Faqat o'sha guruhning dars kuni bo'lsa ochiladi; kelajak sanasi — yo'q.

### W7 ⚪ UI (S6, S7, S8)
- Tema tugmasi `/crm/menyu` ga ham (telefon).
- `/crm/men`: o'quvchi bo'lmaganni `panelYoli(rol)` ga qaytarish.
- Woblar reytingi — Q6 bo'yicha.

### W8 🟠 CI — GitHub Actions (S10)
`.github/workflows/tekshir.yml`, `pull_request` va `push` (`main`):
1. `npm ci` → `npm test` → `npm run typecheck` → `npx eslint src scripts` → `npx next build` (kalitsiz — sayt "ulanmagan" holatida yig'iladi).
2. `db:test`: `services: postgres:17` + `supabase/_test_shim.sql` + migratsiyalar + `_test_logic.sql` (`run-local-test.sh` ning Linux yo'li).
3. Jamshid: Settings → Branches → `main` → "Require a pull request" + "Require status checks" (J3-A bilan birga).

### W9 🟠 Loginlarni ommaviy ochish (I5) — Kutadi: J2
`scripts/hisob-ommaviy.ts`: `teachers` (va xohlansa `students`) bo'yicha login (lotin, kichik harf, `src/lib/login.ts` qoidasi), vaqtinchalik parol, `app_metadata.rol`, `teachers.profile_id` / `students.profile_id` bog'lash. Natija — **faqat lokal** `.secrets/loginlar-YYYY-MM-DD.csv` (git'ga tushmaydi). `--dry-run` standart. Mavjud hisobga tegmaydi.

### W10 ⚪ Hujjatlar (S11)
- `CLAUDE.md`: "Sheets — ko'zgu" o'rniga qabul qilingan sinx qarori; bulut (Supabase `uxmmyrfzcccieuqaosts`, Frankfurt; Vercel `wba`); ish tartibi (PR, merge commit); 0016 qoidasi (yangi funksiyaga EXECUTE faqat `authenticated`, `service_role`).
- `README.md` (ishga tushirish, buyruqlar, papkalar).
- Bu faylni har vazifadan keyin yangilang.

### W11 ⚪ Domen (I8) — Kutadi: J10-Q8
Vercel → Domains: `wba.uz` (ommaviy sayt) va `app.wba.uz` (→ `/crm`, `next.config.ts` rewrite). `NEXT_PUBLIC_SITE_URL`, Supabase Site URL, `serverActions.allowedOrigins` yangilanadi.

### W12 🟡 Zaxira nusxa (I4) — Kutadi: J13
Supabase Pro bo'lmasa: GitHub Actions har kecha `pg_dump --data-only` (Supabase pooler manzili, parol — Secret) → shifrlangan artefakt (7 kun saqlanadi). Tiklash tartibi `docs/ZAXIRA.md` da.

---

## Bajarildi (19.09)
- To'liq diagnostika — `docs/DIAGNOSTIKA.md`.
- `npm run ishga`: Docker o'chiq bo'lsa yiqilishi tuzatildi (S12).
- Bulut: baza Frankfurt'da, 0001–0017, Sheets ma'lumoti ko'chirilgan (davomatdan tashqari hammasi to'g'ri — K1/K2).
- sxvs: 0016 (anon RPC teshigi), 0017 (ariza cheklovi), tema, 404/robots/sitemap.
