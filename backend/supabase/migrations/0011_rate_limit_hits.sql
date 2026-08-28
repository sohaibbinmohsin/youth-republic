create table rate_limit_hits (
  id bigint generated always as identity primary key,
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_key_idx on rate_limit_hits (rate_key, created_at);

alter table rate_limit_hits enable row level security;
