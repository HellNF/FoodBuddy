import { useState } from 'react';
import ExerciseLog from '../components/ExerciseLog';
import ExerciseLibrary from '../components/ExerciseLibrary';
import ExerciseEquipment from '../components/ExerciseEquipment';
import WorkoutPlans from '../components/WorkoutPlans';
import ExerciseWeekView from '../components/ExerciseWeekView';
import WorkoutSessions from '../components/WorkoutSessions';
import { useT } from '../i18n/useT';

type ExerciseTab = 'log' | 'library' | 'plans' | 'week' | 'equipment' | 'sessions';

const TABS: { id: ExerciseTab; key: string }[] = [
  { id: 'sessions',  key: 'exercise.tabSessions' },
  { id: 'log',       key: 'exercise.tabLog' },
  { id: 'library',   key: 'exercise.tabLibrary' },
  { id: 'plans',     key: 'exercise.tabPlans' },
  { id: 'week',      key: 'exercise.tabWeek' },
  { id: 'equipment', key: 'exercise.tabEquipment' },
];

export default function ExercisePage() {
  const { t } = useT();
  const [tab, setTab] = useState<ExerciseTab>('sessions');

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-0 h-full min-h-0">
      <h1 className="text-xl font-bold text-text mb-4">Exercise</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border shrink-0 mb-6 overflow-x-auto">
        {TABS.map(({ id, key }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
              tab === id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-sec hover:text-text'
            }`}
          >
            {t(key as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'sessions'  && <WorkoutSessions />}
        {tab === 'log'       && <ExerciseLog />}
        {tab === 'library'   && <ExerciseLibrary />}
        {tab === 'plans'     && <WorkoutPlans />}
        {tab === 'week'      && <ExerciseWeekView />}
        {tab === 'equipment' && <ExerciseEquipment />}
      </div>
    </div>
  );
}
