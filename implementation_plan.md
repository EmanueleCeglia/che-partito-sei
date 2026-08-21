# Nuove Feature — Banner, Form Demografico, Supabase

## 1. Banner informativo sulle domande polarizzanti

Un banner dismissibile che appare **all'inizio del quiz** (dopo il click "Inizia" e prima della prima domanda). Spiega che le domande riflettono le posizioni reali dei partiti e non intendono polarizzare.

**Testo proposto:**
> ℹ️ **Nota importante**
> Le affermazioni di questo quiz riflettono le posizioni reali dei partiti politici italiani. Alcune domande possono sembrare polarizzanti, ma questo deriva dalla natura stessa delle posizioni dei partiti, non dall'intento dell'app. Il tuo compito è semplicemente indicare quanto sei d'accordo con ciascuna affermazione.

Il banner si chiude con un bottone "Ho capito ✓" e non riappare (salvato in localStorage).

---

## 2. Form socio-demografico obbligatorio

Una nuova schermata tra il **completamento del quiz** e la **visualizzazione dei risultati**.

### Campi del form

| Campo | Tipo | Opzioni |
|-------|------|---------|
| **Età** | Input numerico | Min 14, Max 100 |
| **Sesso** | Select | Maschio, Femmina, Non binario, Preferisco non indicare |
| **Residenza** | 3 select a cascata | Regione → Provincia → Comune (dati ISTAT, ~7.900 comuni) |
| **Livello di istruzione** | Select | Licenza elementare, Licenza media, Diploma superiore, Laurea triennale, Laurea magistrale, Dottorato |
| **Situazione occupazionale** | Select | Studente, Disoccupato/a, Tirocinante, Impiegato/a settore pubblico, Impiegato/a settore privato, Lavoratore/trice indipendente, Pensionato/a |
| **Reddito annuo lordo** | Select | Fino a 15.000€, 15.001–28.000€, 28.001–50.000€, 50.001–75.000€, Oltre 75.000€, Preferisco non indicare |
| **Cittadinanza italiana** | Select | Sì, ho cittadinanza e diritto di voto; No, non ho cittadinanza italiana |

### Dati ISTAT per i comuni

Userò il dataset [matteocontrini/comuni-json](https://github.com/matteocontrini/comuni-json) — contiene tutti i ~7.900 comuni con regione, provincia, CAP e popolazione. Il file è ~210KB (compresso ~40KB).

Per i select a cascata: l'utente seleziona prima la **regione**, poi si popola il select **provincia** con le province di quella regione, infine si popola il select **comune** con i comuni di quella provincia. Ogni select include anche un'opzione di ricerca/filtro per facilitare la selezione.

### Privacy / GDPR

Un box informativo sopra il form:
> 🔒 **Privacy**
> I dati raccolti saranno utilizzati in forma anonima e aggregata per analisi statistica. Non sarà possibile risalire all'identità dei singoli partecipanti. Nessun dato personale identificativo viene memorizzato.

---

## 3. Predisposizione Supabase

Per ora i dati del form + risposte quiz vengono salvati in **localStorage** e inviati a Supabase quando il progetto sarà pronto. Il codice è strutturato così:

```javascript
// Struttura dati che verrà inviata a Supabase
{
  // Dati demografici
  demographics: {
    eta: 25,
    sesso: "maschio",
    regione: "Lombardia",
    provincia: "Milano",
    comune: "Milano",
    istruzione: "Laurea magistrale",
    occupazione: "Impiegato/a settore privato",
    reddito: "28.001-50.000",
    cittadinanza: true
  },
  // Risposte quiz (array di 25 valori 1-7)
  answers: [5, 3, 6, 2, ...],
  // Risultati calcolati
  results: {
    winner: "PD",
    ranking: [
      { party: "PD", score: 5.8 },
      { party: "AVS", score: 5.4 },
      ...
    ]
  },
  // Metadata
  timestamp: "2026-08-21T15:00:00Z",
  quizVersion: "v2.1"
}
```

Quando creerai il progetto Supabase, basterà aggiungere URL e anon key e il codice invierà automaticamente i dati.

---

## Proposed Changes

### Dati
#### [NEW] [comuni.json](file:///d:/Desktop/Project%20Politics/comuni.json)
Dataset ISTAT ridotto (~7.900 comuni con regione, provincia e nome).

### Interfaccia
#### [MODIFY] [index.html](file:///d:/Desktop/Project%20Politics/index.html)
- Aggiunta sezione HTML per il **banner informativo** (nella schermata quiz)
- Aggiunta nuova schermata `#screen-form` con tutti i campi del form demografico
- Aggiunta box GDPR/privacy

#### [MODIFY] [styles.css](file:///d:/Desktop/Project%20Politics/styles.css)
- Stili per il banner informativo (dismissibile, colore info)
- Stili per il form (select, input, layout responsive, cascading selects)
- Stili per il box privacy

### Logica
#### [MODIFY] [app.js](file:///d:/Desktop/Project%20Politics/app.js)
- Logica banner: show/dismiss, localStorage per non rimostrare
- Logica form: validazione campi, cascading regione → provincia → comune
- Caricamento dati ISTAT per i select a cascata
- Salvataggio dati form + risposte in localStorage (pronto per Supabase)
- Nuova schermata nel flusso: quiz → form → risultati

## Verification Plan

### Manual Verification
- Testare i select a cascata regione/provincia/comune con varie combinazioni
- Verificare che il form sia obbligatorio (non si possono vedere i risultati senza compilarlo)
- Verificare il banner si mostra solo la prima volta
- Verificare che i dati vengano salvati correttamente in localStorage
