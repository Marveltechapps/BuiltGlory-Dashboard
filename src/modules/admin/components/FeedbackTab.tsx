import { useQuery } from '@tanstack/react-query';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { relativeLong, statusBadge, statusLabel } from '../../../lib/format';
import { listFeedback, updateFeedbackStatus } from '../../../services/support';
import { toast } from '../../../store/uiStore';

/** Admin › Feedback — GET /admin/feedback, PATCH /admin/feedback/:id { status }. */
export function FeedbackTab() {
  const q = useQuery({ queryKey: ['feedback'], queryFn: ({ signal }) => listFeedback(signal) });
  const set = useRefreshingMutation((v: { id: string; status: 'reviewed' | 'archived' }) => updateFeedbackStatus(v.id, v.status), [['feedback']]);
  const fb = q.data?.items ?? [];
  return (
    <RecordDetailView
      state={q.isPending ? 'loading' : q.isError ? 'error' : 'ok'}
      isPage
      onRetry={() => void q.refetch()}
      errorTitle="Could not load feedback"
      title="Feedback"
      meta="What users tell us from the app"
      single
      main={[
        {
          title: 'Overview',
          cols: 3,
          fields: [
            { label: 'Total Feedback', value: q.data?.total ?? fb.length, strong: true },
            { label: 'New', value: fb.filter((x) => x.status === 'new').length, strong: true, color: '#1d4ed8' },
            { label: 'Reviewed', value: fb.filter((x) => x.status === 'reviewed').length, strong: true, color: '#15803d' },
          ],
        },
        {
          title: 'All feedback',
          rows: fb.map((x) => ({
            key: x.id,
            title: '“' + x.message + '”',
            sub: x.userName + ' · ' + statusLabel(x.source) + (x.sourceScreen ? ' / ' + x.sourceScreen : '') + ' · ' + relativeLong(x.createdAt),
            badges: [statusBadge(x.status)],
            actions: [
              x.status === 'new' ? { label: 'Mark reviewed', variant: 'green' as const, onClick: () => set.mutate({ id: x.id, status: 'reviewed' }, { onSuccess: () => toast('Feedback marked reviewed') }) } : null,
              x.status !== 'archived' ? { label: 'Archive', onClick: () => set.mutate({ id: x.id, status: 'archived' }, { onSuccess: () => toast('Feedback archived') }) } : null,
            ],
          })),
          empty: fb.length ? '' : 'No feedback submitted yet',
        },
      ]}
    />
  );
}
