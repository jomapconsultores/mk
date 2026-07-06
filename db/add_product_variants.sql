-- =============================================================================
-- Marketing MAP — Variantes de producto (talla/color/material/etc.) + descuento
-- simple a nivel de producto y de variante.
-- Un producto SIN filas en product_variants sigue siendo su propia "variante
-- implícita única": products/page.tsx, products/[id]/page.tsx y
-- getSalesContext() no cambian de comportamiento para ese caso.
-- La moneda vive SOLO en products.currency (TuringSales la fija por producto,
-- no por variante); product_variants.price es un override opcional en esa
-- misma moneda — por eso NO tiene columna currency propia.
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

create table if not exists product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id) on delete cascade,
  sku               text,
  attributes        jsonb not null default '{}'::jsonb, -- {"talla":"M","color":"Rojo"}
  price             numeric(12,2),  -- override; NULL = usa products.price (misma currency del producto)
  discount_percent  numeric(5,2) check (discount_percent between 0 and 100),
  stock             integer,        -- NULL = sin control de stock (servicios / stock ilimitado)
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_product_variants_product on product_variants(product_id);

do $$ begin
  create trigger trg_product_variants_updated before update on product_variants
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

-- Descuento simple a nivel de producto base: aplica cuando el producto no
-- tiene variantes, o como default si una variante no define el suyo propio.
-- Deliberadamente NO se construye un motor de reglas (por fecha, por cliente,
-- por volumen, cupones...) porque no fue pedido y products/page.tsx +
-- getSalesContext() solo necesitan un número plano.
alter table products add column if not exists discount_percent numeric(5,2)
  check (discount_percent between 0 and 100);

alter table product_variants enable row level security;
-- Sin políticas, igual que products (db/security_rls.sql): el panel usa
-- getAdmin() (service_role), que ignora RLS. Nota: add_ai_agents.sql y
-- add_calls.sql ya rompieron esta convención (RLS sin activar en sus tablas
-- nuevas) — este archivo la retoma para product_variants, no para arreglar
-- ese gap preexistente en otras tablas, que queda fuera de este alcance.
