-- RLS tests. Run with: psql -v ON_ERROR_STOP=1 -f rls_test.sql
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com');

do $$ begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'profiles trigger failed'; end if;
end $$;

-- ===== A creates data =====
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

do $$
begin
  insert into public.children (id, owner_id, display_name)
    values ('c0000000-0000-0000-0000-00000000000a', auth.uid(), 'Child A');
  insert into public.symptoms (id, owner_id, label)
    values ('50000000-0000-0000-0000-00000000000a', auth.uid(), 'Stiffening');
  insert into public.seizure_events (id, child_id, occurred_at, intensity, duration_seconds)
    values ('e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', now(), 'high', 90);
  insert into public.seizure_event_symptoms (event_id, symptom_id)
    values ('e0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a');
  insert into public.event_context_tags (event_id, tag)
    values ('e0000000-0000-0000-0000-00000000000a', 'poor_sleep');

  if (select count(*) from public.children) <> 1 then raise exception 'A: children read'; end if;
  if (select count(*) from public.symptoms) <> 1 then raise exception 'A: symptoms read'; end if;
  if (select count(*) from public.seizure_events) <> 1 then raise exception 'A: events read'; end if;
  if (select count(*) from public.seizure_event_symptoms) <> 1 then raise exception 'A: ses read'; end if;
  if (select count(*) from public.event_context_tags) <> 1 then raise exception 'A: tags read'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'A: profile read'; end if;
end $$;

-- ===== B isolation =====
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);

do $$
declare n int;
begin
  if (select count(*) from public.children) <> 0 then raise exception 'B sees A children'; end if;
  if (select count(*) from public.symptoms) <> 0 then raise exception 'B sees A symptoms'; end if;
  if (select count(*) from public.seizure_events) <> 0 then raise exception 'B sees A events'; end if;
  if (select count(*) from public.seizure_event_symptoms) <> 0 then raise exception 'B sees A ses'; end if;
  if (select count(*) from public.event_context_tags) <> 0 then raise exception 'B sees A tags'; end if;
  if (select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 0 then
    raise exception 'B sees A profile';
  end if;

  -- insert event into A's child
  begin
    insert into public.seizure_events (id, child_id, occurred_at, intensity)
      values ('e0000000-0000-0000-0000-0000000000bb', 'c0000000-0000-0000-0000-00000000000a', now(), 'low');
    raise exception 'B inserted event into A child';
  exception when insufficient_privilege then null;
  end;

  -- insert child owned by A
  begin
    insert into public.children (id, owner_id, display_name)
      values ('c0000000-0000-0000-0000-0000000000bb', 'aaaaaaaa-0000-0000-0000-000000000001', 'x');
    raise exception 'B inserted child for A';
  exception when insufficient_privilege then null;
  end;

  -- update / delete A's rows affect 0 rows
  update public.children set display_name = 'hacked' where id = 'c0000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B updated A child'; end if;
  update public.seizure_events set notes = 'hacked' where id = 'e0000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B updated A event'; end if;
  delete from public.children where id = 'c0000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B deleted A child'; end if;
  delete from public.seizure_events where id = 'e0000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B deleted A event'; end if;
  delete from public.symptoms where id = '50000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B deleted A symptom'; end if;

  -- B's own data
  insert into public.children (id, owner_id, display_name)
    values ('c0000000-0000-0000-0000-0000000000b1', auth.uid(), 'Child B');
  insert into public.seizure_events (id, child_id, occurred_at, intensity)
    values ('e0000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b1', now(), 'low');

  -- link own event to A's symptom
  begin
    insert into public.seizure_event_symptoms (event_id, symptom_id)
      values ('e0000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-00000000000a');
    raise exception 'B linked own event to A symptom';
  exception when insufficient_privilege then null;
  end;

  -- link A's event to B's own symptom
  insert into public.symptoms (id, owner_id, label)
    values ('50000000-0000-0000-0000-0000000000b1', auth.uid(), 'Staring');
  begin
    insert into public.seizure_event_symptoms (event_id, symptom_id)
      values ('e0000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-0000000000b1');
    raise exception 'B linked A event to symptom';
  exception when insufficient_privilege then null;
  end;

  -- tag on A's event
  begin
    insert into public.event_context_tags (event_id, tag)
      values ('e0000000-0000-0000-0000-00000000000a', 'other');
    raise exception 'B tagged A event';
  exception when insufficient_privilege then null;
  end;

  -- change own child's owner to A
  begin
    update public.children set owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      where id = 'c0000000-0000-0000-0000-0000000000b1';
    raise exception 'B moved child to A';
  exception when insufficient_privilege then null;
  end;

  -- move own event to A's child
  begin
    update public.seizure_events set child_id = 'c0000000-0000-0000-0000-00000000000a'
      where id = 'e0000000-0000-0000-0000-0000000000b1';
    raise exception 'B moved event to A child';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== anon =====
reset role;
set role anon;
do $$
begin
  begin
    perform count(*) from public.children;
    raise exception 'anon could read children';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.profiles;
    raise exception 'anon could read profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_my_account();
    raise exception 'anon could call delete_my_account';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== LWW + soft delete (as A) =====
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

do $$
declare
  t0 timestamptz;
  s0 timestamptz;
  s1 timestamptz;
  r record;
  n int;
begin
  select updated_at, server_updated_at into t0, s0 from public.children where id = 'c0000000-0000-0000-0000-00000000000a';

  -- older write: ignored
  insert into public.children (id, owner_id, display_name, updated_at)
    values ('c0000000-0000-0000-0000-00000000000a', auth.uid(), 'OLD NAME', t0 - interval '1 hour')
    on conflict (id) do update set display_name = excluded.display_name, updated_at = excluded.updated_at;
  select * into r from public.children where id = 'c0000000-0000-0000-0000-00000000000a';
  if r.display_name <> 'Child A' then raise exception 'LWW: stale write applied'; end if;
  if r.server_updated_at <> s0 then raise exception 'LWW: server_updated_at changed on stale write'; end if;

  -- newer write: applied
  insert into public.children (id, owner_id, display_name, updated_at)
    values ('c0000000-0000-0000-0000-00000000000a', auth.uid(), 'New Name', t0 + interval '1 hour')
    on conflict (id) do update set display_name = excluded.display_name, updated_at = excluded.updated_at;
  select * into r from public.children where id = 'c0000000-0000-0000-0000-00000000000a';
  if r.display_name <> 'New Name' then raise exception 'LWW: newer write not applied'; end if;
  if r.server_updated_at <= s0 then raise exception 'LWW: server_updated_at not bumped'; end if;
  s1 := r.server_updated_at;

  -- soft delete
  update public.seizure_events set deleted_at = now(), updated_at = now() + interval '2 hours'
    where id = 'e0000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'soft delete affected % rows', n; end if;
  if (select deleted_at from public.seizure_events where id = 'e0000000-0000-0000-0000-00000000000a') is null then
    raise exception 'soft delete not stored';
  end if;
end $$;

-- ===== delete_my_account as B =====
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select public.delete_my_account();

reset role;
do $$
begin
  if exists (select 1 from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002') then raise exception 'B auth user remains'; end if;
  if exists (select 1 from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') then raise exception 'B profile remains'; end if;
  if exists (select 1 from public.children where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002') then raise exception 'B children remain'; end if;
  if exists (select 1 from public.seizure_events where id = 'e0000000-0000-0000-0000-0000000000b1') then raise exception 'B events remain'; end if;
  if exists (select 1 from public.symptoms where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002') then raise exception 'B symptoms remain'; end if;
  if not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001') then raise exception 'A user gone'; end if;
  if (select count(*) from public.children where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 1 then raise exception 'A child gone'; end if;
  if (select count(*) from public.seizure_events) <> 1 then raise exception 'A event gone'; end if;
  if (select count(*) from public.seizure_event_symptoms) <> 1 then raise exception 'A ses gone'; end if;
  if (select count(*) from public.event_context_tags) <> 1 then raise exception 'A tag gone'; end if;
end $$;

-- unauthenticated delete_my_account raises
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  begin
    perform public.delete_my_account();
    raise exception 'delete_my_account allowed without uid';
  exception when sqlstate '28000' then null;
  end;
end $$;
reset role;

\echo 'RLS TESTS PASSED'
