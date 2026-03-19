create table if not exists easystore_sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,         -- 'orders' | 'customers'
  last_synced_at timestamptz,     -- 上次成功同步的最新 updated_at
  synced_count integer default 0,
  updated_at timestamptz default now(),
  unique(user_id, resource)
);

alter table easystore_sync_state enable row level security;

drop policy if exists "owner" on easystore_sync_state;
create policy "owner" on easystore_sync_state
  for all using (auth.uid() = user_id);

