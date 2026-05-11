import { useEffect, useCallback } from 'react';
import { api } from './api';
import { SettingsProvider, useSettings } from './hooks/useSettings';
import { NavigationProvider, useNavigate } from './hooks/useNavigate';
import { ToastProvider, useToast } from './components/Toast';
import { useUndo } from './hooks/useUndo';
import { useT } from './i18n/useT';
import { useAchievementToast } from './hooks/useAchievementToast';

// Pages
import DashboardPage    from './pages/DashboardPage';
import ExercisePage     from './pages/ExercisePage';
import NetPage          from './pages/NetPage';
import FoodsPage        from './pages/FoodsPage';
import PantryPage       from './pages/PantryPage';
import RecipesPage      from './pages/RecipesPage';
import HistoryPage      from './pages/HistoryPage';
import WeekPage         from './pages/WeekPage';
import WeightPage       from './pages/WeightPage';
import SupplementsPage  from './pages/SupplementsPage';
import MeasurementsPage from './pages/MeasurementsPage';
import GoalsPage        from './pages/GoalsPage';
import DataPage         from './pages/DataPage';
import SettingsPage     from './pages/SettingsPage';
import ComparePage      from './pages/ComparePage';
import NotificationsPage from './pages/NotificationsPage';
import SleepPage from './pages/SleepPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import FocusPage from './pages/FocusPage';
import JournalPage from './pages/JournalPage';
import AchievementsPage from './pages/AchievementsPage';
import InsightsPage from './pages/InsightsPage';

import Nav from './components/Nav';
import Onboarding from './components/Onboarding';

// ── Inner app (has access to contexts) ───────────────────────────────────────

function AppInner() {
  const { settings, loading } = useSettings();
  const { page, param, navigate } = useNavigate();
  const { showToast } = useToast();
  const { t } = useT();
  const showAchievements = useAchievementToast();

  useUndo(showToast, t('undo.undone'));

  // Sync theme to body class
  useEffect(() => {
    document.body.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  const handleOnboardingComplete = useCallback(async () => {
    await window.electronAPI.invoke('settings:save', { onboarding_complete: 1 });
    await api.gamification.addPoints({ module: 'onboarding', reason: 'welcome', points: 0 })
      .then(r => { if (r?.new_achievements?.length) showAchievements(r.new_achievements); })
      .catch(() => {});
    window.location.reload();
  }, [showAchievements]);

  // Listen for main process shortcut:quickAdd
  useEffect(() => {
    const handler = () => navigate('dashboard');
    window.electronAPI?.on('shortcut:quickAdd', handler);
    return () => window.electronAPI?.off('shortcut:quickAdd');
  }, [navigate]);

  // Show onboarding for new users (loading guard prevents flicker)
  if (!loading && settings.onboarding_complete !== 1) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Nav activePage={page} />
      <main className="flex-1 overflow-y-auto">
        {page === 'dashboard'    && <DashboardPage />}
        {page === 'exercise'     && <ExercisePage />}
        {page === 'net'          && <NetPage />}
        {page === 'foods'        && <FoodsPage />}
        {page === 'compare'      && <ComparePage />}
        {page === 'pantry'       && settings.pantry_enabled !== 0 && <PantryPage />}
        {page === 'pantry'       && settings.pantry_enabled === 0 && <DashboardPage />}
        {page === 'recipes'      && <RecipesPage />}
        {page === 'history'      && <HistoryPage />}
        {page === 'week'         && <WeekPage weekStart={param?.weekStart} />}
        {page === 'day'          && <DashboardPage initialDate={param?.date} fromWeek={param?.fromWeek} />}
        {page === 'weight'       && <WeightPage />}
        {page === 'supplements'  && <SupplementsPage />}
        {page === 'measurements' && <MeasurementsPage />}
        {page === 'goals'        && <GoalsPage />}
        {page === 'data'         && <DataPage />}
        {page === 'notifications' && <NotificationsPage />}
        {page === 'settings'     && <SettingsPage />}
        {page === 'sleep'        && <SleepPage />}
        {page === 'tasks'        && <TasksPage />}
        {page === 'habits'       && <HabitsPage />}
        {page === 'focus'        && <FocusPage />}
        {page === 'journal'      && <JournalPage />}
        {page === 'achievements' && <AchievementsPage />}
        {page === 'insights'     && <InsightsPage />}
      </main>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <NavigationProvider>
          <AppInner />
        </NavigationProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
