# Insight Engine Rewrite — Design Spec
**Data:** 2026-05-12  
**Contesto:** L'engine SP1 genera insight statisticamente validi ma li presenta come statement piatti e non collegati. L'utente vuole narrativa che colleghi un trend ai fattori che lo causano/influenzano, con correlazioni lag-1 esplicite e milestone positive.

---

## Obiettivi

1. **Explained trends**: per ogni trend (es. peso in aumento), surfacciare automaticamente tutti i fattori correlati significativi come cause (y=metrica) o effetti (x=metrica).
2. **Lag-1 visibili**: correlazioni temporali (ieri→oggi) sia integrate nel contesto che in una sezione dedicata.
3. **Scatter reali**: restituire i punti `(x,y)` individuali per le associations → ScatterChart Recharts al posto dei 2-bar.
4. **Milestone insights**: badge positivi per traguardi recenti (streak, record personali).
5. **Engine statistico invariato**: nessuna modifica a `stats.js`, `associations.js` (solo aggiunta `points`), `trends.js`, `anomalies.js`, `factorAnalysis.js`.

---

## Architettura

```
buildInsights(db, {windowDays, settings, today})
  │
  ├─ buildDailyFacts(db, {from, to})            ← invariato
  ├─ computeReliability(facts)                  ← invariato
  ├─ findTrends(facts, settings)                ← invariato
  ├─ findAnomalies(facts, settings, today)      ← invariato
  ├─ findFactorInsights(facts)                  ← invariato
  ├─ findAssociations(facts, settings)          ← +points[]
  ├─ findMilestones(facts, settings)            ← NUOVO
  └─ synthesizeTrendInsights(trends, assocs)    ← NUOVO
       → explained_trend[] sostituisce i plain trend
         che trovano ≥1 fattore correlato
```

**Nuovi file:**
- `main/lib/insights/milestones.js`
- `main/lib/insights/synthesize.js`

**File modificati:**
- `main/lib/insights/associations.js` — aggiunge `points`
- `main/lib/insights/insightBuilder.js` — chiama i nuovi moduli, integra output
- `main/lib/insights/templates.js` — template `explained_trend`, `milestone`; action hints estesi; copy lag-aware
- `src/types.ts` — estende `InsightEvidence`, aggiunge tipi `explained_trend`, `milestone`
- `src/pages/InsightsPage.tsx` — `ExplainedTrendCard`, `LagSection`, scatter reali, `MilestoneCard`

---

## 1. Raw Scatter Points (`associations.js`)

In `findAssociations`, l'array `c.x` / `c.y` esiste già per ogni candidate. Aggiungere al payload del risultato:

```js
points: c.x.map((v, i) => ({ x: v, y: c.y[i] })),
```

Max 200 punti per coppia (finestra 90gg = al massimo ~90 punti, nessun campionamento necessario).

Il campo `points` viene propagato in `insightBuilder.js` dentro `evidence.points`.

---

## 2. Milestones (`milestones.js`)

```js
findMilestones(facts, settings) → Array<MilestoneRaw>
```

### Milestone definite

| id | condizione | descrizione |
|---|---|---|
| `habit_streak_7` | 7 giorni consecutivi con `habitPct >= 0.5` | Streak abitudini 7gg |
| `habit_streak_14` | 14 giorni consecutivi con `habitPct >= 0.5` | Streak abitudini 14gg |
| `habit_streak_30` | 30 giorni consecutivi con `habitPct >= 0.5` | Streak abitudini 30gg |
| `log_streak_7` | 7 giorni consecutivi con `kcalIn > 0` (cibo loggato) | Streak log pasti 7gg |
| `log_streak_14` | 14 giorni consecutivi con `kcalIn > 0` | Streak log pasti 14gg |
| `weight_new_low` | `weight_today < min(weight_last_90gg, escl. today)` | Peso minimo degli ultimi 90gg |
| `perfect_day` | Ieri: `habitPct >= 0.8` AND `kcalIn > 0` AND `sleepMin >= settings.sleepTargetMin` | Giornata completa |

**Regola di surfacing:** un milestone viene incluso nell'output solo se la data di raggiungimento è ≤ 3 giorni fa (evita spam su dati storici). Per streak, la data è l'ultimo giorno della serie. Per `weight_new_low`, la data è today. Per `perfect_day`, è yesterday.

**Non si genera milestone `weight_new_low` se ci sono < 14 giorni di peso nella finestra** (troppo poco contesto).

### Struttura output

```js
{
  kind: 'milestone',
  id: 'habit_streak_7',
  achievedDate: '2026-05-11',  // data raggiungimento
  streakLength: 7,             // solo per streak milestone
  value: null,                 // solo per weight_new_low: valore del peso
}
```

---

## 3. Synthesizer (`synthesize.js`)

```js
synthesizeTrendInsights(trendRaws, assocRaws) → {
  explained: ExplainedTrendRaw[],  // nuovi insight
  consumedTrendIds: Set<string>,   // trend sostituiti (da escludere in builder)
}
```

### Logica

Per ogni `trendRaw` con `metric = M`:
1. **causalFactors**: trova tutte `assocRaw` con `y === M` (M è l'outcome) → fattori che la causano.
2. **downstreamEffects**: trova tutte `assocRaw` con `x === M` (M predice altro).
3. Se `causalFactors.length === 0 && downstreamEffects.length === 0` → non sintetizzare (il trend originale rimane).
4. Altrimenti produce un `ExplainedTrendRaw`, e il trend originale viene marcato come "consumato".

### Struttura output

```js
{
  kind: 'explained_trend',
  metric: 'weightTrend',
  direction: 'up',
  slopePerDay: 0.057,
  slopePerWeek: 0.4,
  n: 21,
  confidence: 'high',
  causalFactors: [         // associations con y = metric
    {
      x: 'kcalBalance', lag: 0, stat: 0.71, n: 28,
      cutoffLabel: 'sopra la mediana', highMean: 0.15, lowMean: -0.05,
      weekendControlled: true, points: [{x,y},...],
    },
    ...
  ],
  downstreamEffects: [     // associations con x = metric
    {
      y: 'mood', lag: 0, stat: -0.38, n: 30,
      cutoffLabel: 'sopra la mediana', highMean: 5.8, lowMean: 7.2,
      weekendControlled: true, points: [{x,y},...],
    },
    ...
  ],
}
```

Le stesse associations non vengono rimosse dalla lista globale — restano visibili nella sezione lag e nella lista standard.

---

## 4. Templates — testo renderizzato

### `explained_trend` (IT)

```
[emoji direzione] Il tuo [metrica] sta [salendo|scendendo] di [+/-X]/settimana (N giorni).

Possibili cause:
• [predictor sopra mediana|cutoffLabel] → [outcome] medio [highMean] vs [lowMean]
  (r/ρ = X, N gg[, lag: il giorno prima])
• ...

Possibili effetti:
• [predictor] in [su|giù] → [outcome] medio [highMean] vs [lowMean]  
  (r/ρ = X, N gg)
• ...
```

Esempio reale:
```
📈 Il tuo peso (trend) sta salendo di +0,4 kg/settimana (21 giorni).

Possibili cause:
• Bilancio calorico sopra la mediana → peso medio +0,15 vs −0,05 (r = 0,71, 28 gg)
• Poche abitudini completate → peso medio più alto (ρ = −0,44, 35 gg)

Possibili effetti:
• Peso in salita → umore medio 5,8 vs 7,2 quando stabile (ρ = −0,38, 30 gg)
```

Se `causalFactors` è vuoto → omette la sezione "Possibili cause". Analogamente per `downstreamEffects`.

### `milestone` (IT)

```
🏆 [descrizione milestone] — [data leggibile]
```

Esempi:
- `🏆 7 giorni consecutivi di abitudini completate — ieri`
- `🏆 Nuovo minimo di peso degli ultimi 90 giorni — oggi (X kg)`
- `🏆 Giornata completa: cibo, sonno e abitudini raggiunti — ieri`

### Associations con `lag > 0` — copy aggiornata (IT)

Il template esistente per `association` viene arricchito: se `lag > 0`, prepende la frase temporale:

```
// lag = 1: "Il giorno prima" invece di "Nei giorni"
"Il giorno prima con [cutoffLabel] di [predictor], [outcome] medio [highMean] vs [lowMean] il giorno dopo..."
```

### Action hints estesi

Aggiungere a `ACTION_HINTS` in `templates.js`:

```js
'sleepMin~kcalIn':            { it: 'dormire poco aumenta la fame il giorno dopo — prova a dormire almeno 7h', en: 'poor sleep increases next-day hunger — aim for 7h+' },
'workoutMin~energy':          { it: 'anche una sessione breve sembra aumentare l\'energia il giorno dopo', en: 'even a short session seems to boost next-day energy' },
'habitPct~mood':              { it: 'le giornate con più abitudini completate coincidono con umore più alto', en: 'days with more habits done correlate with better mood' },
'stress~sleepQuality':        { it: 'lo stress alto si associa a sonno peggiore — considera tecniche di de-stress serali', en: 'high stress links to worse sleep — consider evening wind-down' },
'taskCompletionPct~mood':     { it: 'completare i task giornalieri si associa a umore più alto', en: 'completing daily tasks links to better mood' },
'kcalBalance~weightTrend':    { it: 'il bilancio calorico è il predittore più diretto del trend peso', en: 'calorie balance is the strongest predictor of weight trend' },
'focusMin~mood':              { it: 'le sessioni focus si associano a umore positivo — anche 25 minuti bastano', en: 'focus sessions link to better mood — even 25 min helps' },
'steps~mood':                 { it: 'più passi si associano a umore migliore — prova una camminata quotidiana', en: 'more steps link to better mood — try a daily walk' },
'waterMl~energy':             { it: 'idratazione adeguata si associa a energia più alta nel pomeriggio', en: 'good hydration links to higher energy' },
```

---

## 5. Modifiche a `insightBuilder.js`

```js
const { findMilestones }            = require('./milestones');
const { synthesizeTrendInsights }   = require('./synthesize');

// ...dopo findAssociations:

const milestoneRaws = findMilestones(facts, settings);
const { explained, consumedTrendIds } = synthesizeTrendInsights(trendRaws, assocRaws);

// Tier 1: explained_trend sostituisce plain trend se consumato
for (const et of explained) {
  // renderizza + push con tipo 'explained_trend'
}
for (const t of trendRaws) {
  if (consumedTrendIds.has(`trend:${t.metric}`)) continue; // già sostituito
  // push plain trend (invariato)
}

// Milestone: alta priorità (tier 0, severity 'strong')
for (const m of milestoneRaws) {
  // renderizza + push tipo 'milestone'
}
```

Score `explained_trend`: `SEVERITY_WEIGHT[severity] * confidence * 1.5` (moltiplicatore per surfacciare in cima).
Score `milestone`: fisso alto (`SEVERITY_WEIGHT.strong * CONFIDENCE_FACTOR.high * 1.5`).

Il campo `lang` in `buildInsights` viene letto da settings invece di hardcodato: `const lang = settings.language || 'it';`.

---

## 6. Modifiche UI (`InsightsPage.tsx`)

### `ExplainedTrendCard`
- Nuovo componente. Mostra: header (emoji + trend text), due sezioni collassabili "Possibili cause" / "Possibili effetti".
- Ogni factor row: label predictor → outcome, cifre, mini `ScatterChart` Recharts (50 punti, tooltip con valori, `ReferenceLine` alla mediana X).
- Appare in cima alla lista degli insight, prima delle anomalie.

### `LagSection`
- Filtra `type === 'association' && evidence.lag > 0`.
- Titolo: *"Relazioni temporali (giorno precedente → oggi)"*.
- Ogni row: `[predictor] IERI → [outcome] OGGI`, testo lag-aware dal template, mini ContrastChart (già esistente).
- Collassabile di default se < 2 items.

### `MilestoneCard`
- Ribbon verde in cima alla pagina se ci sono milestone. Max 3 mostrate, poi link "vedi tutte" (espande inline).
- Stile: badge con emoji + testo, background `#16a34a/10`, border verde.

### ScatterChart per associations normali
- In `InsightRow` / `ContrastChart`: se `evidence.points` esiste, mostrare scatter reale invece del 2-bar.
- Axes: X = predictor, Y = outcome. ReferenceLine verticale al cutoff. Tooltip con valori.
- Se `evidence.points` non esiste (retrocompatibilità) → fallback al 2-bar esistente.

---

## 7. `src/types.ts`

```ts
// Aggiungere a InsightEvidence:
points?: { x: number; y: number }[];

// Tipo insight:
type InsightType = 'association' | 'trend' | 'anomaly' | 'factor' | 'milestone' | 'explained_trend';

// ExplainedTrendFactor (embedded in evidence):
interface ExplainedTrendFactor {
  predictor: string;
  outcome: string;
  lag: number;
  stat: number;
  n: number;
  cutoffLabel: string;
  highMean: number;
  lowMean: number;
  weekendControlled: boolean;
  points?: { x: number; y: number }[];
}

// In InsightEvidence aggiungere opzionali:
causalFactors?: ExplainedTrendFactor[];
downstreamEffects?: ExplainedTrendFactor[];
// Per milestone:
milestoneId?: string;
achievedDate?: string;
streakLength?: number;
milestoneValue?: number;
```

---

## 8. Test

L'engine ha già una suite di test in `main/lib/insights/`. Aggiungere:
- `milestones.test.js`: verifica ogni milestone con facts sintetici (streak, weight_new_low, perfect_day).
- `synthesize.test.js`: verifica che explained_trend venga prodotto correttamente, che consumedTrendIds sia corretto, che trend senza fattori restino plain.
- Aggiornare `insightBuilder.test.js` per coprire i nuovi tipi nell'output.

---

## Verifica end-to-end

1. Avvia app con almeno 30 giorni di dati (sonno + umore + cibo loggato). InsightsPage → i plain trend scompaiono, vengono sostituiti da `ExplainedTrendCard` con sezioni cause/effetti.
2. Se ci sono correlazioni lag > 0 significative (es. `sleepMin~mood lag=1`), appare la `LagSection` con copy "Il giorno prima con...".
3. Simulare streak habit: 7 giorni con ≥50% habit loggata → milestone `habit_streak_7` appare in cima.
4. Associations normali: il `ContrastChart` 2-bar viene sostituito da scatter plot quando `evidence.points` è presente.
5. Riavviare con dati scarsi (< 21 giorni): nessuna `ExplainedTrendCard` (associations non raggiungono tier 3), solo trend semplici.

---

## Rischi / edge case

- **Circolarità causa/effetto**: una metrica X può apparire sia come causa (x=X nei causal) che come effetto (y=X nello stesso assoc) — improbabile per il set di PAIRS definito, ma da filtrare nel synthesizer.
- **explained_trend senza testo per metriche non mappate**: `LABELS` in `templates.js` deve coprire tutte le metriche usabili come trend subject. Verificare copertura e aggiungere voci mancanti.
- **Retrocompatibilità `evidence.points`**: UI fa fallback al 2-bar se il campo è assente — sicuro per vecchi dati cached.
- **Milestone `perfect_day` con settings.sleepTargetMin non settato**: default 480 min (8h) — coerente con `insights_sleep_target_min` già esistente.
- **Lang hardcodato `'it'` in `buildInsights`**: corretto leggendolo da `settings.language`. Tuttavia `readSettings()` in `insights.ipc.js` legge solo chiavi `insights_*` — aggiungere `language: db.prepare("SELECT value FROM settings WHERE key='language'").get()?.value || 'en'` all'oggetto restituito da `readSettings()`. Assicurarsi che tutti i nuovi template abbiano versione EN e IT.
