import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { btn } from '../../../components/detail/sections';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { badge, date, dateTime } from '../../../lib/format';
import { listImportJobs, undoImportJob } from '../../../services/properties';
import { askConfirm, toast } from '../../../store/uiStore';
import type { ImportJob } from '../../../types/properties';
import { downloadCsv } from '../../../lib/csv';

const statusBadge = (j: ImportJob) =>
  j.revertedAt || j.status === 'reverted'
    ? badge('Undone', 'muted')
    : j.status === 'failed'
      ? badge('Failed', 'red')
      : j.rowsRejected > 0
        ? badge('Partial', 'amber')
        : badge('Completed', 'green');

/** Tools › Master Sheet — import history (GET /admin/properties/import-jobs) with undo (POST /admin/import-jobs/:id/undo). */
export function MasterSheetTab() {
  const navigate = useNavigate();
  const [sel, setSel] = useState('');
  const q = useQuery({ queryKey: ['import-jobs'], queryFn: ({ signal }) => listImportJobs(signal) });
  const undo = useRefreshingMutation((id: string) => undoImportJob(id), [['import-jobs'], ['properties']]);
  const jobs = q.data ?? [];
  const imp = jobs.find((j) => j.id === sel);
  const errors = jobs.flatMap((j) => j.errors.map((e) => ({ ...e, job: j })));
  const loadingText = q.isPending ? 'Loading…' : q.isError ? 'Could not load import history' : '';

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Master Sheet"
      meta="Upload and manage property data using the Builtglory Master Sheet"
      single
      main={[
        { title: 'Bulk Upload', text: 'The Master Sheet bulk upload is managed under Properties section for better organization.', actions: [btn('Go to Bulk Upload', () => navigate('/admin/properties/upload'), 'primary')] },
        {
          title: 'Import History',
          rows: jobs.map((j) => ({
            key: j.id,
            title: j.fileName,
            sub: dateTime(j.completedAt || j.createdAt) + ' · ' + j.rowsTotal + ' rows · ' + j.rowsAccepted + ' imported' + (j.referenceId ? ' · ' + j.referenceId : ''),
            badges: [statusBadge(j)],
            actions: [
              { label: 'View Details', onClick: () => setSel(j.id) },
              !j.revertedAt && j.status !== 'reverted' && j.rowsAccepted > 0
                ? {
                    label: 'Undo',
                    variant: 'red' as const,
                    onClick: () =>
                      askConfirm({
                        title: 'Undo this import?',
                        message: j.rowsAccepted + ' imported properties will be removed.',
                        confirmLabel: 'Undo Import',
                        tone: 'destructive',
                        onConfirm: async () => {
                          const r = await undo.mutateAsync(j.id);
                          toast('↩️ Import undone' + (r.revertedCount ? ' · ' + r.revertedCount + ' properties removed' : ''));
                        },
                      }),
                  }
                : null,
            ],
          })),
          empty: jobs.length ? '' : loadingText || 'No imports yet',
          actions: q.isError ? [btn('Retry', () => void q.refetch())] : [],
        },
        imp
          ? {
              title: 'Import ' + imp.referenceId + ' details',
              rows: [
                ...(imp.importedProperties.length
                  ? imp.importedProperties.map((p) => ({ key: p.id, title: '✅ ' + p.title + (p.isDeleted ? ' (removed)' : ''), sub: p.referenceId, onClick: p.isDeleted ? undefined : () => navigate('/admin/properties/' + p.id) }))
                  : [{ key: 'n', title: '(' + imp.rowsAccepted + ' properties imported)' }]),
                ...imp.errors.map((e, i) => ({ key: 'e' + i, title: '❌ Row ' + e.row + (e.field ? ' · ' + e.field : ''), sub: e.message })),
              ],
              actions: [btn('Close', () => setSel(''))],
            }
          : null,
        {
          title: 'Import Error Log',
          rows: errors.map((e, i) => ({ key: e.job.id + i, title: 'Row ' + e.row + ' · ' + (e.field || e.job.referenceId), sub: e.message + ' · ' + date(e.job.createdAt) })),
          empty: errors.length ? '' : loadingText || 'No import errors',
          actions: [
            btn('Export Error Log', () => {
              if (!errors.length) return toast('No import errors to export');
              downloadCsv('import-error-log.csv', ['Import', 'File', 'Row', 'Field', 'Message', 'Date'], errors.map((e) => [e.job.referenceId, e.job.fileName, e.row, e.field, e.message, dateTime(e.job.createdAt)]));
              toast('📥 Exporting error log CSV');
            }),
            btn('Clear Error Log', undefined, 'red', { disabled: true, title: 'Row errors are stored on each import job; the API has no endpoint to clear them.' }),
          ],
        },
      ]}
    />
  );
}
