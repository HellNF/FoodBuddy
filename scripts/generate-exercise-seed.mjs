/**
 * Downloads free-exercise-db from GitHub and generates main/data/exercises-seed.json
 * Run once: node scripts/generate-exercise-seed.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '../main/data/exercises-seed.json');
const URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const CAT_MAP = {
  strength:               'strength',
  cardio:                 'cardio',
  stretching:             'flexibility',
  plyometrics:            'cardio',
  powerlifting:           'strength',
  'olympic weightlifting':'strength',
  strongman:              'strength',
};

const MET_MAP = {
  strength:    5.0,
  cardio:      8.0,
  flexibility: 2.5,
};

const MUSCLE_MAP = {
  abdominals:   'abs',
  abductors:    'abductors',
  adductors:    'adductors',
  biceps:       'biceps',
  calves:       'calves',
  chest:        'chest',
  forearms:     'forearms',
  glutes:       'glutes',
  hamstrings:   'hamstrings',
  'hip flexors':null,
  'it bands':   'quadriceps',
  lats:         'back',
  'lower back': 'back',
  'middle back':'back',
  neck:         null,
  quadriceps:   'quadriceps',
  shoulders:    'shoulders',
  traps:        'traps',
  triceps:      'triceps',
};

function mapMuscles(arr) {
  const seen = new Set();
  const out = [];
  for (const m of (arr || [])) {
    const mapped = MUSCLE_MAP[m.toLowerCase()];
    if (mapped && !seen.has(mapped)) { seen.add(mapped); out.push(mapped); }
  }
  return out.join(',');
}

function mapEquipment(eq) {
  if (!eq || eq === 'body only') return '';
  return eq;
}

console.log('Fetching exercises.json…');
const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const raw = await res.json();

const exercises = raw.map(e => {
  const cat = CAT_MAP[e.category] || 'other';
  const muscles = mapMuscles([...(e.primaryMuscles || []), ...(e.secondaryMuscles || [])]);
  return {
    name:         e.name,
    met_value:    MET_MAP[cat] ?? 5.0,
    category:     cat,
    muscle_groups:muscles,
    equipment:    mapEquipment(e.equipment),
    instructions: (e.instructions || []).join('\n'),
  };
});

writeFileSync(OUT, JSON.stringify(exercises, null, 2));
console.log(`Done. ${exercises.length} exercises → ${OUT}`);
