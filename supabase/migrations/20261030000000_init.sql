-- Seizure logger: initial schema, sync triggers, RLS, account deletion RPC.

create type public.intensity as enum ('low', 'medium', 'high');
create type public.after_effect as enum ('woke_fully', 'stayed_asleep', 'sleepy_confused', 'other');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  birth_year int null check (birth_year between 1990 and 2100),
  medications_note text null,
  intensity_guide jsonb null,
  last_visit_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  server_updated_at timestamptz not null default now()
);

create table public.symptoms (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  server_updated_at timestamptz not null default now()
);

create table public.seizure_events (
  id uuid primary key,
  child_id uuid not null references public.children (id) on delete cascade,
  occurred_at timestamptz not null,
  intensity public.intensity not null,
  duration_seconds int null check (duration_seconds >= 0),
  after_effect public.after_effect null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  server_updated_at timestamptz not null default now()
);

create table public.seizure_event_symptoms (
  event_id uuid not null references public.seizure_events (id) on delete cascade,
  symptom_id uuid not null references public.symptoms (id) on delete cascade,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  server_updated_at timestamptz not null default now(),
  primary key (event_id, symptom_id)
);

create table public.event_context_tags (
  event_id uuid not null references public.seizure_events (id) on delete cascade,
  tag text not null check (tag in ('missed_medication', 'illness_fever', 'poor_sleep', 'other')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  server_updated_at timestamptz not null default now(),
  primary key (event_id, tag)
);

-- Indexes
create index children_owner_id_idx on public.children (owner_id);
create index symptoms_owner_id_idx on public.symptoms (owner_id);
create index seizure_events_child_occurred_idx on public.seizure_events (child_id, occurred_at);
create index seizure_event_symptoms_symptom_idx on public.seizure_event_symptoms (symptom_id);
create index children_sync_idx on public.children (server_updated_at);
create index symptoms_sync_idx on public.symptoms (server_updated_at);
create index seizure_events_sync_idx on public.seizure_events (server_updated_at);
create index seizure_event_symptoms_sync_idx on public.seizure_event_symptoms (server_updated_at);
create index event_context_tags_sync_idx on public.event_context_tags (server_updated_at);

-- Sync stamping + server-side last-write-wins
create function public.sync_stamp() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.server_updated_at := clock_timestamp();
    return new;
  end if;
  -- UPDATE: skip stale writes (an upsert with an older updated_at is a no-op)
  if new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger children_sync_stamp before insert or update on public.children
  for each row execute function public.sync_stamp();
create trigger symptoms_sync_stamp before insert or update on public.symptoms
  for each row execute function public.sync_stamp();
create trigger seizure_events_sync_stamp before insert or update on public.seizure_events
  for each row execute function public.sync_stamp();
create trigger seizure_event_symptoms_sync_stamp before insert or update on public.seizure_event_symptoms
  for each row execute function public.sync_stamp();
create trigger event_context_tags_sync_stamp before insert or update on public.event_context_tags
  for each row execute function public.sync_stamp();

-- Profile auto-creation
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ownership helpers (security definer: avoid recursive RLS)
create function public.owns_child(cid uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.children c where c.id = cid and c.owner_id = auth.uid()
  );
$$;

create function public.owns_event(eid uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.seizure_events e
    join public.children c on c.id = e.child_id
    where e.id = eid and c.owner_id = auth.uid()
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.symptoms enable row level security;
alter table public.seizure_events enable row level security;
alter table public.seizure_event_symptoms enable row level security;
alter table public.event_context_tags enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy children_select on public.children for select to authenticated
  using (owner_id = auth.uid());
create policy children_insert on public.children for insert to authenticated
  with check (owner_id = auth.uid());
create policy children_update on public.children for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy children_delete on public.children for delete to authenticated
  using (owner_id = auth.uid());

create policy symptoms_select on public.symptoms for select to authenticated
  using (owner_id = auth.uid());
create policy symptoms_insert on public.symptoms for insert to authenticated
  with check (owner_id = auth.uid());
create policy symptoms_update on public.symptoms for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy symptoms_delete on public.symptoms for delete to authenticated
  using (owner_id = auth.uid());

create policy seizure_events_select on public.seizure_events for select to authenticated
  using (public.owns_child(child_id));
create policy seizure_events_insert on public.seizure_events for insert to authenticated
  with check (public.owns_child(child_id));
create policy seizure_events_update on public.seizure_events for update to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));
create policy seizure_events_delete on public.seizure_events for delete to authenticated
  using (public.owns_child(child_id));

create policy ses_select on public.seizure_event_symptoms for select to authenticated
  using (public.owns_event(event_id));
create policy ses_insert on public.seizure_event_symptoms for insert to authenticated
  with check (
    public.owns_event(event_id)
    and exists (select 1 from public.symptoms s where s.id = symptom_id and s.owner_id = auth.uid())
  );
create policy ses_update on public.seizure_event_symptoms for update to authenticated
  using (public.owns_event(event_id))
  with check (
    public.owns_event(event_id)
    and exists (select 1 from public.symptoms s where s.id = symptom_id and s.owner_id = auth.uid())
  );
create policy ses_delete on public.seizure_event_symptoms for delete to authenticated
  using (public.owns_event(event_id));

create policy ect_select on public.event_context_tags for select to authenticated
  using (public.owns_event(event_id));
create policy ect_insert on public.event_context_tags for insert to authenticated
  with check (public.owns_event(event_id));
create policy ect_update on public.event_context_tags for update to authenticated
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy ect_delete on public.event_context_tags for delete to authenticated
  using (public.owns_event(event_id));

-- Account deletion RPC
create function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Grants
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from public;
grant select, insert, update, delete on
  public.profiles, public.children, public.symptoms, public.seizure_events,
  public.seizure_event_symptoms, public.event_context_tags
  to authenticated;

revoke execute on function public.owns_child(uuid), public.owns_event(uuid),
  public.delete_my_account(), public.handle_new_user(), public.sync_stamp()
  from public, anon;
grant execute on function public.owns_child(uuid), public.owns_event(uuid),
  public.delete_my_account() to authenticated;
