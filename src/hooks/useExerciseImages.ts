import { useState, useEffect } from 'react';

const DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const BASE_IMG_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const LS_KEY = 'exercise_db_cache';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache (warm after first access per session)
let cachedExercises: any[] | null = null;
let fetchingPromise: Promise<any[]> | null = null;

function loadFromStorage(): any[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) { localStorage.removeItem(LS_KEY); return null; }
    return data;
  } catch { return null; }
}

function saveToStorage(data: any[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* localStorage pieno: si usa solo in-memory */ }
}

async function getExercises(): Promise<any[]> {
  if (cachedExercises) return cachedExercises;

  const stored = loadFromStorage();
  if (stored) { cachedExercises = stored; return stored; }

  if (!fetchingPromise) {
    fetchingPromise = fetch(DB_URL)
      .then(r => r.json())
      .then(data => { saveToStorage(data); return data; });
  }
  cachedExercises = await fetchingPromise;
  return cachedExercises!;
}

export function useExerciseImages(exerciseName: string) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchMatches() {
      try {
        const exercises = await getExercises();
        if (!isMounted) return;

        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = normalize(exerciseName);

        let match = exercises.find(ex => normalize(ex.name) === target);
        if (!match) {
          match = exercises.find(ex => normalize(ex.name).includes(target) || target.includes(normalize(ex.name)));
        }

        setImages(match?.images?.length
          ? match.images.map((img: string) => `${BASE_IMG_URL}${img}`)
          : []);
      } catch {
        if (isMounted) setImages([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchMatches();
    return () => { isMounted = false; };
  }, [exerciseName]);

  return { images, loading };
}
