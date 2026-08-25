-- Migrazione v2.4 -> v2.5 — registrazione del consenso.
-- Eseguire nel SQL Editor di Supabase PRIMA di pubblicare il sito aggiornato:
-- il client invia queste colonne e, se non esistono, l'inserimento viene rifiutato.
--
-- L'articolo 7(1) del GDPR impone al titolare di essere in grado di DIMOSTRARE
-- che l'interessato ha prestato il consenso. Non basta averlo chiesto: va
-- registrato, e va registrato a quale testo si riferiva, perche' un consenso
-- vale per l'informativa che la persona ha effettivamente letto.

alter table public.quiz_responses
  -- Sempre true nei fatti: senza la spunta il form non supera la validazione.
  -- La colonna esiste per poter dimostrare il consenso, non per filtrarlo.
  add column if not exists consenso_esplicito boolean,

  -- Versione del testo dell'informativa vigente al momento della raccolta.
  -- Se il testo cambia, cambia la stringa in app.js (INFORMATIVA_VERSIONE) e le
  -- risposte restano attribuibili al testo giusto.
  add column if not exists informativa_versione text;

-- Le risposte raccolte prima di questa migrazione, se ce ne sono, restano con
-- entrambi i campi a null: sono quelle per cui il consenso esplicito non era
-- ancora stato chiesto e vanno escluse da qualsiasi analisi pubblicata.

comment on column public.quiz_responses.consenso_esplicito is
  'Consenso esplicito ex art. 9(2)(a) GDPR al trattamento delle opinioni politiche.';
comment on column public.quiz_responses.informativa_versione is
  'Versione dell''informativa mostrata all''utente al momento del consenso.';

-- Verifica
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'quiz_responses'
order by ordinal_position;
