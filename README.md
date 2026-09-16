# Che Partito Sei?

An Italian political quiz that matches your positions against those of the eleven parties currently
relevant in Italian politics — and, more unusually, tells you where every single one of those party
positions comes from.

**Live at [www.quizpolitico.it](https://www.quizpolitico.it)**

The quiz asks 25 statements on a 1–7 agreement scale, collects demographic information, asks you to
name your own top three parties *before* revealing anything, and only then shows the result.

---

## Why the sourcing matters

Most political quizzes ask you to trust that the party positions behind them are accurate. This one
documents every position it uses.

All 275 cells — 11 parties × 25 questions — are recorded in
[`POSIZIONI_E_FONTI.md`](POSIZIONI_E_FONTI.md) with a source link and an **evidence level**:

| Level | Meaning | Cells |
|:---:|---|---:|
| **A** | Recorded parliamentary vote on that specific measure | 130 |
| **B** | Party programme, statute, bill or official document | 56 |
| **C** | Dated statement by the party leadership | 59 |
| **E** | Position reported by the press, no party act or document | 7 |
| — | **No documented position**: excluded from the calculation | 23 |

Every source cited was re-read when the cell was coded — 2026-09-15 for version 3.0, 2026-09-16 for the
question on EU climate targets added in 3.1 — and each description reports only what the source
actually says. A source that turned out not to contain what was attributed to it was replaced,
or the cell was left empty. There are no inferences left: the level D reconstructions and level F
guesses of earlier versions were either backed by evidence or removed. An empty cell is not a 4 — the
party is simply compared on fewer questions.

Where a party's stated line contradicts how it actually voted, the cell says so
(`DIVERGENZA DOCUMENTATA`) and the score weights the vote.

`fonti_quiz.json` is the single source of truth. [`build_data.py`](build_data.py) generates both
`data.json` and `POSIZIONI_E_FONTI.md` from it, and `python build_data.py --check` fails if either has
been edited by hand. Until v2.9 `data.json` was maintained by hand and had drifted from the
documentation in 135 of 275 cells: the quiz was not using the scores this file documented.

## Question design

The questions were rewritten to remove three defects common to this kind of quiz:

- **Double-barrelled statements.** The old justice question asked about separating judicial careers
  *and* shortening trials — positions that split the parties differently. Someone agreeing with one
  and not the other had no way to answer.
- **Embedded arguments.** "The Prime Minister should be directly elected *to guarantee stability and
  decisiveness*" pushes toward yes. The rationale was removed.
- **Directional imbalance.** People agree more readily than they disagree. If most statements are
  phrased so that agreeing means "left", results drift left. Three questions (cannabis, the 2035
  combustion-engine rule and the EU emission targets) are therefore deliberately inverted, bringing the
  balance to 12 / 12 with one genuinely ambiguous item (retirement age).

Each question in `POSIZIONI_E_FONTI.md` records what was changed and why.

## Reducing bias in the answers

- The **self-ranking screen** asks users to pick the three parties they feel closest to, in order,
  *before* seeing any result. Parties are presented in a **randomly shuffled order that is saved with
  the response**, so presentation-order effects can be controlled for in analysis. The time taken is
  recorded too: three picks made in two seconds are noise, and can be filtered out. Earlier versions
  asked for a full ranking of all eleven parties; the positions at the bottom were largely arbitrary
  and the task was long, so it was cut to the part that carries the signal.
- A **"no opinion" button** with a budget of five uses per quiz. The midpoint of a Likert scale is not
  the same as "I don't know" — research on voting advice applications finds most midpoint answers
  express dilemmas or rejection of the question's premise, not ignorance. The cap also guarantees at
  least twenty substantive answers per response.
- Undocumented party positions are **excluded from that party's average** rather than imputed as a
  neutral 4, which would quietly reward parties nobody has pinned down.

## Known limitations

Stated openly, because they affect how results should be read:

- **The scoring favours parties with moderate profiles.** Scores are `7 − |your answer − party
  position|`, averaged. A party sitting near the middle of every scale is never far from anyone: before
  a user answers a single question, the most centrist party already averages 5.05 against 4.16 for the
  most distinctive one. This does not affect users with coherent views, who are matched correctly
  regardless — it lands entirely on undecided users, who are the quiz's main audience. Two standard
  remedies exist (normalising each party against its own baseline, or the hybrid proximity/directional
  algorithm) and neither is implemented yet.
- **23 positions are undocumented** and left empty. They concentrate on the smaller and newer parties:
  +Europa is compared on 18 questions, the Liberaldemocratici on 19, Futuro Nazionale on 20, against 25
  for the larger parties.
- **Party positions age.** One question had to be rewritten mid-project because the European Commission
  revised the 2035 combustion-engine ban underneath it. `quiz_version` is stored with every response so
  answers stay attributable to the exact questionnaire that produced them.

## Data collected

Age band, sex, region and province of residence — or, for Italians registered as living abroad (AIRE,
who vote in the overseas constituency), the country instead — municipality **only if the user chooses
to give it**, education, employment status, income bracket, citizenship, the 25 answers, the
self-ranking, and the computed result. No date of birth, no IP address, no user agent, no session identifier, no account.

Responses go to a Supabase table whose row-level security policy allows **insert only**: the anonymous
key shipped in the client cannot read back a single response. Reading requires the dashboard.

> **Note on anonymity.** An earlier version asked for exact age and a mandatory municipality, which
> could produce about 1.4 billion distinct demographic profiles for a population of 59 million — most
> of them unique. User testing also showed the mandatory municipality caused people to abandon the
> questionnaire. Both were changed: age is now banded and the municipality is optional, which brings
> the figure down to roughly 1.7 million profiles when it is left out, or about thirty people per
> profile. The data still reveals political opinions, a special category under the GDPR, so it is
> collected under explicit consent and treated as personal data throughout.

## Running it locally

No build step, no dependencies. Any static server will do:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly from the filesystem will not work,
because the app fetches its data with `fetch()`.

To point it at your own Supabase project, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of
`app.js` and run [`supabase_schema.sql`](supabase_schema.sql) in the SQL editor. The anonymous key is
designed to live in browsers; what protects the data are the RLS policies in that file.

## Project structure

```
index.html                    all five screens: landing, quiz, form, self-ranking, results
app.js                        quiz logic, scoring, Supabase submission with offline retry queue
styles.css                    styles
fonti_quiz.json               source of truth: questions, party positions, evidence and sources
build_data.py                 generates data.json and POSIZIONI_E_FONTI.md from fonti_quiz.json
data.json                     generated: the 25 questions and the 11 × 25 scores the quiz uses
POSIZIONI_E_FONTI.md          generated: every party position with its source and evidence level
comuni.json                   7,904 Italian municipalities by region and province
paesi.json                    251 countries, for residents abroad
build_paesi.py                regenerates paesi.json from the ISTAT list
supabase_schema.sql           table, RLS policies, constraints
build_comuni.py               regenerates comuni.json
v.1/                          archive of version 2.9, the last one with hand-maintained scores
```

`v.1/` keeps the project exactly as it was before the scores were rebuilt from the sources, including
the database migrations from v2.2 to v2.9, now folded into `supabase_schema.sql`.

To change a question or a score, edit `fonti_quiz.json` and run `python build_data.py`. Then bump
`QUIZ_VERSION` in `app.js`: it doubles as a cache-busting parameter and as the version stamped on every
stored response, so answers stay attributable to the questionnaire that produced them.

## Open issues

- Scoring normalisation and the hybrid matching algorithm — to be decided against real responses,
  using the self-ranking as an external validation criterion.
- Independent double coding of the party positions, to measure how reproducible the 1–7 scale is
  between coders.
- Independent legal review. Explicit consent, a full Article 13 notice and reduced demographic
  granularity are in place, but none of it has been checked by a lawyer.

## Credits

Built by Emanuele Ceglia, Leo and Dani. Party positions coded from parliamentary records, official
programmes and the press; every source is in `POSIZIONI_E_FONTI.md`.
