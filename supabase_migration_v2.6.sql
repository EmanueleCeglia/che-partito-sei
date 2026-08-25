-- Migrazione v2.5 -> v2.6 — fasce d'eta' e comune facoltativo.
-- Eseguire nel SQL Editor di Supabase PRIMA di pubblicare il sito aggiornato.
--
-- Motivazione. Nei test con utenti reali il comune obbligatorio faceva
-- abbandonare il questionario: "fosse stata una cosa random non avrei mai messo
-- fino al comune, avrei abbandonato". Meglio piu' risposte con dati meno
-- granulari che poche risposte precise. La stessa modifica riduce di circa 800
-- volte il numero di profili demografici distinti che il form puo' produrre,
-- quindi rende molto piu' difficile risalire a una singola persona.

-- 1. L'eta' diventa una fascia.
alter table public.quiz_responses
  add column if not exists eta_fascia text
    check (eta_fascia in ('14-17','18-24','25-34','35-44','45-54','55-64','65-74','75+'));

-- 2. Il comune diventa facoltativo.
alter table public.quiz_responses
  alter column comune drop not null;

-- 3. La vecchia colonna dell'eta' esatta non viene piu' inviata dal client.
--    ATTENZIONE: il comando qui sotto CANCELLA la colonna e i suoi dati. E'
--    sicuro solo perche' la tabella e' stata svuotata dalle righe di test. Se un
--    domani rieseguissi questa migrazione su dati veri, commenta questa riga e
--    limitati a rendere la colonna nullable:
--        alter table public.quiz_responses alter column eta drop not null;
alter table public.quiz_responses
  drop column if exists eta;

comment on column public.quiz_responses.eta_fascia is
  'Fascia d''eta'' dichiarata. Sostituisce l''eta'' esatta, raccolta fino alla v2.5.';
comment on column public.quiz_responses.comune is
  'Facoltativo dalla v2.6: null se l''utente ha scelto di non indicarlo.';

-- Verifica
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'quiz_responses'
order by ordinal_position;
