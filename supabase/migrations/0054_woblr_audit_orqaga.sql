-- 0054: 0053 dan OLDIN berilgan woblar ham Auditda ko'rinsin.
-- Har woblr qatori uchun bitta INSERT yozuvi — o'z vaqti (created_at) va
-- bergan odami (bergan_profile) bilan. Qayta ishga tushsa takrorlamaydi.

insert into audit_log (profile_id, amal, jadval, obyekt_id, eski, yangi, created_at)
select w.bergan_profile, 'INSERT', 'woblr', w.id::text, null, to_jsonb(w), w.created_at
from woblr w
where not exists (
  select 1 from audit_log a where a.jadval = 'woblr' and a.obyekt_id = w.id::text
)
order by w.created_at, w.id;
