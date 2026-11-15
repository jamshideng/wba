\set ON_ERROR_STOP 1
begin;
-- Rollar: U03 = ustoz (3c3e...), U02 = boshqa ustoz, admin = b3e5..., manager = 3a19... (vaqtincha), o'quvchi = 96c9...
update profiles set rol = 'manager' where id = '3a191763-f852-477a-9667-095dc3ff63d7';

create or replace function pg_temp.kim(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

-- ===== 1) USTOZ o'zi =====
select pg_temp.kim('3c3ee217-17ab-4968-9804-8a03872dde5d');
set local role authenticated;
update teacher_profil set tavsif = 'Ingliz tili ustozi, 5 yil tajriba', fanlar = '{Ingliz tili,IELTS}' where teacher_id = 'U03';
insert into teacher_sertifikat (teacher_id, turi, ball, qayerda, sana, fayl_saytda) values ('U03', 'IELTS', '8.0', 'British Council, Toshkent', '2025-03-10', true);
insert into teacher_talim (teacher_id, otm, yonalish, daraja, dan_yil, gacha_yil) values ('U03', 'O''zDJTU', 'Ingliz filologiyasi', 'bakalavr', 2016, 2020);
insert into teacher_shaxsiy (teacher_id, tugilgan_sana, pasport, jshshir, manzil) values ('U03', '1998-05-01', 'AB1234567', '12345678901234', 'Toshkent');
insert into teacher_mehnat (teacher_id, dan_yil, ish_joyi, lavozim) values ('U03', 2021, 'WBA', 'Ustoz');
select 'ustoz: holat', holat from teacher_profil where teacher_id = 'U03';
select 'ustoz: fayl_saytda majburan false', fayl_saytda from teacher_sertifikat where teacher_id = 'U03';
select 'ustoz: boshqa ustozni ko''radi (0 bo''lishi kerak)', count(*) from teacher_shaxsiy where teacher_id <> 'U03';
select 'ustoz: boshqa ustoz profili (0)', count(*) from teacher_profil where teacher_id <> 'U03';
do $$ begin
  update teacher_profil set saytda = true where teacher_id = 'U03';
  raise exception 'XATO: ustoz saytda ni yoqdi';
exception when others then if sqlerrm like 'XATO%' then raise; end if; raise notice 'ok rad (saytda): %', sqlerrm; end $$;
do $$ begin
  perform ustoz_cv_tasdiqla('U03');
  raise exception 'XATO: ustoz o''zini tasdiqladi';
exception when others then if sqlerrm like 'XATO%' then raise; end if; raise notice 'ok rad (tasdiq): %', sqlerrm; end $$;
do $$ declare n int; begin
  update teacher_shaxsiy set manzil = 'buzildi' where teacher_id = 'U02';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'XATO: ustoz boshqaning obyektivkasini o''zgartirdi'; end if;
  raise notice 'ok: boshqa ustoz obyektivkasiga tegolmadi';
end $$;
select 'ustoz xabari (admin/managerga)', ustoz_profil_xabar('U03', 'cv');
select 'takror (30 daq) — 0', ustoz_profil_xabar('U03', 'cv');
reset role;

-- ===== 2) O'QUVCHI =====
select pg_temp.kim('96c96796-6b3f-48b8-bef7-6f66353d3bed');
set local role authenticated;
select 'oquvchi: obyektivka (0)', count(*) from teacher_shaxsiy;
select 'oquvchi: CV (0)', count(*) from teacher_profil;
select 'oquvchi: tarix (0)', count(*) from teacher_profil_tarix;
reset role;

-- ===== 3) ADMIN =====
select pg_temp.kim('b3e5cd44-3a28-4075-85e1-78785298f785');
set local role authenticated;
select 'admin: U03 obyektivka', pasport from teacher_shaxsiy where teacher_id = 'U03';
update teacher_profil set saytda = true, korinish = korinish || '{"talim": true}' where teacher_id = 'U03';
update teacher_sertifikat set fayl_saytda = true where teacher_id = 'U03';
select 'admin: saytda', saytda, holat from teacher_profil where teacher_id = 'U03';
do $$ begin
  perform ustoz_cv_tasdiqla('U03');
  raise exception 'XATO: admin tasdiqladi (faqat manager)';
exception when others then if sqlerrm like 'XATO%' then raise; end if; raise notice 'ok rad (admin tasdiq): %', sqlerrm; end $$;
reset role;

-- ===== 4) ANON: tasdiqlanmagan — saytda yo'q =====
set local role anon;
select 'anon tasdiqdan oldin (bo''sh)', ommaviy_ustozlar();
reset role;

-- ===== 5) MANAGER tasdiqlaydi =====
select pg_temp.kim('3a191763-f852-477a-9667-095dc3ff63d7');
set local role authenticated;
select ustoz_cv_tasdiqla('U03');
select 'manager: holat, slug', holat, slug from teacher_profil where teacher_id = 'U03';
reset role;

set local role anon;
select 'anon: sayt', ommaviy_ustozlar();
select 'anon: pasport yo''q', ommaviy_ustozlar()::text not like '%AB1234567%';
reset role;

-- ===== 6) Ustoz yana o'zgartiradi — saytda eski nusxa qoladi =====
select pg_temp.kim('3c3ee217-17ab-4968-9804-8a03872dde5d');
set local role authenticated;
update teacher_profil set tavsif = 'YANGI tavsif (tasdiqlanmagan)' where teacher_id = 'U03';
select 'ustoz: holat yana', holat from teacher_profil where teacher_id = 'U03';
reset role;
set local role anon;
select 'anon: eski tavsif turibdi', ommaviy_ustozlar() -> 0 ->> 'tavsif';
reset role;

-- ===== 7) Tarix va maxfiylik =====
select 'tarix: pasport yashirin', maydon, eski, yangi from teacher_profil_tarix where teacher_id = 'U03' and maydon in ('pasport', 'jshshir');
select 'tarix soni', count(*), sum(kim_ustoz::int) from teacher_profil_tarix where teacher_id = 'U03';
select 'xabarlar', sarlavha, filtr ->> 'profil' is not null as profilga from bildirishnomalar where manba = 'ustoz_profil' order by id;
select 'toldirish', foiz, qolgan, majburiy_qolgan from v_ustoz_toldirish where teacher_id = 'U03';
rollback;
