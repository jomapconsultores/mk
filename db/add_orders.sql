-- =============================================================================
-- Marketing MAP — Pedidos (orders) y sus líneas (order_items).
--
-- Nota respecto al diseño aprobado: `contact_id` se deja NULLABLE (el diseño
-- original lo tenía `not null`, pero el wizard crea el draft ANTES de elegir
-- cliente — `createOrderDraft()` no recibe argumentos, igual que
-- `createAgentDraft()` — así que al insertar la fila todavía no hay contacto).
-- El FK y el `on delete restrict` se mantienen intactos; solo se quita la
-- restricción NOT NULL. `confirmOrder()` exige contact_id no nulo antes de
-- pasar el pedido a 'confirmed', que es el punto donde de verdad importa.
--
-- product_variants se referencia por nombre (product_id/variant_id de
-- order_items) asumiendo que existe con ese esquema; la crea una migración
-- separada (db/add_product_variants.sql), fuera del alcance de este archivo.
--
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

create table if not exists orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number        bigint generated always as identity, -- "N° Pedido" legible en UI
  contact_id          uuid references contacts(id) on delete restrict,
  status              text not null default 'draft'
                        check (status in ('draft','confirmed','shipped','delivered','cancelled')),
  payment_status      text not null default 'pending'
                        check (payment_status in ('pending','paid','failed','refunded')),
  payment_method      text, -- libre: 'efectivo' | 'transferencia' | 'tarjeta' | 'yape' ... sin pasarela real todavía
  requires_shipping   boolean not null default false,
  shipping_address    jsonb, -- solo se usa si requires_shipping = true
  currency            text not null default 'USD',
  subtotal            numeric(12,2) not null default 0,
  discount_total       numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  notes               text,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_orders_contact on orders(contact_id);
create index if not exists idx_orders_status  on orders(status);

do $$ begin
  create trigger trg_orders_updated before update on orders
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

create table if not exists order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  product_id         uuid not null references products(id) on delete restrict,
  variant_id         uuid references product_variants(id) on delete restrict,
  product_name       text not null,     -- snapshot: el pedido no debe cambiar si renombran el producto después
  variant_attributes jsonb,             -- snapshot de attributes de la variante al momento de vender
  quantity           integer not null check (quantity > 0),
  unit_price         numeric(12,2) not null,  -- snapshot ya con descuento aplicado, en la currency del pedido
  discount_percent   numeric(5,2),      -- snapshot informativo del % aplicado
  subtotal           numeric(12,2) not null,  -- quantity * unit_price
  created_at         timestamptz not null default now()
);
create index if not exists idx_order_items_order   on order_items(order_id);
create index if not exists idx_order_items_product on order_items(product_id);

alter table orders       enable row level security;
alter table order_items  enable row level security;
-- Sin políticas, igual que products (db/security_rls.sql): el panel usa
-- getAdmin() (service_role), que ignora RLS.
