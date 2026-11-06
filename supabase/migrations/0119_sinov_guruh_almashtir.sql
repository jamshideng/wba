-- ============================================================
--  0119 — Sinovdagi bolaning guruhini almashtirish, o'tgan sana bilan (Jamshid, 05.11)
-- ============================================================
--  Sinov darsidagi bola (lid, hali o'quvchi emas) guruhlarni, ustozlarni
--  ko'rib chiqadi — rasmiy bo'lguncha xohlagan guruhga o'ta oladi.
--  Almashtirganda sana tanlanadi, o'tgan kun ham bo'ladi:
--    * bola shu sanadan yangi guruh jurnalida (leads.guruh_dan);
--    * eski guruh jurnalidagi belgilari o'chadi — o'quvchi bo'lganda
--      eski ustoz davomatiga tushib qolmasin (probniy_doimiy hammasini ko'chiradi);
--    * rasmiy o'quvchi (student_id bor) — bu yerda emas, o'quvchi profilida
--      guruh_almashtir bilan (xato beradi).
-- ============================================================

alter table leads add column if not exists guruh_dan date;
comment on column leads.guruh_dan is
  'Sinovdagi bola joriy guruhga shu kundan (0119). Bo''sh — sinov ustuniga o''tgan kundan. Jurnal kataklari shundan ochiladi.';

create or replace function sinov_guruh_almashtir(p_lead uuid, p_group text, p_sana date)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l        leads%rowtype;
  v_ochdi  int := 0;
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Guruhni almashtirish huquqingiz yo''q.';
  end if;
  select * into l from leads where id = p_lead for update;
  if not found then
    raise exception 'Lid topilmadi.';
  end if;
  if l.student_id is not null then
    raise exception 'Bu bola rasmiy o''quvchi — guruhini o''quvchi profilidan almashtiring.';
  end if;
  if not lid_sinovdami(l) then
    raise exception 'Bola sinov darsida emas.';
  end if;
  if p_group is null or not exists (select 1 from groups where id = p_group and holat = 'faol') then
    raise exception 'Guruh topilmadi yoki yopilgan.';
  end if;
  if p_sana is null then
    raise exception 'Sanani tanlang.';
  end if;
  if p_sana > bugun_toshkent() then
    raise exception 'Kelasi sanani qo''yib bo''lmaydi — sinov kunini o''zgartiring.';
  end if;
  if p_sana < (l.created_at at time zone 'Asia/Tashkent')::date then
    raise exception 'Sana lid kiritilgan kundan (%) oldin bo''lmasin.', to_char(l.created_at at time zone 'Asia/Tashkent', 'DD.MM.YYYY');
  end if;

  -- Eski guruh jurnalidagi belgilar o'chadi
  if l.group_id is not null and l.group_id <> p_group then
    delete from probniy_davomat pd
     using lessons ls
     where ls.id = pd.lesson_id and pd.lead_id = p_lead and ls.group_id = l.group_id;
    get diagnostics v_ochdi = row_count;
    -- Yangi guruhda sanadan oldingi belgilar (avval shu guruhda bo'lgan bo'lsa) — o'chadi
    delete from probniy_davomat pd
     using lessons ls
     where ls.id = pd.lesson_id and pd.lead_id = p_lead and ls.group_id = p_group and ls.sana < p_sana;
  end if;

  update leads
     set group_id = p_group,
         guruh_dan = p_sana,
         sinov_sana = case when sinov_sana is null or sinov_sana > p_sana or l.group_id is distinct from p_group
                           then p_sana else sinov_sana end
   where id = p_lead;

  return jsonb_build_object('ochirildi', v_ochdi);
end;
$$;
revoke execute on function sinov_guruh_almashtir(uuid, text, date) from public, anon;
grant execute on function sinov_guruh_almashtir(uuid, text, date) to authenticated, service_role;

-- Sinovdan chiqsa yoki o'quvchi bo'lsa — guruh_dan kerak emas
create or replace function leads_guruh_dan_tozala() returns trigger
language plpgsql set search_path = public as $$
begin
  if not lid_sinovdami(new) then
    new.guruh_dan := null;
  end if;
  return new;
end;
$$;
drop trigger if exists leads_guruh_dan_tozala on leads;
create trigger leads_guruh_dan_tozala before update on leads
  for each row execute function leads_guruh_dan_tozala();

-- Jurnal: kataklar guruh_dan dan (bo'lsa)
create or replace function jurnal_probniylar(p_group text, p_dan date, p_gacha date)
returns table (lead_id uuid, ism text, dan date, belgilar jsonb)
language sql stable security definer set search_path = public as $$
  select l.id, l.ism,
         coalesce(l.guruh_dan,
                  least(coalesce(l.sinov_otkazildi, (l.created_at at time zone 'Asia/Tashkent')::date),
                        coalesce(l.sinov_sana, 'infinity'::date))),
         coalesce((
           select jsonb_object_agg(ls.sana::text, pd.holat)
           from probniy_davomat pd
           join lessons ls on ls.id = pd.lesson_id
           where pd.lead_id = l.id and ls.group_id = p_group and ls.sana between p_dan and p_gacha
         ), '{}'::jsonb)
  from leads l
  where l.group_id = p_group
    and lid_sinovdami(l)
    and coalesce(l.guruh_dan,
                 least(coalesce(l.sinov_otkazildi, (l.created_at at time zone 'Asia/Tashkent')::date),
                       coalesce(l.sinov_sana, 'infinity'::date))) <= p_gacha
    and (app_is_staff() or app_teaches_group(p_group) or auth.uid() is null)
  order by l.ism
$$;
