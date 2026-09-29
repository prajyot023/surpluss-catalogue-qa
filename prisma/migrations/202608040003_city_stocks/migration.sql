create table cities (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  name text not null,
  region text,
  created_at timestamptz not null default now()
);

create table product_stocks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  city_id uuid not null references cities(id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id, city_id)
);
create index product_stocks_city_id_idx on product_stocks (city_id);
