-- Supabase contract for the role-aware system introduced in the frontend.
-- Run this against your project before relying on the new provider flows.

create extension if not exists pgcrypto;

alter table public.profiles
    add column if not exists email text,
    add column if not exists full_name text,
    add column if not exists bio text,
    add column if not exists phone text,
    add column if not exists country text,
    add column if not exists city text,
    add column if not exists website text,
    add column if not exists role text default 'tourist',
    add column if not exists is_verified boolean default false,
    add column if not exists verification_status text default 'not_required',
    add column if not exists company_name text,
    add column if not exists company_profile_id uuid,
    add column if not exists works_under_company boolean default false,
    add column if not exists provider_specialties text,
    add column if not exists guide_license_number text,
    add column if not exists certificate_id text,
    add column if not exists government_id_ref text,
    add column if not exists years_experience integer,
    add column if not exists languages text[];

do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'profiles'
          and c.contype = 'c'
          and (
              pg_get_constraintdef(c.oid) ilike '%role%'
              or pg_get_constraintdef(c.oid) ilike '%verification_status%'
          )
    loop
        execute format('alter table public.profiles drop constraint if exists %I', constraint_name);
    end loop;
end $$;

alter table public.profiles
    drop constraint if exists profiles_role_check;

alter table public.profiles
    add constraint profiles_role_check
    check (role in ('tourist', 'tour_company', 'tour_instructor', 'tour_guide', 'admin', 'provider')) not valid;

alter table public.profiles
    drop constraint if exists profiles_verification_status_check;

alter table public.profiles
    add constraint profiles_verification_status_check
    check (verification_status in ('not_required', 'pending', 'approved', 'rejected', 'resubmitted')) not valid;

-- Optional internal admin access:
-- set profiles.role = 'admin' for staff users.

update public.profiles
set verification_status = case
    when role = 'tourist' then 'not_required'
    when coalesce(is_verified, false) = true then 'approved'
    else 'pending'
end
where verification_status is null;

create table if not exists public.verification (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('tour_company', 'tour_instructor', 'tour_guide')),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'resubmitted')),
    company_name text,
    owner_name text default 'Provider',
    owner_id_card_url text default '',
    verification_type text default 'account',
    website text,
    registration_number text,
    works_under_company boolean default false,
    specialties text,
    license_number text,
    languages text[],
    years_experience integer,
    certificate_id text,
    government_id_ref text,
    bio text,
    rejection_reason text,
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null,
    submitted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.verification
    add column if not exists company_name text,
    add column if not exists owner_name text default 'Provider',
    add column if not exists owner_id_card_url text default '',
    add column if not exists verification_type text default 'account',
    add column if not exists website text,
    add column if not exists registration_number text,
    add column if not exists works_under_company boolean default false,
    add column if not exists specialties text,
    add column if not exists license_number text,
    add column if not exists languages text[],
    add column if not exists years_experience integer,
    add column if not exists certificate_id text,
    add column if not exists government_id_ref text,
    add column if not exists bio text,
    add column if not exists rejection_reason text,
    add column if not exists reviewed_at timestamptz,
    add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
    add column if not exists submitted_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now();

alter table public.verification
    alter column owner_name set default 'Provider',
    alter column owner_id_card_url set default '',
    alter column verification_type set default 'account';

update public.verification
set
    owner_name = coalesce(nullif(owner_name, ''), 'Provider'),
    owner_id_card_url = coalesce(owner_id_card_url, ''),
    verification_type = coalesce(verification_type, 'account'),
    submitted_at = coalesce(submitted_at, now()),
    updated_at = coalesce(updated_at, submitted_at, now())
where owner_name is null
   or owner_name = ''
   or owner_id_card_url is null
   or verification_type is null
   or submitted_at is null
   or updated_at is null;

do $$
declare
    col record;
begin
    -- Compatibility with older verification schemas:
    -- relax unexpected non-core NOT NULL columns so migration inserts cannot fail.
    for col in
        select column_name, data_type
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'verification'
          and is_nullable = 'NO'
          and column_name not in ('id', 'user_id', 'role', 'status', 'submitted_at', 'updated_at')
    loop
        if col.data_type in ('text', 'character varying') then
            execute format('alter table public.verification alter column %I set default ''''', col.column_name);
            execute format('update public.verification set %I = coalesce(%I, '''')', col.column_name, col.column_name);
            execute format('alter table public.verification alter column %I drop not null', col.column_name);
        elsif col.data_type = 'boolean' then
            execute format('alter table public.verification alter column %I set default false', col.column_name);
            execute format('update public.verification set %I = coalesce(%I, false)', col.column_name, col.column_name);
            execute format('alter table public.verification alter column %I drop not null', col.column_name);
        elsif col.data_type in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision') then
            execute format('alter table public.verification alter column %I set default 0', col.column_name);
            execute format('update public.verification set %I = coalesce(%I, 0)', col.column_name, col.column_name);
            execute format('alter table public.verification alter column %I drop not null', col.column_name);
        elsif col.data_type in ('date', 'timestamp without time zone', 'timestamp with time zone') then
            execute format('alter table public.verification alter column %I set default now()', col.column_name);
            execute format('update public.verification set %I = coalesce(%I, now())', col.column_name, col.column_name);
            execute format('alter table public.verification alter column %I drop not null', col.column_name);
        end if;
    end loop;
end $$;

do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'verification'
          and c.contype = 'c'
          and (
              pg_get_constraintdef(c.oid) ilike '%role%'
              or pg_get_constraintdef(c.oid) ilike '%status%'
              or pg_get_constraintdef(c.oid) ilike '%verification_type%'
          )
    loop
        execute format('alter table public.verification drop constraint if exists %I', constraint_name);
    end loop;
end $$;

alter table public.verification
    drop constraint if exists verification_role_check;

alter table public.verification
    add constraint verification_role_check
    check (role in ('tour_company', 'tour_instructor', 'tour_guide')) not valid;

alter table public.verification
    drop constraint if exists verification_status_check;

alter table public.verification
    add constraint verification_status_check
    check (status in ('pending', 'approved', 'rejected', 'resubmitted')) not valid;

create index if not exists verification_user_id_idx on public.verification(user_id);
create index if not exists verification_status_idx on public.verification(status);

create or replace function public.handle_new_auth_user_provider_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    signup_role text := coalesce(new.raw_user_meta_data->>'role', 'tourist');
    signup_languages text[];
    signup_years_experience integer;
begin
    if signup_role not in ('tourist', 'tour_company', 'tour_instructor', 'tour_guide') then
        signup_role := 'tourist';
    end if;

    select array_remove(array_agg(nullif(trim(language_item), '')), null)
    into signup_languages
    from unnest(string_to_array(coalesce(new.raw_user_meta_data->>'languages', ''), ',')) as language_item;

    if nullif(new.raw_user_meta_data->>'years_experience', '') ~ '^[0-9]+$' then
        signup_years_experience := (new.raw_user_meta_data->>'years_experience')::integer;
    end if;

    insert into public.profiles (
        id,
        email,
        full_name,
        phone,
        country,
        city,
        bio,
        role,
        is_verified,
        verification_status,
        company_name,
        works_under_company,
        website,
        provider_specialties,
        guide_license_number,
        certificate_id,
        government_id_ref,
        years_experience,
        languages
    )
    values (
        new.id,
        new.email,
        coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Member'),
        nullif(new.raw_user_meta_data->>'phone', ''),
        nullif(new.raw_user_meta_data->>'country', ''),
        nullif(new.raw_user_meta_data->>'city', ''),
        nullif(new.raw_user_meta_data->>'bio', ''),
        signup_role,
        signup_role = 'tourist',
        case when signup_role = 'tourist' then 'not_required' else 'pending' end,
        nullif(new.raw_user_meta_data->>'company_name', ''),
        coalesce(nullif(new.raw_user_meta_data->>'works_under_company', '')::boolean, false),
        nullif(new.raw_user_meta_data->>'website', ''),
        nullif(new.raw_user_meta_data->>'specialties', ''),
        nullif(new.raw_user_meta_data->>'license_number', ''),
        nullif(new.raw_user_meta_data->>'certificate_id', ''),
        nullif(new.raw_user_meta_data->>'government_id_ref', ''),
        signup_years_experience,
        signup_languages
    )
    on conflict (id) do update
    set
        email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone,
        country = excluded.country,
        city = excluded.city,
        bio = excluded.bio,
        role = excluded.role,
        is_verified = excluded.is_verified,
        verification_status = excluded.verification_status,
        company_name = excluded.company_name,
        works_under_company = excluded.works_under_company,
        website = excluded.website,
        provider_specialties = excluded.provider_specialties,
        guide_license_number = excluded.guide_license_number,
        certificate_id = excluded.certificate_id,
        government_id_ref = excluded.government_id_ref,
        years_experience = excluded.years_experience,
        languages = excluded.languages;

    if signup_role in ('tour_company', 'tour_instructor', 'tour_guide') then
        insert into public.verification (
            user_id,
            role,
            verification_type,
            owner_name,
            owner_id_card_url,
            status,
            company_name,
            website,
            registration_number,
            works_under_company,
            specialties,
            license_number,
            languages,
            years_experience,
            certificate_id,
            government_id_ref,
            bio
        )
        select
            new.id,
            signup_role,
            'account',
            coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Provider'),
            coalesce(nullif(new.raw_user_meta_data->>'owner_id_card_url', ''), ''),
            'pending',
            nullif(new.raw_user_meta_data->>'company_name', ''),
            nullif(new.raw_user_meta_data->>'website', ''),
            nullif(new.raw_user_meta_data->>'registration_number', ''),
            coalesce(nullif(new.raw_user_meta_data->>'works_under_company', '')::boolean, false),
            nullif(new.raw_user_meta_data->>'specialties', ''),
            nullif(new.raw_user_meta_data->>'license_number', ''),
            signup_languages,
            signup_years_experience,
            nullif(new.raw_user_meta_data->>'certificate_id', ''),
            nullif(new.raw_user_meta_data->>'government_id_ref', ''),
            nullif(new.raw_user_meta_data->>'bio', '')
        where not exists (
            select 1
            from public.verification existing
            where existing.user_id = new.id
        );
    end if;

    return new;
exception
    when others then
        raise warning 'Provider signup bootstrap failed for auth user %: %', new.id, sqlerrm;
        return new;
end;
$$;

drop trigger if exists on_auth_user_provider_signup on auth.users;
create trigger on_auth_user_provider_signup
after insert on auth.users
for each row execute function public.handle_new_auth_user_provider_signup();

insert into public.verification (
    user_id,
    role,
    verification_type,
    owner_name,
    owner_id_card_url,
    status,
    company_name,
    website,
    works_under_company,
    specialties,
    license_number,
    languages,
    years_experience,
    certificate_id,
    government_id_ref,
    bio
)
select
    profiles.id,
    profiles.role,
    'account',
    coalesce(nullif(profiles.full_name, ''), split_part(profiles.email, '@', 1), 'Provider'),
    coalesce(nullif(profiles.government_id_ref, ''), ''),
    coalesce(profiles.verification_status, 'pending'),
    profiles.company_name,
    profiles.website,
    coalesce(profiles.works_under_company, false),
    profiles.provider_specialties,
    profiles.guide_license_number,
    profiles.languages,
    profiles.years_experience,
    profiles.certificate_id,
    profiles.government_id_ref,
    profiles.bio
from public.profiles
where profiles.role in ('tour_company', 'tour_instructor', 'tour_guide')
  and coalesce(profiles.verification_status, 'pending') in ('pending', 'rejected', 'resubmitted')
  and not exists (
      select 1
      from public.verification existing
      where existing.user_id = profiles.id
  );

create table if not exists public.bookings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    provider_user_id uuid references auth.users(id) on delete set null,
    company_profile_id uuid references public.profiles(id) on delete set null,
    listing_id uuid not null,
    source_listing_id text,
    listing_type text not null check (listing_type in ('tour', 'activity', 'guide')),
    listing_title text,
    listing_image text,
    number_of_people integer not null default 1,
    unit_price numeric(12,2) not null default 0,
    total_price numeric(12,2) not null default 0,
    status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
    payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
    payment_order_id text,
    payment_id text,
    payment_signature text,
    payment_currency text not null default 'INR',
    paid_at timestamptz,
    booking_date date,
    created_at timestamptz not null default now()
);

alter table public.bookings
    add column if not exists provider_user_id uuid references auth.users(id) on delete set null,
    add column if not exists company_profile_id uuid references public.profiles(id) on delete set null,
    add column if not exists listing_id uuid,
    add column if not exists source_listing_id text,
    add column if not exists listing_type text,
    add column if not exists listing_title text,
    add column if not exists listing_image text,
    add column if not exists unit_price numeric(12,2) default 0,
    add column if not exists payment_status text default 'pending',
    add column if not exists payment_order_id text,
    add column if not exists payment_id text,
    add column if not exists payment_signature text,
    add column if not exists payment_currency text default 'INR',
    add column if not exists paid_at timestamptz,
    add column if not exists booking_date date;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'bookings'
          and column_name = 'post_id'
    ) then
        alter table public.bookings alter column post_id drop not null;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'bookings'
          and column_name = 'activity_id'
    ) then
        alter table public.bookings alter column activity_id drop not null;
    end if;
end $$;

update public.bookings
set source_listing_id = listing_id::text
where source_listing_id is null
  and listing_id is not null;

update public.bookings
set listing_type = 'guide'
where listing_type = 'event';

do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'bookings'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%listing_type%'
    loop
        execute format('alter table public.bookings drop constraint if exists %I', constraint_name);
    end loop;
end $$;

alter table public.bookings
    drop constraint if exists bookings_listing_type_check;

alter table public.bookings
    add constraint bookings_listing_type_check
    check (listing_type in ('tour', 'activity', 'guide'));

create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_provider_user_id_idx on public.bookings(provider_user_id);
create index if not exists bookings_listing_lookup_idx on public.bookings(listing_type, listing_id);
create index if not exists bookings_source_listing_lookup_idx on public.bookings(listing_type, source_listing_id) where source_listing_id is not null;
create unique index if not exists bookings_payment_id_uniq on public.bookings(payment_id) where payment_id is not null;
create index if not exists bookings_payment_order_id_idx on public.bookings(payment_order_id);

alter table public.favorites
    add column if not exists listing_id uuid,
    add column if not exists listing_type text;

alter table public.conversations
    add column if not exists traveler_id uuid,
    add column if not exists provider_id uuid,
    add column if not exists booking_id uuid;

create table if not exists public.conversation_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_user_id uuid not null references auth.users(id) on delete cascade,
    body text not null check (length(trim(body)) > 0),
    created_at timestamptz not null default now()
);

create index if not exists conversation_messages_conversation_idx
    on public.conversation_messages(conversation_id, created_at);

alter table public.posts
    add column if not exists provider_user_id uuid references auth.users(id) on delete set null,
    add column if not exists company_profile_id uuid references public.profiles(id) on delete set null,
    add column if not exists title text,
    add column if not exists name text,
    add column if not exists description text,
    add column if not exists location text,
    add column if not exists image_url text,
    add column if not exists cover_image_url text,
    add column if not exists thumbnail_url text,
    add column if not exists gallery_images text[],
    add column if not exists category text,
    add column if not exists sub_category text,
    add column if not exists type text,
    add column if not exists price numeric(12,2) default 0,
    add column if not exists starts_at timestamptz,
    add column if not exists status text default 'published',
    add column if not exists rejection_reason text,
    add column if not exists reviewed_at timestamptz,
    add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

do $$
declare
    posts_id_type text;
    posts_id_default text;
begin
    select data_type, column_default
    into posts_id_type, posts_id_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'id';

    if posts_id_type = 'uuid' then
        execute 'alter table public.posts alter column id set default gen_random_uuid()';
        execute 'update public.posts set id = coalesce(id, gen_random_uuid())';
    elsif posts_id_type in ('text', 'character varying', 'character') then
        execute 'alter table public.posts alter column id set default gen_random_uuid()::text';
        execute 'update public.posts set id = coalesce(id, gen_random_uuid()::text)';
    elsif posts_id_type in ('smallint', 'integer', 'bigint') then
        if posts_id_default is null or posts_id_default = '' then
            execute 'create sequence if not exists public.posts_id_seq';
            execute 'alter sequence public.posts_id_seq owned by public.posts.id';
            execute 'alter table public.posts alter column id set default nextval(''public.posts_id_seq'')';
        end if;
        execute 'update public.posts set id = coalesce(id, nextval(''public.posts_id_seq''))';
    end if;
end $$;

do $$
declare
    col record;
begin
    -- Compatibility with older posts schemas:
    -- relax unexpected non-core NOT NULL columns so provider publishing cannot fail.
    for col in
        select column_name, data_type
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'posts'
          and is_nullable = 'NO'
          and column_name not in ('id')
    loop
        if col.data_type in ('text', 'character varying') then
            execute format('alter table public.posts alter column %I set default ''''', col.column_name);
        elsif col.data_type = 'boolean' then
            execute format('alter table public.posts alter column %I set default false', col.column_name);
        elsif col.data_type in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision') then
            execute format('alter table public.posts alter column %I set default 0', col.column_name);
        elsif col.data_type in ('date', 'timestamp without time zone', 'timestamp with time zone') then
            execute format('alter table public.posts alter column %I set default now()', col.column_name);
        end if;

        execute format('alter table public.posts alter column %I drop not null', col.column_name);
    end loop;
end $$;

do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'posts'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%type%'
    loop
        execute format('alter table public.posts drop constraint if exists %I', constraint_name);
    end loop;
end $$;

create table if not exists public.moderation_audit_logs (
    id uuid primary key default gen_random_uuid(),
    entity_type text not null check (entity_type in ('verification', 'listing')),
    entity_id uuid not null,
    action text not null check (action in ('approved', 'rejected', 'published', 'resubmitted')),
    actor_user_id uuid references auth.users(id) on delete set null,
    target_user_id uuid references auth.users(id) on delete set null,
    reason text,
    metadata jsonb,
    created_at timestamptz not null default now()
);

create index if not exists moderation_audit_logs_entity_idx on public.moderation_audit_logs(entity_type, entity_id);
create index if not exists moderation_audit_logs_created_at_idx on public.moderation_audit_logs(created_at desc);

update public.posts
set status = coalesce(status, 'published')
where status is null;

update public.posts
set
    title = coalesce(nullif(title, ''), nullif(name, ''), 'Untitled listing'),
    name = coalesce(nullif(name, ''), nullif(title, ''), 'Untitled listing'),
    description = coalesce(nullif(description, ''), 'No description provided.'),
    location = coalesce(nullif(location, ''), 'Not specified'),
    image_url = coalesce(image_url, cover_image_url, thumbnail_url, ''),
    cover_image_url = coalesce(cover_image_url, image_url, thumbnail_url, ''),
    thumbnail_url = coalesce(thumbnail_url, image_url, cover_image_url, ''),
    gallery_images = coalesce(
        gallery_images,
        array_remove(array[
            nullif(image_url, ''),
            nullif(cover_image_url, ''),
            nullif(thumbnail_url, '')
        ], null),
        '{}'
    ),
    type = case when type in ('tour', 'activity', 'guide', 'event') then type else 'activity' end,
    category = coalesce(nullif(category, ''), nullif(sub_category, ''), type, 'activity'),
    sub_category = coalesce(nullif(sub_category, ''), nullif(category, ''), type, 'activity'),
    price = coalesce(price, 0)
where title is null
   or title = ''
   or name is null
   or name = ''
   or description is null
   or description = ''
   or location is null
   or location = ''
   or image_url is null
   or cover_image_url is null
   or thumbnail_url is null
   or type is null
   or type not in ('tour', 'activity', 'guide', 'event')
   or category is null
   or category = ''
   or sub_category is null
   or sub_category = ''
   or price is null;

update public.posts
set type = 'guide'
where type = 'event';

update public.posts
set type = 'activity'
where type is not null
  and type not in ('tour', 'activity', 'guide');

update public.posts
set gallery_images = array_remove(array[
    nullif(image_url, ''),
    nullif(cover_image_url, ''),
    nullif(thumbnail_url, '')
], null)
where gallery_images is null
   or cardinality(gallery_images) = 0;

alter table public.posts
    alter column title set default 'Untitled listing',
    alter column name set default 'Untitled listing',
    alter column description set default 'No description provided.',
    alter column location set default 'Not specified',
    alter column image_url set default '',
    alter column cover_image_url set default '',
    alter column thumbnail_url set default '',
    alter column gallery_images set default '{}',
    alter column type set default 'activity',
    alter column category set default 'activity',
    alter column sub_category set default 'activity',
    alter column price set default 0,
    alter column status set default 'published';

alter table public.posts
    drop constraint if exists posts_type_check;

alter table public.posts
    add constraint posts_type_check
    check (type in ('tour', 'activity', 'guide'));

create or replace function public.is_admin_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = check_user_id
          and role = 'admin'
    );
$$;

create or replace function public.is_verified_provider(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = check_user_id
          and role in ('tour_company', 'tour_instructor', 'tour_guide')
          and verification_status = 'approved'
    );
$$;

grant execute on function public.is_admin_user(uuid) to anon, authenticated, service_role;
grant execute on function public.is_verified_provider(uuid) to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.verification enable row level security;
alter table public.posts enable row level security;
alter table public.bookings enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.moderation_audit_logs enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (
    true
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
    id = auth.uid()
    or public.is_admin_user()
)
with check (
    id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "verification_select_self_or_admin" on public.verification;
create policy "verification_select_self_or_admin"
on public.verification
for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "verification_insert_provider_self" on public.verification;
create policy "verification_insert_provider_self"
on public.verification
for insert
to authenticated
with check (
    user_id = auth.uid()
    and role in ('tour_company', 'tour_instructor', 'tour_guide')
    and status = 'pending'
);

drop policy if exists "verification_update_provider_resubmit_or_admin" on public.verification;
create policy "verification_update_provider_resubmit_or_admin"
on public.verification
for update
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
)
with check (
    public.is_admin_user()
    or (
        user_id = auth.uid()
        and role in ('tour_company', 'tour_instructor', 'tour_guide')
        and status = 'resubmitted'
    )
);

drop policy if exists "posts_public_read_published" on public.posts;
create policy "posts_public_read_published"
on public.posts
for select
to anon, authenticated
using (
    status = 'published'
    or provider_user_id = auth.uid()
    or user_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "posts_provider_insert_verified" on public.posts;
create policy "posts_provider_insert_verified"
on public.posts
for insert
to authenticated
with check (
    public.is_verified_provider()
    and (
        provider_user_id = auth.uid()
        or user_id = auth.uid()
    )
    and status in ('pending', 'published')
);

drop policy if exists "posts_update_owner_or_admin" on public.posts;
create policy "posts_update_owner_or_admin"
on public.posts
for update
to authenticated
using (
    provider_user_id = auth.uid()
    or user_id = auth.uid()
    or public.is_admin_user()
)
with check (
    public.is_admin_user()
    or (
        public.is_verified_provider()
        and (
            provider_user_id = auth.uid()
            or user_id = auth.uid()
        )
        and status in ('pending', 'published')
    )
);

drop policy if exists "bookings_select_participants_or_admin" on public.bookings;
create policy "bookings_select_participants_or_admin"
on public.bookings
for select
to authenticated
using (
    user_id = auth.uid()
    or provider_user_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "bookings_insert_traveler_self" on public.bookings;
create policy "bookings_insert_traveler_self"
on public.bookings
for insert
to authenticated
with check (
    user_id = auth.uid()
    and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'tourist'
    )
);

drop policy if exists "bookings_update_participants_or_admin" on public.bookings;
create policy "bookings_update_participants_or_admin"
on public.bookings
for update
to authenticated
using (
    user_id = auth.uid()
    or provider_user_id = auth.uid()
    or public.is_admin_user()
)
with check (
    user_id = auth.uid()
    or provider_user_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "conversations_select_participants_or_admin" on public.conversations;
create policy "conversations_select_participants_or_admin"
on public.conversations
for select
to authenticated
using (
    traveler_id = auth.uid()
    or provider_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "conversations_insert_participants" on public.conversations;
create policy "conversations_insert_participants"
on public.conversations
for insert
to authenticated
with check (
    traveler_id = auth.uid()
    or provider_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "conversation_messages_select_participants" on public.conversation_messages;
create policy "conversation_messages_select_participants"
on public.conversation_messages
for select
to authenticated
using (
    exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and (
              c.traveler_id = auth.uid()
              or c.provider_id = auth.uid()
              or public.is_admin_user()
          )
    )
);

drop policy if exists "conversation_messages_insert_participants" on public.conversation_messages;
create policy "conversation_messages_insert_participants"
on public.conversation_messages
for insert
to authenticated
with check (
    sender_user_id = auth.uid()
    and exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and (
              c.traveler_id = auth.uid()
              or c.provider_id = auth.uid()
              or public.is_admin_user()
          )
    )
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    actor_user_id uuid references auth.users(id) on delete set null,
    type text not null,
    title text not null,
    body text,
    metadata jsonb not null default '{}'::jsonb,
    is_read boolean not null default false,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.notifications
    add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
    add column if not exists type text,
    add column if not exists title text,
    add column if not exists body text,
    add column if not exists metadata jsonb default '{}'::jsonb,
    add column if not exists is_read boolean default false,
    add column if not exists read_at timestamptz,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now();

update public.notifications
set
    metadata = coalesce(metadata, '{}'::jsonb),
    is_read = coalesce(is_read, false),
    title = coalesce(nullif(title, ''), 'Notification'),
    type = coalesce(nullif(type, ''), 'message_new'),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, created_at, now())
where metadata is null
   or is_read is null
   or title is null
   or title = ''
   or type is null
   or type = ''
   or created_at is null
   or updated_at is null;

alter table public.notifications
    alter column type set not null,
    alter column title set not null,
    alter column metadata set not null,
    alter column metadata set default '{}'::jsonb,
    alter column is_read set not null,
    alter column is_read set default false,
    alter column created_at set default now(),
    alter column updated_at set default now();

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, is_read);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_owner_or_admin" on public.notifications;
create policy "notifications_select_owner_or_admin"
on public.notifications
for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "notifications_insert_actor_or_owner_or_admin" on public.notifications;
create policy "notifications_insert_actor_or_owner_or_admin"
on public.notifications
for insert
to authenticated
with check (
    actor_user_id = auth.uid()
    or user_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "notifications_update_owner_or_admin" on public.notifications;
create policy "notifications_update_owner_or_admin"
on public.notifications
for update
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
)
with check (
    user_id = auth.uid()
    or public.is_admin_user()
);

drop policy if exists "notifications_delete_owner_or_admin" on public.notifications;
create policy "notifications_delete_owner_or_admin"
on public.notifications
for delete
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
);

do $$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table public.notifications;
    end if;
exception
    when undefined_table then null;
    when undefined_object then null;
end $$;

drop policy if exists "moderation_audit_logs_select_admin_only" on public.moderation_audit_logs;
create policy "moderation_audit_logs_select_admin_only"
on public.moderation_audit_logs
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "moderation_audit_logs_insert_actor_or_admin" on public.moderation_audit_logs;
create policy "moderation_audit_logs_insert_actor_or_admin"
on public.moderation_audit_logs
for insert
to authenticated
with check (
    actor_user_id = auth.uid()
    or target_user_id = auth.uid()
    or public.is_admin_user()
);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "avatars_user_insert_own" on storage.objects;
create policy "avatars_user_insert_own"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_user_update_own" on storage.objects;
create policy "avatars_user_update_own"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
)
with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars_user_delete_own" on storage.objects;
create policy "avatars_user_delete_own"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
);

-- Notes:
-- 1. Admin moderation in the app assumes admins have profiles.role = 'admin'.
-- 2. Provider listings publish instantly after account verification; only provider accounts, not listings, go through admin approval.
-- 3. Service role bypasses RLS; keep it server-side only.
-- 4. Legacy events are now treated as guides in product UX. Optional migration:
--    update public.posts set type = 'guide' where type = 'event';
-- 5. If you still have public data in legacy tours / activities / events tables, run docs/legacy-content-to-posts.sql and then remove the temporary client-side fallback merge.
-- 6. Notifications module change log + rollback snapshots are documented in docs/notifications-db-change-log.md.
