create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text check (phone is null or char_length(phone) <= 32),
  date_of_birth date,
  address text check (address is null or char_length(address) <= 1000),
  state text check (state is null or char_length(state) <= 100),
  district text check (district is null or char_length(district) <= 100),
  occupation text check (occupation is null or char_length(occupation) <= 120),
  annual_income numeric(14, 2) check (annual_income is null or annual_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  relationship text not null check (char_length(relationship) between 1 and 80),
  date_of_birth date,
  occupation text check (occupation is null or char_length(occupation) <= 120),
  annual_income numeric(14, 2) check (annual_income is null or annual_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index family_members_user_id_idx on public.family_members(user_id);

create table public.schemes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 160),
  name text not null check (char_length(name) between 2 and 240),
  summary text not null default '',
  jurisdiction text not null check (jurisdiction in ('central', 'state')),
  state text,
  category text not null,
  official_source_url text not null check (official_source_url like 'https://%'),
  application_url text check (application_url is null or application_url like 'https://%'),
  verified_at date,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jurisdiction <> 'state' or state is not null),
  check (not is_published or verified_at is not null)
);
create index schemes_published_category_idx on public.schemes(is_published, category);

create table public.scheme_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes(id) on delete cascade,
  criterion text not null check (char_length(criterion) between 1 and 120),
  operator text not null check (operator in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in')),
  expected_value jsonb not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (scheme_id, criterion)
);
create index scheme_rules_scheme_id_idx on public.scheme_eligibility_rules(scheme_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique check (
    object_path ~ ('^' || user_id::text || '/[^/]+(/[^/]+)*$')
  ),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  document_type text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'processed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_created_idx on public.documents(user_id, created_at desc);

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  extracted_data jsonb not null default '{}'::jsonb,
  summary text,
  missing_information jsonb not null default '[]'::jsonb,
  processing_method text check (processing_method is null or processing_method in ('text', 'ocr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 200),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index legal_conversations_user_created_idx on public.legal_conversations(user_id, created_at desc);

create table public.legal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.legal_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  source_references jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index legal_messages_conversation_created_idx on public.legal_messages(conversation_id, created_at);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheme_id uuid references public.schemes(id) on delete set null,
  application_type text not null check (char_length(application_type) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'pending', 'completed')),
  form_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_updated_idx on public.applications(user_id, updated_at desc);

create table public.application_documents (
  application_id uuid not null references public.applications(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (application_id, document_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 100),
  summary text not null check (char_length(summary) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_user_created_idx on public.activity_logs(user_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'family_members',
    'schemes',
    'scheme_eligibility_rules',
    'documents',
    'document_extractions',
    'legal_conversations',
    'legal_messages',
    'applications',
    'application_documents',
    'notifications',
    'activity_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy "Profiles are private to their owner"
on public.profiles for all to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Family members are private to their owner"
on public.family_members for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Published schemes are readable"
on public.schemes for select to anon, authenticated
using (is_published);

create policy "Rules for published schemes are readable"
on public.scheme_eligibility_rules for select to anon, authenticated
using (
  exists (
    select 1 from public.schemes
    where schemes.id = scheme_eligibility_rules.scheme_id
      and schemes.is_published
  )
);

create policy "Documents are private to their owner"
on public.documents for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Document extractions follow document ownership"
on public.document_extractions for all to authenticated
using (
  exists (
    select 1 from public.documents
    where documents.id = document_extractions.document_id
      and documents.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.documents
    where documents.id = document_extractions.document_id
      and documents.user_id = (select auth.uid())
  )
);

create policy "Legal conversations are private to their owner"
on public.legal_conversations for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Legal messages follow conversation ownership"
on public.legal_messages for all to authenticated
using (
  exists (
    select 1 from public.legal_conversations
    where legal_conversations.id = legal_messages.conversation_id
      and legal_conversations.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.legal_conversations
    where legal_conversations.id = legal_messages.conversation_id
      and legal_conversations.user_id = (select auth.uid())
  )
);

create policy "Applications are private to their owner"
on public.applications for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Application documents require ownership of both records"
on public.application_documents for all to authenticated
using (
  exists (
    select 1 from public.applications
    join public.documents on documents.id = application_documents.document_id
    where applications.id = application_documents.application_id
      and applications.user_id = (select auth.uid())
      and documents.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.applications
    join public.documents on documents.id = application_documents.document_id
    where applications.id = application_documents.application_id
      and applications.user_id = (select auth.uid())
      and documents.user_id = (select auth.uid())
  )
);

create policy "Notifications are private to their owner"
on public.notifications for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Activity logs are readable by their owner"
on public.activity_logs for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Activity logs can be written by their owner"
on public.activity_logs for insert to authenticated
with check ((select auth.uid()) = user_id);

revoke truncate, references, trigger
on table
  public.profiles,
  public.family_members,
  public.schemes,
  public.scheme_eligibility_rules,
  public.documents,
  public.document_extractions,
  public.legal_conversations,
  public.legal_messages,
  public.applications,
  public.application_documents,
  public.notifications,
  public.activity_logs
from public, anon, authenticated;

revoke all privileges on table public.documents
from public, anon, authenticated;
revoke insert (status), update (status) on table public.documents
from public, anon, authenticated;
grant select, delete on table public.documents to authenticated;
grant insert (user_id, object_path, original_filename, mime_type, file_size_bytes, document_type)
on table public.documents to authenticated;
grant update (original_filename, document_type)
on table public.documents to authenticated;

revoke all privileges on table public.applications
from public, anon, authenticated;
revoke insert (status), update (status) on table public.applications
from public, anon, authenticated;
grant select, delete on table public.applications to authenticated;
grant insert (user_id, scheme_id, application_type, form_data)
on table public.applications to authenticated;
grant update (scheme_id, application_type, form_data)
on table public.applications to authenticated;

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger set_family_members_updated_at before update on public.family_members
for each row execute function public.set_updated_at();
create trigger set_schemes_updated_at before update on public.schemes
for each row execute function public.set_updated_at();
create trigger set_documents_updated_at before update on public.documents
for each row execute function public.set_updated_at();
create trigger set_document_extractions_updated_at before update on public.document_extractions
for each row execute function public.set_updated_at();
create trigger set_legal_conversations_updated_at before update on public.legal_conversations
for each row execute function public.set_updated_at();
create trigger set_applications_updated_at before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'citizen-documents',
  'citizen-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read documents in their own storage folder"
on storage.objects for select to authenticated
using (
  bucket_id = 'citizen-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload documents to their own storage folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'citizen-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update documents in their own storage folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'citizen-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'citizen-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete documents in their own storage folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'citizen-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create or replace function public.set_document_status(
  p_document_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('uploaded', 'processing', 'processed', 'failed') then
    raise exception using
      errcode = '22023',
      message = 'Invalid document status.';
  end if;

  update public.documents
  set status = p_status
  where id = p_document_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Document not found.';
  end if;
end;
$$;

create or replace function public.set_application_status(
  p_application_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('draft', 'pending', 'completed') then
    raise exception using
      errcode = '22023',
      message = 'Invalid application status.';
  end if;

  update public.applications
  set status = p_status
  where id = p_application_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Application not found.';
  end if;
end;
$$;

revoke all on function public.set_document_status(uuid, text)
from public, anon, authenticated;
grant execute on function public.set_document_status(uuid, text) to service_role;

revoke all on function public.set_application_status(uuid, text)
from public, anon, authenticated;
grant execute on function public.set_application_status(uuid, text) to service_role;
