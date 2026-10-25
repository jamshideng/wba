-- ============================================================
--  0098 — "Darsni ko'chiring" tavsiyasini yopish (Jamshid, 25.10)
-- ============================================================
--  Dam kuniga tushgan har dars uchun jurnal ko'chirish tavsiyasini
--  chiqaradi (0081). Oyda darslar yetarli bo'lsa ko'chirish shart emas —
--  ustoz yoki admin "Kerak emas" bosadi, tavsiya shu guruh + kun uchun
--  yopiladi (jurnalda ham, nazorat xabarida ham chiqmaydi).
-- ============================================================

create table if not exists kochirish_kerakmas (
  group_id   text not null references groups (id) on delete cascade,
  sana       date not null,
  yopdi      uuid references profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (group_id, sana)
);
comment on table kochirish_kerakmas is 'Ko''chirish tavsiyasi yopilgan dam kunlari (0098). Yozish faqat kochirish_taklifini_yop orqali.';

alter table kochirish_kerakmas enable row level security;
alter table kochirish_kerakmas force row level security;
drop policy if exists kochirish_kerakmas_oqish on kochirish_kerakmas;
create policy kochirish_kerakmas_oqish on kochirish_kerakmas for select to authenticated
  using (app_is_staff() or app_teaches_group(group_id));
grant select on kochirish_kerakmas to authenticated;
grant all on kochirish_kerakmas to service_role;

create or replace function kochirish_taklifini_yop(p_group text, p_sana date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not (app_is_admin() or app_teaches_group(p_group)) then
    raise exception 'Bu guruh tavsiyasini yopish huquqingiz yo''q.';
  end if;
  insert into kochirish_kerakmas (group_id, sana) values (p_group, p_sana) on conflict do nothing;
end;
$$;
revoke execute on function kochirish_taklifini_yop(text, date) from public, anon;
grant execute on function kochirish_taklifini_yop(text, date) to authenticated;

/* kochirish_takliflari — yopilganlar chiqmaydi (joyida yamash) */
do $$
declare
  v_def text := pg_get_functiondef('kochirish_takliflari(text, text)'::regprocedure);
  v_joy text := 'and not exists (select 1 from lessons l where l.group_id = p_group and l.sana = k::date and l.kochirildi_ga is not null)';
begin
  if v_def like '%kochirish_kerakmas%' then
    return;
  end if;
  if position(v_joy in v_def) = 0 then
    raise exception 'kochirish_takliflari kutilgan ko''rinishda emas';
  end if;
  execute replace(v_def, v_joy, v_joy || E'\n    and not exists (select 1 from kochirish_kerakmas x where x.group_id = p_group and x.sana = k::date)');
end $$;
