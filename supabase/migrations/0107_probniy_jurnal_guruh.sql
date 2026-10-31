-- ============================================================
--  0107 — Probniy jurnali: belgilar faqat shu guruh darslaridan (Jamshid, 31.10)
-- ============================================================
--  Sinovdagi bola boshqa guruhga o'tkazilsa, eski guruhdagi belgilari yangi
--  ustoz jurnalida sana bo'yicha chiqib qolardi. Belgilar o'chmaydi
--  (probniy_davomat), faqat o'z guruhi jurnalida o'qiladi.
-- ============================================================

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
           where pd.lead_id = l.id and ls.group_id = p_group and ls.sana between p_dan and p_gacha
         ), '{}'::jsonb)
  from leads l
  where l.group_id = p_group
    and lid_sinovdami(l)
    and least(coalesce(l.sinov_otkazildi, (l.created_at at time zone 'Asia/Tashkent')::date),
              coalesce(l.sinov_sana, 'infinity'::date)) <= p_gacha
    and (app_is_staff() or app_teaches_group(p_group) or auth.uid() is null)
  order by l.ism
$$;
