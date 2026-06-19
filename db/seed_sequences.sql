-- =============================================================================
-- Secuencia de ejemplo: "Seguimiento lead nuevo que no responde"
-- Se inscribe automaticamente a los contactos en etapa 'new' (no dados de baja).
-- Idempotente: se puede correr varias veces sin duplicar.
-- =============================================================================

insert into sequences (name, description, channel, trigger)
select 'Seguimiento lead nuevo',
       'Reactiva a leads nuevos que no responden, con recordatorios y una oferta.',
       'whatsapp',
       '{"stage":"new"}'::jsonb
where not exists (select 1 from sequences where name = 'Seguimiento lead nuevo');

-- Pasos (se borran y recrean para mantenerlos al dia)
delete from sequence_steps
where sequence_id = (select id from sequences where name = 'Seguimiento lead nuevo');

insert into sequence_steps (sequence_id, step_order, delay_hours, ai_prompt, message_template, send_condition)
select s.id, v.step_order, v.delay_hours, v.ai_prompt, v.message_template, v.send_condition
from sequences s,
(values
  (1, 24,
   'Escribe un recordatorio amable preguntando si el cliente tiene alguna duda sobre el producto que vio. Invita a responder.',
   null,
   '{"no_reply_since_last_step": true}'::jsonb),
  (2, 72,
   'El cliente sigue sin responder. Escribe un mensaje corto resaltando el beneficio principal del producto y ofreciendo resolver dudas por aqui.',
   null,
   '{"no_reply_since_last_step": true}'::jsonb),
  (3, 96,
   null,
   'Hola {{nombre}} 👋, queremos ayudarte a empezar con {{producto}}. Si te animas esta semana, te damos una atencion especial. ¿Te cuento como?',
   '{"no_reply_since_last_step": true}'::jsonb),
  (4, 120,
   null,
   'Hola {{nombre}}, no quiero insistir mas de la cuenta 🙂. Si en el futuro te interesa {{producto}}, aqui estare para ayudarte. ¡Un abrazo!',
   '{"no_reply_since_last_step": true}'::jsonb)
) as v(step_order, delay_hours, ai_prompt, message_template, send_condition)
where s.name = 'Seguimiento lead nuevo';
