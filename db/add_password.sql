-- Contraseña por usuario (cifrada / hash PBKDF2). Si está vacía, se usa la contraseña compartida.
alter table users add column if not exists password_hash text;
