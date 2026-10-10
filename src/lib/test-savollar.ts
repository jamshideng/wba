/**
 * Lendingdagi mini-test: fan tanlanadi, keyin bankdan 8 savol osondan qiyinga.
 * Har fanda 40 savol (jami 200): 4 qiyinlik darajasi × 10 tadan. Har urinishda
 * har darajadan 2 tadan tasodifiy savol olinadi, variantlar ham aralashtiriladi —
 * test har safar boshqacha bo'ladi (Jamshid: "200 ta test, aylantirib beraversin").
 * Bu fayl ham brauzerda (test oynasi), ham serverda (ariza) ishlatiladi —
 * daraja nomi serverda QAYTA hisoblanadi, URL'dagi matnga ishonilmaydi.
 * Arab tili ataylab yo'q (Jamshid: test kerak emas).
 */

/** d — qiyinlik: 1 eng oson … 4 eng qiyin */
export type Savol = { s: string; v: readonly [string, string, string]; t: 0 | 1 | 2; d: 1 | 2 | 3 | 4 }

export type TestFan = {
  id: string
  nom: string
  /** Natijadan keyin arizada oldindan tanlanadigan yo'nalish (markaz.ts) */
  yonalish: string
  belgi: string
  /** Savollar tili — brauzer tarjimasi buzmasin */
  til?: string
  /** Savollar banki — har qiyinlik darajasidan kamida SAVOL_SONI/4 ta */
  bank: readonly Savol[]
  darajalar: readonly { gacha: number; nom: string; izoh: string }[]
}

export const SAVOL_SONI = 8
/** Har urinishda har qiyinlik darajasidan nechta savol */
const HAR_DARAJADAN = SAVOL_SONI / 4

export const TEST_FANLAR: readonly TestFan[] = [
  {
    id: 'ingliz',
    nom: 'Ingliz tili',
    yonalish: 'ingliz-tili',
    belgi: 'Aa',
    til: 'en',
    bank: [
      { d: 1, s: 'I ___ a student.', v: ['am', 'is', 'are'], t: 0 },
      { d: 1, s: 'She ___ to school every day.', v: ['go', 'goes', 'going'], t: 1 },
      { d: 1, s: 'They ___ from Uzbekistan.', v: ['is', 'are', 'am'], t: 1 },
      { d: 1, s: 'This is ___ apple.', v: ['a', 'an', 'the'], t: 1 },
      { d: 1, s: 'How old ___ you?', v: ['are', 'is', 'do'], t: 0 },
      { d: 1, s: 'He ___ a car.', v: ['have', 'has', 'having'], t: 1 },
      { d: 1, s: 'There ___ two books on the table.', v: ['is', 'be', 'are'], t: 2 },
      { d: 1, s: 'I like ___ football.', v: ['play', 'playing', 'plays'], t: 1 },
      { d: 1, s: 'Where ___ she live?', v: ['do', 'does', 'is'], t: 1 },
      { d: 1, s: 'My sister ___ 12 years old.', v: ['is', 'has', 'are'], t: 0 },
      { d: 2, s: 'Yesterday we ___ a film.', v: ['watch', 'watched', 'have watched'], t: 1 },
      { d: 2, s: 'Look at those clouds! It ___ rain.', v: ['is going to', 'goes to', 'go to'], t: 0 },
      { d: 2, s: 'We ___ TV now.', v: ['watch', 'are watching', 'watched'], t: 1 },
      { d: 2, s: 'I didn’t ___ him yesterday.', v: ['see', 'saw', 'seen'], t: 0 },
      { d: 2, s: 'She is ___ than her brother.', v: ['tall', 'taller', 'tallest'], t: 1 },
      { d: 2, s: 'There isn’t ___ milk in the fridge.', v: ['some', 'any', 'many'], t: 1 },
      { d: 2, s: 'Can you ___ me the salt, please?', v: ['pass', 'passing', 'passed'], t: 0 },
      { d: 2, s: 'He ___ his homework yet.', v: ['didn’t finish', 'hasn’t finished', 'doesn’t finish'], t: 1 },
      { d: 2, s: 'What ___ you do last weekend?', v: ['do', 'did', 'have'], t: 1 },
      { d: 2, s: 'This is the ___ film I have ever seen.', v: ['good', 'better', 'best'], t: 2 },
      { d: 3, s: 'I have lived in Tashkent ___ 2018.', v: ['for', 'since', 'from'], t: 1 },
      { d: 3, s: 'This book ___ by millions of people.', v: ['has read', 'has been read', 'was reading'], t: 1 },
      { d: 3, s: 'While I ___ a shower, the phone rang.', v: ['had', 'was having', 'have had'], t: 1 },
      { d: 3, s: 'You ___ smoke here. It’s forbidden.', v: ['mustn’t', 'don’t have to', 'needn’t'], t: 0 },
      { d: 3, s: 'English ___ in many countries.', v: ['speaks', 'is spoken', 'is speaking'], t: 1 },
      { d: 3, s: 'I’m looking forward ___ you.', v: ['to see', 'to seeing', 'seeing'], t: 1 },
      { d: 3, s: 'She asked me where I ___.', v: ['live', 'lived', 'do live'], t: 1 },
      { d: 3, s: 'If it ___ tomorrow, we will stay at home.', v: ['rains', 'will rain', 'rained'], t: 0 },
      { d: 3, s: 'He has been working here ___ five years.', v: ['since', 'for', 'during'], t: 1 },
      { d: 3, s: 'I wish I ___ more free time.', v: ['have', 'had', 'will have'], t: 1 },
      { d: 4, s: 'If I ___ you, I would accept the offer.', v: ['am', 'were', 'will be'], t: 1 },
      { d: 4, s: 'Hardly ___ the door when the phone rang.', v: ['I had opened', 'had I opened', 'I opened'], t: 1 },
      { d: 4, s: 'By next year, she ___ her degree.', v: ['will finish', 'will have finished', 'finishes'], t: 1 },
      { d: 4, s: 'Not only ___ late, but he also forgot the tickets.', v: ['he was', 'was he', 'he is'], t: 1 },
      { d: 4, s: 'I’d rather you ___ smoke in the car.', v: ['don’t', 'didn’t', 'won’t'], t: 1 },
      { d: 4, s: 'It’s high time we ___.', v: ['leave', 'left', 'will leave'], t: 1 },
      { d: 4, s: 'He denied ___ the window.', v: ['to break', 'breaking', 'broke'], t: 1 },
      { d: 4, s: 'The more you practise, ___ you get.', v: ['the better', 'better', 'the best'], t: 0 },
      { d: 4, s: 'Had I known, I ___ you.', v: ['would tell', 'would have told', 'will tell'], t: 1 },
      { d: 4, s: 'She is used to ___ up early.', v: ['get', 'getting', 'got'], t: 1 },
    ],
    darajalar: [
      { gacha: 2, nom: 'Beginner', izoh: 'Asoslardan boshlaymiz — yaxshi start nuqtasi.' },
      { gacha: 4, nom: 'Elementary', izoh: 'Grammatika tanish. Endi so‘z boyligi va nutq.' },
      { gacha: 6, nom: 'Pre-Intermediate', izoh: 'Poydevor bor. Murakkab zamonlar va erkin nutq.' },
      { gacha: 7, nom: 'Intermediate', izoh: 'Kuchli daraja — IELTS sari to‘g‘ri yo‘ldasiz.' },
      { gacha: 8, nom: 'Pre-IELTS', izoh: 'A’lo! IELTS tayyorgarligini boshlash mumkin.' },
    ],
  },
  {
    id: 'rus',
    nom: 'Rus tili',
    yonalish: 'rus-tili',
    belgi: 'Бб',
    til: 'ru',
    bank: [
      { d: 1, s: 'Как тебя ___?', v: ['зовут', 'зовёт', 'звать'], t: 0 },
      { d: 1, s: 'Я ___ в школе.', v: ['учишься', 'учусь', 'учится'], t: 1 },
      { d: 1, s: 'Это ___ книга.', v: ['мой', 'моя', 'моё'], t: 1 },
      { d: 1, s: 'Он ___ в футбол.', v: ['играю', 'играет', 'играешь'], t: 1 },
      { d: 1, s: 'Сколько ___ лет?', v: ['тебе', 'ты', 'тебя'], t: 0 },
      { d: 1, s: 'Я живу ___ Ташкенте.', v: ['на', 'в', 'к'], t: 1 },
      { d: 1, s: 'Мы ___ чай.', v: ['пьём', 'пьёт', 'пьют'], t: 0 },
      { d: 1, s: 'У меня ___ сестра.', v: ['есть', 'быть', 'был'], t: 0 },
      { d: 1, s: 'Сегодня ___ погода.', v: ['хороший', 'хорошая', 'хорошее'], t: 1 },
      { d: 1, s: 'Где ___ мама?', v: ['твой', 'твоя', 'твоё'], t: 1 },
      { d: 2, s: 'Мы идём ___ парк.', v: ['на', 'к', 'в'], t: 2 },
      { d: 2, s: 'У меня нет ___.', v: ['брат', 'брата', 'брату'], t: 1 },
      { d: 2, s: 'Я иду ___ врачу.', v: ['в', 'к', 'на'], t: 1 },
      { d: 2, s: 'Он часто говорит ___ брате.', v: ['о', 'об', 'про'], t: 0 },
      { d: 2, s: 'Я пишу ___.', v: ['ручка', 'ручкой', 'ручку'], t: 1 },
      { d: 2, s: 'Вчера мы были ___ концерте.', v: ['в', 'на', 'у'], t: 1 },
      { d: 2, s: 'В классе много ___.', v: ['ученики', 'учеников', 'ученикам'], t: 1 },
      { d: 2, s: 'Завтра я ___ домашнее задание.', v: ['сделал', 'сделаю', 'делал'], t: 1 },
      { d: 2, s: 'Она ___ в Москву каждый год.', v: ['ездит', 'едет', 'поехала'], t: 0 },
      { d: 2, s: 'Мне очень ___ этот фильм.', v: ['нравлюсь', 'нравится', 'нравятся'], t: 1 },
      { d: 3, s: 'Вчера она ___ эту книгу до конца.', v: ['прочитала', 'читает', 'прочитает'], t: 0 },
      { d: 3, s: 'Я подарил цветы ___.', v: ['мама', 'маму', 'маме'], t: 2 },
      { d: 3, s: 'Я горжусь ___.', v: ['сын', 'сыном', 'сыну'], t: 1 },
      { d: 3, s: 'Он вошёл ___ комнату.', v: ['в', 'на', 'из'], t: 0 },
      { d: 3, s: 'Когда я ___ уроки, я пойду гулять.', v: ['сделаю', 'делаю', 'сделал'], t: 0 },
      { d: 3, s: 'Мы долго говорили ___ телефону.', v: ['на', 'по', 'в'], t: 1 },
      { d: 3, s: 'Она не пришла, ___ заболела.', v: ['поэтому', 'потому что', 'чтобы'], t: 1 },
      { d: 3, s: 'Нам нужно ___ билеты заранее.', v: ['купить', 'покупал', 'купим'], t: 0 },
      { d: 3, s: 'Это дом, ___ я родился.', v: ['где', 'куда', 'откуда'], t: 0 },
      { d: 3, s: 'Я ждал тебя целых ___ часа.', v: ['два', 'двух', 'двумя'], t: 0 },
      { d: 4, s: 'Если бы я знал, я бы ___.', v: ['пришёл', 'приду', 'прихожу'], t: 0 },
      { d: 4, s: 'Книга, ___ я читаю, очень интересная.', v: ['который', 'которую', 'которая'], t: 1 },
      { d: 4, s: 'Несмотря ___ дождь, мы пошли гулять.', v: ['на', 'в', 'о'], t: 0 },
      { d: 4, s: 'Я хочу, чтобы ты ___ раньше.', v: ['придёшь', 'пришёл', 'приходишь'], t: 1 },
      { d: 4, s: 'Он сделал это, ___ не обидеть друга.', v: ['чтобы', 'потому что', 'если'], t: 0 },
      { d: 4, s: 'Задача оказалась ___, чем мы думали.', v: ['сложной', 'сложнее', 'сложная'], t: 1 },
      { d: 4, s: 'Мальчик, ___ мы видели вчера, — мой сосед.', v: ['который', 'которого', 'которому'], t: 1 },
      { d: 4, s: 'Прочитав книгу, ___.', v: ['я понял её смысл', 'смысл стал понятен', 'книга понравилась'], t: 0 },
      { d: 4, s: 'Он ___ мне помочь, но не смог.', v: ['обещает', 'обещал', 'пообещает'], t: 1 },
      { d: 4, s: 'Ни один из студентов ___ на вопрос.', v: ['не ответил', 'ответил', 'не ответили'], t: 0 },
    ],
    darajalar: [
      { gacha: 2, nom: 'Noldan', izoh: 'Alifbo va o‘qishdan boshlaymiz.' },
      { gacha: 4, nom: 'Boshlang‘ich', izoh: 'Oddiy gaplar tanish. Endi kelishiklar va nutq.' },
      { gacha: 6, nom: 'O‘rta', izoh: 'Yaxshi asos bor. Erkin gapirish ustida ishlaymiz.' },
      { gacha: 8, nom: 'Yuqori', izoh: 'A’lo! Murakkab grammatika va savodli yozuv qoladi.' },
    ],
  },
  {
    id: 'turk',
    nom: 'Turk tili',
    yonalish: 'turk-tili',
    belgi: 'Çç',
    til: 'tr',
    bank: [
      { d: 1, s: 'Merhaba, benim ___ Ali.', v: ['adın', 'adım', 'adı'], t: 1 },
      { d: 1, s: 'Ben öğrenci___.', v: ['-yim', '-sin', '-dir'], t: 0 },
      { d: 1, s: 'Bu ___ kitabım.', v: ['benim', 'senin', 'onun'], t: 0 },
      { d: 1, s: 'Nasılsın? — İyiyim, ___.', v: ['teşekkürler', 'merhaba', 'güle güle'], t: 0 },
      { d: 1, s: '“Su” o‘zbekchada nima?', v: ['suv', 'non', 'olma'], t: 0 },
      { d: 1, s: 'Bir, iki, ___, dört.', v: ['beş', 'üç', 'altı'], t: 1 },
      { d: 1, s: 'Ben her sabah çay ___.', v: ['içiyorum', 'içiyorsun', 'içiyor'], t: 0 },
      { d: 1, s: '“Kitap” so‘zining ko‘pligi:', v: ['kitaplar', 'kitapler', 'kitaplır'], t: 0 },
      { d: 1, s: 'Masa___ üstünde bir kalem var.', v: ['-nın', '-nin', '-nun'], t: 0 },
      { d: 1, s: 'Ev___ bir kedi var.', v: ['-de', '-den', '-e'], t: 0 },
      { d: 2, s: 'Sen nereli___?', v: ['-im', '-iz', '-sin'], t: 2 },
      { d: 2, s: 'Her sabah okul___ gidiyorum.', v: ['-a', '-da', '-dan'], t: 0 },
      { d: 2, s: 'Biz Türkçe ___.', v: ['öğreniyoruz', 'öğreniyorlar', 'öğreniyorum'], t: 0 },
      { d: 2, s: 'Kardeşim İstanbul___ yaşıyor.', v: ['’da', '’a', '’dan'], t: 0 },
      { d: 2, s: 'Ben kahve ___, çay istiyorum.', v: ['değil', 'yok', 'hayır'], t: 0 },
      { d: 2, s: 'Sen dün nereye ___?', v: ['gittin', 'gidiyorsun', 'gideceksin'], t: 0 },
      { d: 2, s: 'Benim iki ___ var.', v: ['kardeşim', 'kardeş', 'kardeşler'], t: 0 },
      { d: 2, s: 'Ali okul___ eve geliyor.', v: ['-dan', '-a', '-da'], t: 0 },
      { d: 2, s: 'Dün annem bana bir hediye ___.', v: ['aldı', 'aldım', 'aldın'], t: 0 },
      { d: 2, s: 'Kapıyı ___ mısın, lütfen?', v: ['açar', 'açtın', 'açıyor'], t: 0 },
      { d: 3, s: 'Dün akşam sinemaya ___.', v: ['gidiyorum', 'gittim', 'gideceğim'], t: 1 },
      { d: 3, s: 'Yarın hava çok güzel ___.', v: ['oldu', 'oluyor', 'olacak'], t: 2 },
      { d: 3, s: 'Türkçe ___ istiyorum.', v: ['öğrenmek', 'öğreniyor', 'öğrendi'], t: 0 },
      { d: 3, s: 'Eğer zamanım ___, sana yardım ederim.', v: ['olursa', 'oldu', 'olacak'], t: 0 },
      { d: 3, s: 'Bu kitabı daha önce ___.', v: ['okumuştum', 'okuyorum', 'okuyacağım'], t: 0 },
      { d: 3, s: 'Ödevimi bitir___ sonra dışarı çıktım.', v: ['-dikten', '-ince', '-meden'], t: 0 },
      { d: 3, s: 'Bu sınıfın ___ öğrencisi Ayşe.', v: ['en çalışkan', 'daha çalışkan', 'çalışkanlar'], t: 0 },
      { d: 3, s: 'Çok yorgunum, ___ uyumak istiyorum.', v: ['çünkü', 'bu yüzden', 'ama'], t: 1 },
      { d: 3, s: 'Bu işi senin ___ istiyorum.', v: ['yapmanı', 'yapmak', 'yaptın'], t: 0 },
      { d: 3, s: 'Bu mektup dün ___.', v: ['yazıldı', 'yazdı', 'yazıyor'], t: 0 },
      { d: 4, s: 'Ev___ çıkınca sana yazarım.', v: ['-den', '-e', '-de'], t: 0 },
      { d: 4, s: 'Keşke daha erken ___!', v: ['geldin', 'gelseydin', 'geleceksin'], t: 1 },
      { d: 4, s: 'Keşke Türkçeyi daha iyi ___.', v: ['bilsem', 'bilirim', 'bildim'], t: 0 },
      { d: 4, s: 'Ders çalış___ sınavı geçemezsin.', v: ['-mazsan', '-ırsan', '-tığın'], t: 0 },
      { d: 4, s: 'Eve gelir gelmez seni ___.', v: ['arayacağım', 'aradım', 'arıyordum'], t: 0 },
      { d: 4, s: 'Ali yarın ___ söyledi.', v: ['geleceğini', 'gelecek', 'gelmek'], t: 0 },
      { d: 4, s: 'Yağmur yağ___ için maç ertelendi.', v: ['-dığı', '-acak', '-mış'], t: 0 },
      { d: 4, s: 'Ne kadar çok çalış___, o kadar başarılı olursun.', v: ['-ırsan', '-tın', '-acak'], t: 0 },
      { d: 4, s: 'Bu filmi ___ hiç görmedim.', v: ['şimdiye kadar', 'yarın', 'birazdan'], t: 0 },
      { d: 4, s: 'Toplantı başla___ önce telefonunu kapat.', v: ['-madan', '-dıktan', '-ınca'], t: 0 },
    ],
    darajalar: [
      { gacha: 2, nom: 'Noldan', izoh: 'Asosiy so‘z va qo‘shimchalardan boshlaymiz.' },
      { gacha: 4, nom: 'Boshlang‘ich', izoh: 'Oddiy gaplar tanish. Zamonlar ustida ishlaymiz.' },
      { gacha: 6, nom: 'O‘rta', izoh: 'Yaxshi asos bor. Erkin nutq sari.' },
      { gacha: 8, nom: 'Yuqori', izoh: 'A’lo! Murakkab qurilmalar va suhbat qoladi.' },
    ],
  },
  {
    id: 'matematika',
    nom: 'Matematika',
    yonalish: 'matematika',
    belgi: 'π',
    bank: [
      { d: 1, s: '7 × 8 = ?', v: ['54', '56', '64'], t: 1 },
      { d: 1, s: '144 : 12 = ?', v: ['12', '11', '14'], t: 0 },
      { d: 1, s: '25 + 37 = ?', v: ['52', '62', '63'], t: 1 },
      { d: 1, s: '100 − 46 = ?', v: ['54', '64', '56'], t: 0 },
      { d: 1, s: '9 × 6 = ?', v: ['54', '56', '45'], t: 0 },
      { d: 1, s: '81 : 9 = ?', v: ['8', '9', '7'], t: 1 },
      { d: 1, s: '15 + 15 : 3 = ?', v: ['10', '20', '15'], t: 1 },
      { d: 1, s: 'Eng kichik ikki xonali son?', v: ['10', '11', '99'], t: 0 },
      { d: 1, s: '0,5 + 0,25 = ?', v: ['0,30', '0,75', '0,7'], t: 1 },
      { d: 1, s: 'Uchburchak burchaklari yig‘indisi?', v: ['90°', '360°', '180°'], t: 2 },
      { d: 2, s: '3/4 + 1/8 = ?', v: ['4/12', '7/8', '1'], t: 1 },
      { d: 2, s: '2x + 5 = 17. x = ?', v: ['11', '5', '6'], t: 2 },
      { d: 2, s: '2/3 × 3/4 = ?', v: ['1/2', '5/7', '6/7'], t: 0 },
      { d: 2, s: '(−3) × (−4) = ?', v: ['−12', '12', '7'], t: 1 },
      { d: 2, s: '3x − 7 = 8. x = ?', v: ['5', '3', '1/3'], t: 0 },
      { d: 2, s: '2³ + 3² = ?', v: ['17', '12', '15'], t: 0 },
      { d: 2, s: '0,2 × 0,3 = ?', v: ['0,6', '0,06', '0,006'], t: 1 },
      { d: 2, s: 'Aylana diametri 10. Radiusi = ?', v: ['20', '5', '10π'], t: 1 },
      { d: 2, s: '1 soat = ? sekund', v: ['600', '3600', '360'], t: 1 },
      { d: 2, s: '45 ning 1/5 qismi = ?', v: ['9', '5', '15'], t: 0 },
      { d: 3, s: '200 ning 15% i = ?', v: ['30', '15', '20'], t: 0 },
      { d: 3, s: 'Kvadrat perimetri 20 sm. Yuzi = ?', v: ['20 sm²', '25 sm²', '16 sm²'], t: 1 },
      { d: 3, s: '√144 + √25 = ?', v: ['17', '13', '169'], t: 0 },
      { d: 3, s: 'Katetlari 3 va 4 bo‘lgan to‘g‘ri burchakli uchburchak gipotenuzasi?', v: ['5', '7', '6'], t: 0 },
      { d: 3, s: '(a + b)² = ?', v: ['a² + b²', 'a² + 2ab + b²', '2a + 2b'], t: 1 },
      { d: 3, s: 'Narx 20% oshib, 120 so‘m bo‘ldi. Avvalgi narx?', v: ['96', '100', '140'], t: 1 },
      { d: 3, s: '2x + 3y = 12 va x = 3. y = ?', v: ['2', '3', '6'], t: 0 },
      { d: 3, s: 'Arifmetik progressiya 3, 7, 11, … 10-hadi?', v: ['39', '43', '40'], t: 0 },
      { d: 3, s: 'y = 2x + 1 grafigi Oy o‘qini qaysi nuqtada kesadi?', v: ['(0; 1)', '(1; 0)', '(0; 2)'], t: 0 },
      { d: 3, s: '5! = ?', v: ['25', '120', '60'], t: 1 },
      { d: 4, s: 'x² − 5x + 6 = 0. Ildizlar yig‘indisi = ?', v: ['−5', '6', '5'], t: 2 },
      { d: 4, s: 'log₂ 32 = ?', v: ['5', '16', '6'], t: 0 },
      { d: 4, s: 'sin 30° = ?', v: ['1/2', '√3/2', '1'], t: 0 },
      { d: 4, s: '|x − 3| = 5. Ildizlar ko‘paytmasi = ?', v: ['−16', '16', '15'], t: 0 },
      { d: 4, s: '2ˣ = 64. x = ?', v: ['6', '8', '32'], t: 0 },
      { d: 4, s: 'lg 1000 = ?', v: ['3', '100', '10'], t: 0 },
      { d: 4, s: 'f(x) = x³. f′(2) = ?', v: ['8', '12', '6'], t: 1 },
      { d: 4, s: 'Geometrik progressiya 2, 6, 18, … 5-hadi?', v: ['54', '162', '486'], t: 1 },
      { d: 4, s: 'x² − 9 < 0 tengsizlik yechimi?', v: ['(−3; 3)', 'x > 3', 'x < −3'], t: 0 },
      { d: 4, s: '∫₀² 2x dx = ?', v: ['4', '2', '8'], t: 0 },
    ],
    darajalar: [
      { gacha: 2, nom: 'Asoslar', izoh: 'Arifmetikani mustahkamlaymiz.' },
      { gacha: 4, nom: 'Maktab dasturi', izoh: 'Kasrlar, tenglamalar va masalalar.' },
      { gacha: 6, nom: 'Milliy sertifikat sari', izoh: 'Kuchli asos bor — sertifikatga tayyorlov.' },
      { gacha: 8, nom: 'DTM darajasi', izoh: 'A’lo! DTM va olimpiada masalalari qoladi.' },
    ],
  },
  {
    id: 'it',
    nom: 'AI & IT',
    yonalish: 'ai-it',
    belgi: 'AI',
    bank: [
      { d: 1, s: '“Ctrl + C” nima qiladi?', v: ['O‘chiradi', 'Nusxa oladi', 'Saqlaydi'], t: 1 },
      { d: 1, s: 'Brauzer — bu…', v: ['saytlarni ochadigan dastur', 'antivirus', 'printer'], t: 0 },
      { d: 1, s: '“Ctrl + V” nima qiladi?', v: ['Qo‘yadi', 'Nusxa oladi', 'Yopadi'], t: 0 },
      { d: 1, s: '“Ctrl + Z” nima qiladi?', v: ['Saqlaydi', 'Oxirgi amalni bekor qiladi', 'Chop etadi'], t: 1 },
      { d: 1, s: 'Klaviatura — bu…', v: ['kiritish qurilmasi', 'chiqarish qurilmasi', 'xotira'], t: 0 },
      { d: 1, s: 'Matn yozish uchun qaysi dastur?', v: ['Word', 'Paint', 'Kalkulyator'], t: 0 },
      { d: 1, s: 'Fayl nomidagi “.jpg” — bu…', v: ['rasm', 'musiqa', 'matn hujjati'], t: 0 },
      { d: 1, s: 'Wi-Fi nima uchun kerak?', v: ['simsiz internet uchun', 'chop etish uchun', 'rasm chizish uchun'], t: 0 },
      { d: 1, s: 'Kompyuterning “miyasi” qaysi qism?', v: ['Monitor', 'Protsessor', 'Sichqoncha'], t: 1 },
      { d: 1, s: 'Jadvallar bilan ishlaydigan dastur?', v: ['Excel', 'Word', 'Chrome'], t: 0 },
      { d: 2, s: 'ChatGPT — bu…', v: ['ijtimoiy tarmoq', 'o‘yin', 'sun’iy intellekt yordamchisi'], t: 2 },
      { d: 2, s: 'Veb-sahifa tuzilishi qaysi tilda yoziladi?', v: ['HTML', 'Excel', 'PDF'], t: 0 },
      { d: 2, s: '1 bayt necha bitga teng?', v: ['8', '10', '16'], t: 0 },
      { d: 2, s: 'Eng kuchli parol qaysi?', v: ['12345678', 'qwerty', 'T7#mq!9Lp2'], t: 2 },
      { d: 2, s: 'Fishing (phishing) — bu…', v: ['aldov bilan parol o‘g‘irlash', 'baliq ovlash o‘yini', 'antivirus'], t: 0 },
      { d: 2, s: 'HTML’da eng katta sarlavha tegi?', v: ['<h1>', '<p>', '<img>'], t: 0 },
      { d: 2, s: 'URL — bu…', v: ['sayt manzili', 'fayl turi', 'dastur nomi'], t: 0 },
      { d: 2, s: 'Bulut (cloud) xotirasi — bu…', v: ['internetdagi serverlarda saqlash', 'kompyuter keshi', 'fleshka'], t: 0 },
      { d: 2, s: 'Excel’da formula qaysi belgidan boshlanadi?', v: ['=', '#', '@'], t: 0 },
      { d: 2, s: 'Ikki bosqichli autentifikatsiya nima beradi?', v: ['akkauntni qo‘shimcha himoya qiladi', 'internetni tezlashtiradi', 'xotirani tozalaydi'], t: 0 },
      { d: 3, s: 'CSS nima uchun kerak?', v: ['ma’lumot saqlash', 'sahifa ko‘rinishi uchun', 'internetga ulanish'], t: 1 },
      { d: 3, s: 'Algoritm — bu…', v: ['kompyuter turi', 'virus', 'masala yechish qadamlari'], t: 2 },
      { d: 3, s: 'Ikkilik sanoq tizimida 5 qanday yoziladi?', v: ['101', '110', '111'], t: 0 },
      { d: 3, s: 'Python’da print(3 * "ab") natijasi?', v: ['ababab', '3ab', 'xato'], t: 0 },
      { d: 3, s: 'IP-manzil nima uchun kerak?', v: ['tarmoqdagi qurilmani aniqlash', 'parol saqlash', 'sayt dizayni'], t: 0 },
      { d: 3, s: 'Qaysi biri dasturlash tili?', v: ['Python', 'Photoshop', 'Windows'], t: 0 },
      { d: 3, s: 'Sikl (loop) nima qiladi?', v: ['amallarni takrorlaydi', 'dasturni yopadi', 'faylni o‘chiradi'], t: 0 },
      { d: 3, s: 'Ma’lumotlar bazasi bilan ishlash tili?', v: ['SQL', 'CSS', 'HTML'], t: 0 },
      { d: 3, s: 'Ochiq Wi-Fi’da nima qilish xavfli?', v: ['bank kartasi ma’lumotini kiritish', 'yangiliklarni o‘qish', 'ob-havoni ko‘rish'], t: 0 },
      { d: 3, s: 'if / else nima uchun kerak?', v: ['shartga qarab tanlash', 'takrorlash', 'rasm chizish'], t: 0 },
      { d: 4, s: 'AI’dan aniq javob olish uchun nima muhim?', v: ['aniq va batafsil so‘rov', 'katta harflar', 'qisqa so‘z'], t: 0 },
      { d: 4, s: 'JavaScript’da 2 + "2" = ?', v: ['4', '"22"', 'xato'], t: 1 },
      { d: 4, s: 'Python’da len("salom") = ?', v: ['5', '4', '6'], t: 0 },
      { d: 4, s: 'JavaScript’da typeof [] = ?', v: ['"array"', '"object"', '"list"'], t: 1 },
      { d: 4, s: 'Python’da 7 // 2 = ?', v: ['3.5', '3', '4'], t: 1 },
      { d: 4, s: 'Git nima uchun kerak?', v: ['kod versiyalarini boshqarish', 'sayt dizayni', 'antivirus'], t: 0 },
      { d: 4, s: 'API — bu…', v: ['dasturlar o‘zaro bog‘lanadigan interfeys', 'dasturlash tili', 'brauzer'], t: 0 },
      { d: 4, s: 'Python’da [1, 2, 3][-1] = ?', v: ['1', '3', 'xato'], t: 1 },
      { d: 4, s: 'AI’dagi “gallyutsinatsiya” — bu…', v: ['ishonchli ko‘rinadigan, lekin noto‘g‘ri javob', 'tez ishlash', 'rasm chizish'], t: 0 },
      { d: 4, s: 'O(n²) algoritmda kirish 2 barobar oshsa, vaqt…', v: ['~4 barobar oshadi', 'o‘zgarmaydi', '2 barobar kamayadi'], t: 0 },
    ],
    darajalar: [
      { gacha: 2, nom: 'Noldan', izoh: 'Kompyuter savodxonligidan boshlaymiz.' },
      { gacha: 4, nom: 'Boshlang‘ich', izoh: 'Asoslar bor. AI vositalari va birinchi sahifa.' },
      { gacha: 6, nom: 'O‘rta', izoh: 'Yaxshi! Avtomatlashtirish va kod yozishga o‘tamiz.' },
      { gacha: 8, nom: 'Yuqori', izoh: 'A’lo! Real loyihalar va vibe-coding qoladi.' },
    ],
  },
]

export function testFan(id: string | undefined | null): TestFan | undefined {
  return TEST_FANLAR.find((f) => f.id === id)
}

/** Fisher–Yates: yangi aralashtirilgan nusxa (asl massiv o'zgarmaydi) */
function aralash<T>(xs: readonly T[], tasodif: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(tasodif() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Variantlarni aralashtiradi, to'g'ri javob indeksini yangilaydi */
function variantlarniAralash(q: Savol, tasodif: () => number): Savol {
  const tartib = aralash([0, 1, 2] as const, tasodif)
  const v = [q.v[tartib[0]], q.v[tartib[1]], q.v[tartib[2]]] as const
  return { ...q, v, t: tartib.indexOf(q.t) as Savol['t'] }
}

/**
 * Bitta urinish uchun savollar: har qiyinlikdan HAR_DARAJADAN tadan tasodifiy,
 * osondan qiyinga tartibda, variantlar aralashtirilgan. Faqat brauzerda
 * (fan tanlanganda) chaqiriladi — SSR bilan nomuvofiqlik yo'q.
 */
export function testTanla(fan: TestFan, tasodif: () => number = Math.random): Savol[] {
  return ([1, 2, 3, 4] as const).flatMap((d) =>
    aralash(
      fan.bank.filter((q) => q.d === d),
      tasodif,
    )
      .slice(0, HAR_DARAJADAN)
      .map((q) => variantlarniAralash(q, tasodif)),
  )
}

/** To'g'ri javoblar soni → daraja. Diapazondan tashqari son chegaraga suriladi. */
export function testDaraja(fan: TestFan, togri: number): { nom: string; izoh: string } {
  const n = Math.max(0, Math.min(SAVOL_SONI, Math.round(togri)))
  return fan.darajalar.find((d) => n <= d.gacha) ?? fan.darajalar[fan.darajalar.length - 1]
}

export function testFoiz(togri: number, jami: number): number {
  if (jami <= 0) return 0
  return Math.round((Math.max(0, Math.min(jami, togri)) / jami) * 100)
}
