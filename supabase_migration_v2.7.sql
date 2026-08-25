-- Migrazione v2.6 -> v2.7 — residenza all'estero (iscritti AIRE).
-- Eseguire nel SQL Editor di Supabase PRIMA di pubblicare il sito aggiornato.
--
-- Gli italiani iscritti all'AIRE votano nella circoscrizione Estero, quindi sono
-- parte del corpo elettorale e ha senso poterli distinguere. Per loro la regione
-- vale 'Estero (iscritto AIRE)', la provincia e il comune restano vuoti e al loro
-- posto viene indicato il paese.

alter table public.quiz_responses
  add column if not exists paese_estero text;

-- La provincia diventa facoltativa: chi vive all'estero non ne ha una.
alter table public.quiz_responses
  alter column provincia drop not null;

comment on column public.quiz_responses.paese_estero is
  'Paese di residenza per chi ha indicato "Estero (iscritto AIRE)" come regione. Null per i residenti in Italia.';
comment on column public.quiz_responses.provincia is
  'Null per chi risiede all''estero; in quel caso fa fede paese_estero.';

-- Controllo di coerenza: o si e' residenti in Italia con una provincia, o
-- all'estero con un paese. Mai entrambi, mai nessuno dei due.
alter table public.quiz_responses
  drop constraint if exists residenza_coerente;
alter table public.quiz_responses
  add constraint residenza_coerente check (
    (regione = 'Estero (iscritto AIRE)' and paese_estero is not null and provincia is null)
    or
    (regione <> 'Estero (iscritto AIRE)' and paese_estero is null and provincia is not null)
  );

-- Verifica
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'quiz_responses'
order by ordinal_position;
