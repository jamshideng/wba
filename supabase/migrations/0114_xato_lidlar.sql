-- ============================================================
-- 0114 — xato kiritilgan lidlar (Jamshid, 01.11)
--
-- Xato lid konversiya va hisobotlarda sanalmaydi, /crm/lidlar/xato sahifasida
-- turadi: kim, qachon, nima uchun. Admin belgilaydi va qaytaradi, butunlay
-- o'chirish — manager va direktor. O'quvchi bo'lgan lid belgilanmaydi.
-- ============================================================
alter table leads add column if not exists xato_sabab text;
alter table leads add column if not exists xato_at timestamptz;
alter table leads add column if not exists xato_belgiladi uuid references profiles (id) on delete set null;
alter table leads add column if not exists oldingi_holat lead_status;

create or replace function lid_xato_belgila(p_lid uuid, p_sabab text) returns void
language plpgsql security definer set search_path = public as $$
declare v_l leads;
begin
  if not app_is_admin() then
    raise exception 'Xato lidni admin, manager yoki direktor belgilaydi.';
  end if;
  if coalesce(btrim(p_sabab), '') = '' then
    raise exception 'Nima xato bo''lganini yozing.';
  end if;
  select * into v_l from leads where id = p_lid for update;
  if v_l.id is null then raise exception 'Lid topilmadi.'; end if;
  if v_l.student_id is not null then raise exception 'Bu lid o''quvchi bo''lgan, xato deb belgilanmaydi.'; end if;
  if v_l.holat = 'xato' then raise exception 'Bu lid allaqachon xato deb belgilangan.'; end if;
  update leads set oldingi_holat = holat, holat = 'xato', xato_sabab = btrim(p_sabab),
                   xato_at = now(), xato_belgiladi = auth.uid(), keyingi_aloqa = null
  where id = p_lid;
end;
$$;

create or replace function lid_xato_qaytar(p_lid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Lidni admin, manager yoki direktor qaytaradi.';
  end if;
  update leads set holat = coalesce(oldingi_holat, 'yangi'), oldingi_holat = null,
                   xato_sabab = null, xato_at = null, xato_belgiladi = null
  where id = p_lid and holat = 'xato';
  if not found then raise exception 'Bu lid xato ro''yxatida emas.'; end if;
end;
$$;

-- Lid nusxasi audit_log da qoladi (leads_audit). O'chirishda probniy tarixi ham ketadi.
create or replace function lid_xato_ochir(p_lid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_manager() then
    raise exception 'Lidni butunlay faqat manager yoki direktor o''chiradi.';
  end if;
  delete from leads where id = p_lid and holat = 'xato';
  if not found then raise exception 'Faqat xato deb belgilangan lid o''chiriladi.'; end if;
end;
$$;

create or replace function lid_xatolar() returns table (
  id uuid, ism text, telefon text, sabab text, xato_at timestamptz, belgiladi text, kiritilgan timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Faqat admin, manager va direktor ko''radi.';
  end if;
  return query
  select l.id, l.ism, l.telefon, l.xato_sabab, l.xato_at, coalesce(p.ism, 'Noma''lum'), l.created_at
  from leads l left join profiles p on p.id = l.xato_belgiladi
  where l.holat = 'xato' order by l.xato_at desc nulls last;
end;
$$;

revoke execute on function lid_xato_belgila(uuid, text) from public, anon;
grant execute on function lid_xato_belgila(uuid, text) to authenticated;
revoke execute on function lid_xato_qaytar(uuid) from public, anon;
grant execute on function lid_xato_qaytar(uuid) to authenticated;
revoke execute on function lid_xato_ochir(uuid) from public, anon;
grant execute on function lid_xato_ochir(uuid) to authenticated;
revoke execute on function lid_xatolar() from public, anon;
grant execute on function lid_xatolar() to authenticated;

-- ------------------------------------------------------------
-- Hisobotlar va avto-vazifa: xato lid sanalmaydi
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_eski text;
  v_yangi text;
begin
  for r in select * from (values
    ('hisobot_oquvchilar_ichki', 'from leads l where l.created_at', 'from leads l where l.holat <> ''xato'' and l.created_at'),
    ('tushum_hisobot', 'where (created_at at time zone ''Asia/Tashkent'')::date between p_dan and p_gacha',
                       'where holat <> ''xato'' and (created_at at time zone ''Asia/Tashkent'')::date between p_dan and p_gacha'),
    ('hisobot_royxat', 'where p_tur in (''probniy'', ''probniy_yozildi'') and l.created_at',
                       'where l.holat <> ''xato'' and p_tur in (''probniy'', ''probniy_yozildi'') and l.created_at'),
    ('hisobot_royxat', 'where p_tur = ''lid'' and (l.created_at', 'where l.holat <> ''xato'' and p_tur = ''lid'' and (l.created_at'),
    ('kunlik_qoshimcha', 'where (l.created_at at time zone ''Asia/Tashkent'')::date = p_kun',
                         'where l.holat <> ''xato'' and (l.created_at at time zone ''Asia/Tashkent'')::date = p_kun'),
    ('lead_avto_vazifa', 'new.holat in (''yozildi'', ''rad'', ''kelmadi'')', 'new.holat in (''yozildi'', ''rad'', ''kelmadi'', ''xato'')')
  ) as t(fn, eski, yangi)
  loop
    select pg_get_functiondef(p.oid) into v_eski from pg_proc p
    where p.proname = r.fn and p.pronamespace = 'public'::regnamespace;
    v_yangi := replace(v_eski, r.eski, r.yangi);
    if v_eski is null or v_yangi = v_eski then
      raise exception '0114: % kutilgan ko''rinishda emas: %', r.fn, r.eski;
    end if;
    execute v_yangi;
  end loop;
end $$;
