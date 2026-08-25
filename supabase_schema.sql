-- Schema per "Che Partito Sei?" — eseguire una volta nel SQL Editor di Supabase.
--
-- Il sito e' statico e parla con Supabase direttamente dal browser usando la
-- anon key, che e' pubblica per definizione. A proteggere i dati non e' quindi
-- la chiave ma le policy qui sotto: chiunque puo' INSERIRE una compilazione,
-- nessuno puo' RILEGGERE, modificare o cancellare le risposte raccolte.
-- Le letture si fanno dalla dashboard Supabase o con la service_role key, che
-- non deve mai finire nel repo.

create table if not exists public.quiz_responses (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  quiz_version      text        not null,

  -- Dati socio-demografici del form
  eta_fascia        text        not null check (eta_fascia in ('14-17','18-24','25-34','35-44','45-54','55-64','65-74','75+')),
  sesso             text        not null check (sesso in ('maschio', 'femmina', 'non_binario', 'non_indicare')),
  regione           text        not null,
  provincia         text        not null,
  comune            text,       -- facoltativo dalla v2.6: null se non indicato
  istruzione        text        not null check (istruzione in ('elementari', 'media', 'superiori', 'triennale', 'magistrale', 'dottorato')),
  occupazione       text        not null check (occupazione in ('studente', 'disoccupato', 'tirocinante', 'pubblico', 'privato', 'indipendente', 'pensionato')),
  reddito           text        not null check (reddito in ('0-15000', '15001-28000', '28001-50000', '50001-75000', '75001+', 'non_indicare')),
  cittadinanza      boolean     not null,

  -- Risposte al quiz: array di valori 1-7, uno per domanda.
  -- Il range e' volutamente largo: se un domani il quiz cambia numero di
  -- domande, gli invii non devono iniziare a fallire in silenzio.
  answers           jsonb       not null check (jsonb_array_length(answers) between 10 and 100),

  -- { winner, ranking: [{ party, score }] } calcolato dal client
  results           jsonb       not null,

  -- Classifica soggettiva dei partiti, dal piu' vicino al piu' lontano secondo
  -- l'utente, raccolta PRIMA di mostrargli i risultati. Nullable: le risposte
  -- della v2.1 non ce l'hanno. Vedi supabase_migration_v2.2.sql.
  self_ranking            jsonb,   -- solo i partiti che ha voluto ordinare
  self_ranking_unknown    jsonb,   -- quelli dichiarati sconosciuti
  self_ranking_presented  jsonb,   -- ordine in cui gli sono stati mostrati
  self_ranking_ms         integer, -- tempo impiegato, per riconoscere le risposte a caso

  -- Consenso esplicito ex art. 9(2)(a) GDPR e versione dell'informativa a cui si
  -- riferisce. L'art. 7(1) impone di poter DIMOSTRARE il consenso, non solo di
  -- averlo chiesto. Vedi supabase_migration_v2.5.sql.
  consenso_esplicito      boolean,
  informativa_versione    text,

  -- Orologio del browser: utile solo per diagnosticare, non fidarsene.
  -- Per l'analisi usare created_at, che e' del server.
  client_timestamp  timestamptz
);

-- Nessun dato identificativo viene salvato: niente IP, niente user agent,
-- niente identificatore di sessione. Il comune e' il dettaglio geografico
-- piu' fine raccolto.

alter table public.quiz_responses enable row level security;

-- Solo inserimento, per i visitatori anonimi del sito
drop policy if exists "anon puo inserire una compilazione" on public.quiz_responses;
create policy "anon puo inserire una compilazione"
  on public.quiz_responses
  for insert
  to anon
  with check (true);

-- Nessuna policy di select/update/delete: in RLS cio' che non e' concesso
-- e' negato, quindi le risposte restano illeggibili dal client.
grant insert on table public.quiz_responses to anon;
revoke select, update, delete on table public.quiz_responses from anon;

-- Indici per le analisi aggregate piu' probabili
create index if not exists quiz_responses_created_at_idx on public.quiz_responses (created_at);
create index if not exists quiz_responses_regione_idx    on public.quiz_responses (regione);
