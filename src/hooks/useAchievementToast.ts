import { useToast } from '../components/Toast';
import { useT } from '../i18n/useT';

export function useAchievementToast() {
  const { showToast } = useToast();
  const { t } = useT();

  return function showAchievements(achievements: Array<{ name: string; icon: string }>) {
    for (const a of achievements) {
      setTimeout(() => {
        const msg = t('gamification.achievement').replace('{name}', a.name);
        showToast(`${a.icon} ${msg}`, 4000);
      }, 500);
    }
  };
}
