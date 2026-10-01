-- ============================================================
--  0043 — Woblar market: mahsulotni butunlay o'chirish
--
--  Avval buyurtmasi bor mahsulotni o'chirib bo'lmasdi (reward_id
--  "on delete restrict"). Endi:
--    · ochiq buyurtmalar (buyurtma / kutilmoqda) bekor qilinadi —
--      woblar o'quvchiga qaytadi;
--    · berilgan va bekor buyurtmalar TARIX bo'lib qoladi: reward_id
--      bo'shaydi, nomi (mahsulot_nomi) saqlanadi. Ular o'chirilsa,
--      sarflangan woblar balansga "qaytib" qolardi;
--    · mahsulot qatori o'chadi (rasmlarini ilova Storage'dan o'chiradi).
-- ============================================================

alter table woblr_redemptions alter column reward_id drop not null;
alter table woblr_redemptions drop constraint if exists woblr_redemptions_reward_id_fkey;
alter table woblr_redemptions add constraint woblr_redemptions_reward_id_fkey
  foreign key (reward_id) references woblr_rewards (id) on delete set null;

-- Eski yozuvlarda ham nom bo'lsin (tarixda "Mahsulot" emas, asl nomi ko'rinsin)
update woblr_redemptions r
   set mahsulot_nomi = w.nom
  from woblr_rewards w
 where w.id = r.reward_id and r.mahsulot_nomi is null;

-- Qaytadi: bekor qilingan buyurtmalar (o'quvchi, kod) — xabar uchun
create or replace function market_mahsulot_ochir(p_reward uuid)
returns table (student_id text, kod text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Mahsulotni faqat admin yoki direktor o''chiradi.';
  end if;
  if not exists (select 1 from woblr_rewards where id = p_reward) then
    raise exception 'Mahsulot topilmadi.';
  end if;

  -- 1) ochiq buyurtmalar bekor (woblar balansga qaytadi: balans bekorlarni sanamaydi)
  return query
    update woblr_redemptions r
       set holat = 'bekor', bekor_sabab = 'Mahsulot marketdan olib tashlandi', bekor_qildi = auth.uid()
     where r.reward_id = p_reward and r.holat in ('buyurtma', 'kutilmoqda')
    returning r.student_id, r.kod;

  -- 2) mahsulot o'chadi — tarixdagi buyurtmalarda reward_id bo'shaydi (nomi qoladi)
  delete from woblr_rewards where id = p_reward;
end;
$$;

revoke execute on function market_mahsulot_ochir(uuid) from public, anon;
grant execute on function market_mahsulot_ochir(uuid) to authenticated;
