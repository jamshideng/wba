-- 0113 — lid holati 'xato' (adashib kiritilgan). Yangi enum qiymati shu tranzaksiyada
-- ishlatilmaydi, shuning uchun alohida migratsiya; mantiq 0114 da.
alter type lead_status add value if not exists 'xato';
