-- Run once in the bnaimitzvah project's Supabase SQL Editor.
create table if not exists public.link_deck_links (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null,
  category text not null default '' check (char_length(category) <= 40),
  description text not null default '' check (char_length(description) <= 240),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists link_deck_links_user_id_idx on public.link_deck_links (user_id);
alter table public.link_deck_links enable row level security;
revoke all on table public.link_deck_links from anon;
grant select, insert, update, delete on table public.link_deck_links to authenticated;

drop policy if exists "link_deck_select_own" on public.link_deck_links;
create policy "link_deck_select_own" on public.link_deck_links for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "link_deck_insert_own" on public.link_deck_links;
create policy "link_deck_insert_own" on public.link_deck_links for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "link_deck_update_own" on public.link_deck_links;
create policy "link_deck_update_own" on public.link_deck_links for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "link_deck_delete_own" on public.link_deck_links;
create policy "link_deck_delete_own" on public.link_deck_links for delete to authenticated
  using ((select auth.uid()) = user_id);
