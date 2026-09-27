import { router } from 'expo-router';
import { EmptyState, ErrorView, ListRow, Screen, T } from '@/components/ui';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import { formatDuration, formatLongDate } from '@/utils/date';
import { formatWeight } from '@/utils/units';

export default function HistoryScreen() {
  const { repos, settings } = useApp();
  const loader = useLoader(() => repos.workouts.listSessions({ limit: 500 }), [repos]);
  const sessions = loader.data ?? [];

  return (
    <Screen>
      <T size={28} weight="800">
        History
      </T>
      {loader.error ? <ErrorView error={loader.error} onRetry={loader.reload} /> : null}
      {loader.data && sessions.length === 0 ? (
        <EmptyState title="No workouts yet" message="Completed sessions will appear here." />
      ) : null}
      {sessions.map((s) => {
        const parts = [
          s.completedAt
            ? formatDuration(Date.parse(s.completedAt) - Date.parse(s.startedAt))
            : undefined,
          `${s.completedSetCount} sets`,
          s.bodyWeightKg ? `BW ${formatWeight(s.bodyWeightKg, settings.unit, true)}` : undefined,
        ].filter(Boolean);
        return (
          <ListRow
            key={s.id}
            title={`${formatLongDate(s.startedAt)} · ${s.name}`}
            subtitle={parts.join(' · ')}
            onPress={() => router.push(`/session/${s.id}`)}
          />
        );
      })}
    </Screen>
  );
}
