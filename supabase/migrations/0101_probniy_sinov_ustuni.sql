-- ============================================================
--  0101 — Probniy jurnalda faqat "Sinov darsi" ustunidan (Jamshid, 25.10)
-- ============================================================
--  Avval jurnal probniyni guruhga qarab ko'rsatardi: "Yangi"/"Bog'lanildi"
--  dagi, lekin guruhi tanlangan lid ham chiqardi, kataklar esa lid
--  yaratilgan kundan ochilardi.
--  Endi: lid "Sinov darsi" bosqichida bo'lsa (o'quvchi emas, yo'qotilmagan,
--  sinov kuni bor yoki 'keldi') va guruhi bo'lsa — jurnalda; kataklar shu
--  ustunga O'TKAZILGAN kundan ochiladi (sinov kuni undan oldin bo'lsa — o'sha kundan).
--    leads.sinov_otkazildi — trigger o'zi yozadi: ustunga kirganda — bugun,
--    chiqib ketganda ("Yangi"/"Bog'lanildi"ga qaytsa) — null.
--  Mavjud lidlar uchun sana audit_log dan tiklanadi.
-- ============================================================

alter table leads add column if not exists sinov_otkazildi date;
comment on column leads.sinov_otkazildi is
  'Lid "Sinov darsi" ustuniga o''tkazilgan kun (0101). Jurnalda probniy kataklari shundan ochiladi.';

/* Lid kanbanda "Sinov darsi" bosqichidami (src/lib/lidlar.ts bosqichi() bilan bir xil) */
create or replace function lid_sinovdami(l leads) returns boolean
language sql immutable as $$
  select l.student_id is null
     and l.holat not in ('yozildi', 'rad', 'kelmadi')
     and (l.holat = 'keldi' or l.sinov_sana is not null)
$$;

create or replace function leads_sinov_otkazildi() returns trigger
language plpgsql set search_path = public as $$
begin
  if lid_sinovdami(new) then
    if tg_op = 'INSERT' or not lid_sinovdami(old) or new.sinov_otkazildi is null then
      new.sinov_otkazildi := coalesce(
        case when tg_op = 'UPDATE' and lid_sinovdami(old) then old.sinov_otkazildi end,
        bugun_toshkent());
    end if;
  elsif new.holat in ('yangi', 'qongiroq') then
    new.sinov_otkazildi := null;   -- orqaga qaytarildi
  end if;
  return new;
end;
$$;

drop trigger if exists leads_sinov_otkazildi on leads;
create trigger leads_sinov_otkazildi before insert or update on leads
  for each row execute function leads_sinov_otkazildi();

/* Mavjud "Sinov darsi" lidlari: audit_log dan oxirgi marta shu ustunga kirgan kun */
update leads l
   set sinov_otkazildi = coalesce((
         select (a.created_at at time zone 'Asia/Tashkent')::date
         from audit_log a
         where a.jadval = 'leads' and a.obyekt_id = l.id::text
           and (a.yangi ->> 'holat' = 'keldi' or a.yangi ->> 'sinov_sana' is not null)
           and (a.amal = 'INSERT' or a.eski is null
                or not (a.eski ->> 'holat' = 'keldi' or a.eski ->> 'sinov_sana' is not null))
         order by a.created_at desc
         limit 1),
       (l.created_at at time zone 'Asia/Tashkent')::date)
 where lid_sinovdami(l) and l.sinov_otkazildi is null;

/* Jurnal: faqat "Sinov darsi"dagi, guruhi bor lidlar; kataklar o'tkazilgan (yoki sinov) kundan */
create or replace function jurnal_probniylar(p_group text, p_dan date, p_gacha date)
returns table (lead_id uuid, ism text, dan date, belgilar jsonb)
language sql stable security definer set search_path = public as $$
  select l.id, l.ism,
         least(coalesce(l.sinov_otkazildi, (l.created_at at time zone 'Asia/Tashkent')::date),
               coalesce(l.sinov_sana, 'infinity'::date)),
         coalesce((
           select jsonb_object_agg(ls.sana::text, pd.holat)
           from probniy_davomat pd
           join lessons ls on ls.id = pd.lesson_id
           where pd.lead_id = l.id and ls.sana between p_dan and p_gacha
         ), '{}'::jsonb)
  from leads l
  where l.group_id = p_group
    and lid_sinovdami(l)
    and least(coalesce(l.sinov_otkazildi, (l.created_at at time zone 'Asia/Tashkent')::date),
              coalesce(l.sinov_sana, 'infinity'::date)) <= p_gacha
    and (app_is_staff() or app_teaches_group(p_group) or auth.uid() is null)
  order by l.ism
$$;
