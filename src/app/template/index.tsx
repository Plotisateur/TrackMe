import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, EmptyState, ErrorView, Field, ListRow, Row, Screen } from '@/components/ui';
import { useLoader } from '@/hooks/useLoader';
import { useApp } from '@/state/AppContext';
import { attempt } from '@/utils/errors';

export default function TemplatesScreen() {
  const { repos } = useApp();
  const [name, setName] = useState('');
  const loader = useLoader(() => repos.templates.listTemplates(), [repos]);

  const create = async () => {
    if (!name.trim()) return;
    const t = await attempt('create template', () => repos.templates.createTemplate(name));
    if (t) {
      setName('');
      router.push(`/template/${t.id}`);
    }
  };

  return (
    <Screen edges={[]}>
      <Card>
        <Row>
          <Field
            style={{ flex: 1 }}
            placeholder="New template name"
            value={name}
            onChangeText={setName}
            onSubmitEditing={create}
          />
          <Button label="Create" onPress={create} disabled={!name.trim()} />
        </Row>
      </Card>
      {loader.error ? <ErrorView error={loader.error} onRetry={loader.reload} /> : null}
      {loader.data?.length === 0 ? <EmptyState title="No templates" /> : null}
      {(loader.data ?? []).map((t) => (
        <ListRow
          key={t.id}
          title={`${t.name}${t.isPrimary ? ' ★' : ''}`}
          subtitle={`${t.exerciseCount} exercises${t.description ? ` · ${t.description}` : ''}`}
          onPress={() => router.push(`/template/${t.id}`)}
        />
      ))}
    </Screen>
  );
}
