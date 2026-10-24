-- ============================================================
--  0094 — Bildirishnoma: "ilovani o'rnatmaganlarga" (Jamshid, 24.10)
-- ============================================================
--  filtr {"ilova_yoq": true} — xabar ilova (o'rnatilgan PWA) ichida
--  ko'rsatilmaydi, faqat brauzerda ochganlarga chiqadi. Kim ilovada
--  ekanini faqat brauzer biladi — shuning uchun belgi ro'yxatga qo'shiladi,
--  saralash klientda (components/bildirishnomalar.tsx).
-- ============================================================

create or replace function mening_bildirishnomalarim()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.muhim desc, x.created_at desc), '[]'::jsonb)
  from (
    select b.id, b.turi, b.sarlavha, b.matn, b.havola, b.havola_matn, b.muhim,
           b.kop_tanlov, b.natija_ochiq, b.created_at,
           coalesce((b.filtr ->> 'ilova_yoq')::boolean, false) as ilova_yoq,
           h.korildi_at is not null as korilgan,
           h.yopildi_at is not null as yopilgan,
           exists (select 1 from bildirishnoma_javoblar j where j.bildirishnoma_id = b.id and j.profile_id = auth.uid()) as javob_berdim,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', s.id, 'matn', s.matn, 'kop_tanlov', s.kop_tanlov,
                       'variantlar', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'matn', v.matn) order by v.tartib, v.id)
                                               from bildirishnoma_variantlar v where v.savol_id = s.id), '[]'::jsonb))
                     order by s.tartib, s.id)
                     from bildirishnoma_savollar s where s.bildirishnoma_id = b.id), '[]'::jsonb) as savollar
    from bildirishnomalar b
    left join bildirishnoma_holat h on h.bildirishnoma_id = b.id and h.profile_id = auth.uid()
    where auth.uid() is not null
      and b.holat = 'faol' and b.boshlanish <= now() and (b.tugash is null or b.tugash > now())
      and bildirishnoma_menga(b.kimga, b.filtr)
    order by b.created_at desc
    limit 30
  ) x
$$;
