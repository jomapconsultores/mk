-- Teléfonos adicionales por contacto (casa y trabajo). El campo `phone` se usa como móvil/principal.
alter table contacts add column if not exists phone_home text;
alter table contacts add column if not exists phone_work text;
