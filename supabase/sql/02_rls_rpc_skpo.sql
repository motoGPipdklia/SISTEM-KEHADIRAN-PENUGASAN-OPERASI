-- ================================================================
-- SKPO V2 — RLS, POLISI DAN RPC
-- Jalankan selepas 01_schema_skpo.sql.
-- ================================================================

create or replace function public.skpo_ada_peranan(peranan_dibenarkan text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.aktif = true
      and p.peranan = any(peranan_dibenarkan)
  );
$$;

grant execute on function public.skpo_ada_peranan(text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.penugasan enable row level security;
alter table public.checkin enable row level security;
alter table public.checkout enable row level security;
alter table public.pelaporan enable row level security;
alter table public.walkie_talkie enable row level security;
alter table public.log_aktiviti enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.skpo_ada_peranan(array['URUSETIA','PENYELIA','PENTADBIR','TSM'])
);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
for update to authenticated
using (public.skpo_ada_peranan(array['PENTADBIR']))
with check (public.skpo_ada_peranan(array['PENTADBIR']));

drop policy if exists "penugasan_select" on public.penugasan;
create policy "penugasan_select" on public.penugasan
for select to authenticated
using (
  petugas_id = auth.uid()
  or public.skpo_ada_peranan(array['URUSETIA','PENYELIA','PENTADBIR','TSM'])
);

drop policy if exists "penugasan_admin_insert" on public.penugasan;
create policy "penugasan_admin_insert" on public.penugasan
for insert to authenticated
with check (public.skpo_ada_peranan(array['PENTADBIR']));

drop policy if exists "penugasan_admin_update" on public.penugasan;
create policy "penugasan_admin_update" on public.penugasan
for update to authenticated
using (public.skpo_ada_peranan(array['PENTADBIR']))
with check (public.skpo_ada_peranan(array['PENTADBIR']));

drop policy if exists "penugasan_admin_delete" on public.penugasan;
create policy "penugasan_admin_delete" on public.penugasan
for delete to authenticated
using (public.skpo_ada_peranan(array['PENTADBIR']));

drop policy if exists "checkin_select" on public.checkin;
create policy "checkin_select" on public.checkin
for select to authenticated
using (
  petugas_id = auth.uid()
  or public.skpo_ada_peranan(array['URUSETIA','PENYELIA','PENTADBIR'])
);

drop policy if exists "checkin_urusetia_update" on public.checkin;
create policy "checkin_urusetia_update" on public.checkin
for update to authenticated
using (public.skpo_ada_peranan(array['URUSETIA','PENYELIA','PENTADBIR']))
with check (public.skpo_ada_peranan(array['URUSETIA','PENYELIA','PENTADBIR']));

drop policy if exists "checkout_select" on public.checkout;
create policy "checkout_select" on public.checkout
for select to authenticated
using (
  petugas_id = auth.uid()
  or public.skpo_ada_peranan(array['URUSETIA','PENYELIA','PENTADBIR'])
);

drop policy if exists "pelaporan_select" on public.pelaporan;
create policy "pelaporan_select" on public.pelaporan
for select to authenticated
using (
  petugas_id = auth.uid()
  or public.skpo_ada_peranan(array['URUSETIA','PENYELIA','PENTADBIR'])
);

drop policy if exists "pelaporan_petugas_insert" on public.pelaporan;
create policy "pelaporan_petugas_insert" on public.pelaporan
for insert to authenticated
with check (
  petugas_id = auth.uid()
  and exists (
    select 1
    from public.penugasan p
    join public.checkin c on c.penugasan_id = p.id
    where p.id = penugasan_id
      and p.petugas_id = auth.uid()
      and (p.penyelia = true or p.pemegang_set = true)
      and c.status = 'HADIR'
      and not exists (
        select 1 from public.checkout co
        where co.penugasan_id = p.id
      )
  )
);

drop policy if exists "walkie_select" on public.walkie_talkie;
create policy "walkie_select" on public.walkie_talkie
for select to authenticated
using (
  petugas_id = auth.uid()
  or public.skpo_ada_peranan(array['TSM','PENTADBIR'])
);

drop policy if exists "walkie_petugas_insert" on public.walkie_talkie;
create policy "walkie_petugas_insert" on public.walkie_talkie
for insert to authenticated
with check (
  petugas_id = auth.uid()
  and status = 'MENUNGGU'
  and exists (
    select 1 from public.penugasan p
    where p.id = penugasan_id
      and p.petugas_id = auth.uid()
      and p.pemegang_set = true
      and p.status = 'AKTIF'
  )
);

drop policy if exists "walkie_tsm_update" on public.walkie_talkie;
create policy "walkie_tsm_update" on public.walkie_talkie
for update to authenticated
using (public.skpo_ada_peranan(array['TSM','PENTADBIR']))
with check (public.skpo_ada_peranan(array['TSM','PENTADBIR']));

drop policy if exists "log_admin_select" on public.log_aktiviti;
create policy "log_admin_select" on public.log_aktiviti
for select to authenticated
using (public.skpo_ada_peranan(array['PENTADBIR']));

-- ================================================================
-- RPC CHECK-IN
-- ================================================================

create or replace function public.rekod_checkin_petugas(
  p_penugasan_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_ketepatan_gps numeric,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tugas public.penugasan%rowtype;
  v_tarikh date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_jarak numeric;
  v_device_lama text;
  v_rekod public.checkin%rowtype;
begin
  if v_uid is null then
    raise exception 'Sila login terlebih dahulu.';
  end if;

  select * into v_tugas
  from public.penugasan
  where id = p_penugasan_id
    and petugas_id = v_uid
    and tarikh = v_tarikh;

  if not found then
    raise exception 'Penugasan hari ini tidak ditemui.';
  end if;

  if v_tugas.status = 'DIGANTI' then
    raise exception 'Check-In tidak dibenarkan kerana status penugasan ialah DIGANTI.';
  end if;

  if exists (select 1 from public.checkin where petugas_id = v_uid and tarikh = v_tarikh) then
    return jsonb_build_object('success', false, 'message', 'Check-In telah direkodkan.');
  end if;

  if p_ketepatan_gps is null or p_ketepatan_gps > 50 then
    raise exception 'Ketepatan GPS terlalu lemah.';
  end if;

  if v_tugas.latitude is null or v_tugas.longitude is null then
    raise exception 'Koordinat penugasan belum ditetapkan.';
  end if;

  v_jarak := 6371000 * 2 * asin(sqrt(
    power(sin(radians((p_latitude - v_tugas.latitude)::double precision) / 2), 2) +
    cos(radians(v_tugas.latitude::double precision)) *
    cos(radians(p_latitude::double precision)) *
    power(sin(radians((p_longitude - v_tugas.longitude)::double precision) / 2), 2)
  ));

  if v_jarak > v_tugas.radius_meter then
    raise exception 'Anda berada di luar radius lokasi tugas.';
  end if;

  select device_id into v_device_lama from public.profiles where id = v_uid;
  if v_device_lama is not null and v_device_lama <> p_device_id then
    raise exception 'Akaun ini telah didaftarkan pada peranti lain. Hubungi Pentadbir.';
  end if;

  if exists (
    select 1 from public.checkin
    where tarikh = v_tarikh
      and device_id = p_device_id
      and petugas_id <> v_uid
  ) then
    insert into public.checkin (
      penugasan_id, petugas_id, tarikh, latitude, longitude,
      ketepatan_gps, jarak_meter, device_id, status, sebab_ditolak
    ) values (
      v_tugas.id, v_uid, v_tarikh, p_latitude, p_longitude,
      p_ketepatan_gps, v_jarak, p_device_id, 'DITOLAK',
      'Device ID telah digunakan oleh No Badan lain.'
    ) returning * into v_rekod;

    return jsonb_build_object(
      'success', false,
      'message', 'Check-In ditolak kerana Device ID telah digunakan oleh pengguna lain.',
      'ditolakAutomatik', true
    );
  end if;

  update public.profiles
  set device_id = coalesce(device_id, p_device_id), updated_at = now()
  where id = v_uid;

  insert into public.checkin (
    penugasan_id, petugas_id, tarikh, latitude, longitude,
    ketepatan_gps, jarak_meter, device_id, status
  ) values (
    v_tugas.id, v_uid, v_tarikh, p_latitude, p_longitude,
    p_ketepatan_gps, v_jarak, p_device_id, 'MENUNGGU'
  ) returning * into v_rekod;

  return jsonb_build_object(
    'success', true,
    'id', v_rekod.id,
    'status', v_rekod.status,
    'masa', v_rekod.masa_checkin,
    'jarak_meter', v_jarak
  );
end;
$$;

grant execute on function public.rekod_checkin_petugas(uuid,numeric,numeric,numeric,text) to authenticated;

-- ================================================================
-- RPC CHECK-OUT
-- ================================================================

create or replace function public.rekod_checkout_petugas(
  p_penugasan_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_ketepatan_gps numeric,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tugas public.penugasan%rowtype;
  v_checkin public.checkin%rowtype;
  v_checkout public.checkout%rowtype;
  v_tarikh date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_jarak numeric;
  v_tempoh integer;
begin
  if v_uid is null then raise exception 'Sila login terlebih dahulu.'; end if;

  select * into v_tugas from public.penugasan
  where id = p_penugasan_id and petugas_id = v_uid and tarikh = v_tarikh;
  if not found then raise exception 'Penugasan hari ini tidak ditemui.'; end if;

  select * into v_checkin from public.checkin
  where penugasan_id = v_tugas.id and petugas_id = v_uid and status = 'HADIR';
  if not found then raise exception 'Check-Out hanya dibenarkan selepas kehadiran disahkan.'; end if;

  if exists (select 1 from public.checkout where petugas_id = v_uid and tarikh = v_tarikh) then
    return jsonb_build_object('success', false, 'message', 'Check-Out telah direkodkan.');
  end if;

  if p_ketepatan_gps is null or p_ketepatan_gps > 50 then
    raise exception 'Ketepatan GPS terlalu lemah.';
  end if;

  if v_checkin.device_id is distinct from p_device_id then
    raise exception 'Check-Out mesti menggunakan peranti Check-In yang sama.';
  end if;

  v_jarak := 6371000 * 2 * asin(sqrt(
    power(sin(radians((p_latitude - v_tugas.latitude)::double precision) / 2), 2) +
    cos(radians(v_tugas.latitude::double precision)) *
    cos(radians(p_latitude::double precision)) *
    power(sin(radians((p_longitude - v_tugas.longitude)::double precision) / 2), 2)
  ));

  if v_jarak > v_tugas.radius_meter then
    raise exception 'Anda berada di luar radius lokasi tugas.';
  end if;

  v_tempoh := greatest(0, floor(extract(epoch from (now() - v_checkin.masa_checkin)) / 60)::integer);

  insert into public.checkout (
    checkin_id, penugasan_id, petugas_id, tarikh, latitude,
    longitude, ketepatan_gps, jarak_meter, tempoh_minit
  ) values (
    v_checkin.id, v_tugas.id, v_uid, v_tarikh, p_latitude,
    p_longitude, p_ketepatan_gps, v_jarak, v_tempoh
  ) returning * into v_checkout;

  return jsonb_build_object(
    'success', true,
    'id', v_checkout.id,
    'masa', v_checkout.masa_checkout,
    'tempoh_minit', v_tempoh,
    'jarak_meter', v_jarak
  );
end;
$$;

grant execute on function public.rekod_checkout_petugas(uuid,numeric,numeric,numeric,text) to authenticated;

-- ================================================================
-- RPC PEMULANGAN WALKIE-TALKIE
-- ================================================================

create or replace function public.mohon_pemulangan_set(p_rekod_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.walkie_talkie
  set status = 'MENUNGGU_PEMULANGAN',
      masa_permohonan_pemulangan = now(),
      updated_at = now()
  where id = p_rekod_id
    and petugas_id = v_uid
    and status = 'DILEPASKAN';

  if not found then
    return jsonb_build_object('success', false, 'message', 'Rekod set tidak sah untuk pemulangan.');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.mohon_pemulangan_set(uuid) to authenticated;

-- ================================================================
-- RPC RESET DEVICE
-- ================================================================

create or replace function public.reset_device_petugas(p_petugas_id uuid, p_sebab text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.skpo_ada_peranan(array['PENTADBIR']) then
    raise exception 'Akses ditolak.';
  end if;

  if nullif(trim(p_sebab), '') is null then
    raise exception 'Sebab reset wajib diisi.';
  end if;

  update public.profiles
  set device_id = null, updated_at = now()
  where id = p_petugas_id;

  insert into public.log_aktiviti(pelaku_id, tindakan, sasaran_id, butiran)
  values (auth.uid(), 'RESET_DEVICE', p_petugas_id::text, jsonb_build_object('sebab', p_sebab));

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.reset_device_petugas(uuid,text) to authenticated;
