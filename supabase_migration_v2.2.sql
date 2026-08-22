-- Migrazione v2.1 -> v2.2 — classifica soggettiva dei partiti.
-- Eseguire nel SQL Editor di Supabase PRIMA di pubblicare il sito aggiornato:
-- il client invia queste colonne e, se non esistono, l'inserimento viene
-- rifiutato (le compilazioni finirebbero in coda nel browser invece che a
-- database, per poi essere ritentate al passaggio successivo).
--
-- Le colonne sono nullable perche' le risposte raccolte con la v2.1 non
-- contengono la classifica: in analisi si distinguono con "self_ranking is null"
-- oppure filtrando su quiz_version.

alter table public.quiz_responses
  -- Ordine indicato dall'utente, dal partito piu' vicino al piu' lontano.
  -- Contiene solo i partiti che l'utente ha voluto ordinare.
  add column if not exists self_ranking            jsonb,

  -- Partiti che l'utente ha dichiarato di non conoscere: sono esclusi
  -- dall'ordinamento, ed e' un dato sulla notorieta' dei partiti.
  add column if not exists self_ranking_unknown    jsonb,

  -- Ordine in cui i partiti sono stati MOSTRATI, mescolato per ogni utente.
  -- Serve a verificare in analisi se la posizione di presentazione ha
  -- influenzato quella scelta: senza questo campo l'effetto non e' misurabile.
  add column if not exists self_ranking_presented  jsonb,

  -- Millisecondi impiegati a completare la classifica. Indicatore standard di
  -- qualita': tempi molto bassi segnalano risposte date a caso.
  add column if not exists self_ranking_ms         integer;

-- Verifica: le colonne devono comparire e le policy restare invariate
-- (insert per anon, nessuna lettura).
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'quiz_responses'
order by ordinal_position;
