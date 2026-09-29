create extension if not exists "pgcrypto";
create type catalogue_status as enum ('draft', 'published', 'inactive', 'expired');
create type pricing_mode as enum ('mrp_and_offer', 'offer_only', 'on_enquiry');
create type enquiry_status as enum ('new', 'contacted', 'qualified', 'won', 'lost', 'spam');
create type attribute_type as enum ('text', 'number', 'date', 'single_select', 'multi_select');

create table catalogues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  category text,
  currency char(3) not null default 'INR',
  pricing_mode pricing_mode not null default 'mrp_and_offer',
  status catalogue_status not null default 'draft',
  cover_image_url text,
  expires_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  brand text,
  category text,
  description text not null default '',
  image_urls text[] not null default '{}',
  attributes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table catalogue_listings (
  id uuid primary key default gen_random_uuid(),
  catalogue_id uuid not null references catalogues(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  offer_price numeric(14,2),
  mrp numeric(14,2),
  pricing_mode pricing_mode,
  quantity integer not null check (quantity >= 0),
  moq integer not null default 1 check (moq > 0),
  is_visible boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalogue_id, product_id)
);
create table attribute_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  created_at timestamptz not null default now()
);
create table attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references attribute_templates(id) on delete cascade,
  catalogue_id uuid references catalogues(id) on delete cascade,
  key text not null,
  label text not null,
  type attribute_type not null default 'text',
  options jsonb not null default '[]',
  is_filterable boolean not null default false,
  display_order integer not null default 0,
  check (template_id is not null or catalogue_id is not null)
);
create table enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  catalogue_id uuid not null references catalogues(id) on delete restrict,
  buyer_name text not null,
  company text,
  phone_country_code text not null default '+91',
  phone text not null,
  email text,
  location text,
  message text,
  status enquiry_status not null default 'new',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table enquiry_items (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  catalogue_listing_id uuid not null references catalogue_listings(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0)
);
alter table enquiry_items add constraint enquiry_items_enquiry_listing_key unique (enquiry_id, catalogue_listing_id);
create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status text not null default 'mapping',
  column_mapping jsonb not null default '{}',
  row_count integer not null default 0,
  valid_count integer not null default 0,
  error_count integer not null default 0,
  errors jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index catalogue_listings_catalogue_idx on catalogue_listings(catalogue_id, display_order);
create index enquiries_status_created_idx on enquiries(status, created_at desc);
create index enquiries_catalogue_idx on enquiries(catalogue_id, created_at desc);
create index products_search_idx on products using gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || sku));
