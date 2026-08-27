-- v2.9 — NESSUNA MIGRAZIONE NECESSARIA.
--
-- Dalla v2.9 la classifica soggettiva non chiede piu' di ordinare tutti e undici
-- i partiti ma solo i primi tre, e la scelta e' obbligatoria. Lo schema non
-- cambia: self_ranking non ha vincoli di lunghezza e le colonne coinvolte sono
-- gia' nullable, quindi un array di tre elementi entra come entrava quello di
-- undici.
--
-- Questo file aggiorna soltanto i commenti delle colonne, perche' descrivevano
-- un comportamento che non esiste piu'. Eseguirlo e' facoltativo e non tocca
-- dati ne' struttura.

comment on column public.quiz_responses.self_ranking is
  'Dalla v2.9: i tre partiti scelti dall''utente, dal piu'' vicino al terzo. Nelle risposte precedenti conteneva la classifica completa dei partiti che l''utente aveva voluto ordinare.';

comment on column public.quiz_responses.self_ranking_unknown is
  'OBSOLETA dalla v2.9: sempre null. Nelle risposte precedenti conteneva i partiti che l''utente aveva dichiarato di non conoscere, informazione che con la top 3 non viene piu'' raccolta.';

comment on column public.quiz_responses.self_ranking_presented is
  'Ordine casuale in cui gli undici partiti sono stati mostrati. Serve a controllare in analisi se la posizione sullo schermo abbia influenzato la scelta.';
