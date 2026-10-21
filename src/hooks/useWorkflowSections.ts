import { useQuery } from '@tanstack/react-query';
import { dateTime, relativeLong, badge } from '../lib/format';
import { createLog, deleteLog, getTimeline, listLogs } from '../services/workflow';
import { toast } from '../store/uiStore';
import type { SectionSpec } from '../types/detail';
import type { EntityType, WorkflowLog } from '../types/workflow';
import type { FormFields } from './useFormFields';
import { useRefreshingMutation } from './useRefreshingMutation';

export const CALL_OUTCOMES = ['Interested', 'Not Interested', 'Callback Later', 'No Answer', 'Wrong Number'];
const OUT_TONE: Record<string, string> = { Interested: 'green', 'Not Interested': 'red', 'Callback Later': 'amber', 'No Answer': 'muted', 'Wrong Number': 'orange' };
const SENT_CHANNELS = ['whatsapp', 'email', 'message', 'push'];

/**
 * Notes, call log, sent messages and activity timeline for any record, all backed by the
 * communication-log endpoints:
 *  GET/POST /admin/workflow/:entityType/:entityId/logs, DELETE /admin/workflow/logs/:logId,
 *  GET /admin/:entityType/:entityId/timeline.
 */
export function useWorkflowSections(type: EntityType, id: string, f: FormFields, createdAt?: string | null) {
  const enabled = !!id && /^[a-f0-9]{24}$/i.test(id);
  const logsQ = useQuery({ queryKey: ['logs', type, id], queryFn: ({ signal }) => listLogs(type, id, undefined, signal), enabled, retry: false });
  const timelineQ = useQuery({ queryKey: ['timeline', type, id], queryFn: ({ signal }) => getTimeline(type, id, signal), enabled, retry: false });
  const keys = [['logs', type, id], ['timeline', type, id]];
  const add = useRefreshingMutation((body: Parameters<typeof createLog>[2]) => createLog(type, id, body), keys);
  const del = useRefreshingMutation((logId: string) => deleteLog(logId), keys);
  const logs: WorkflowLog[] = logsQ.data ?? [];
  const byChannel = (ch: string[]) => logs.filter((l) => ch.includes(l.channel));
  const loadingRow = logsQ.isPending && enabled ? 'Loading…' : logsQ.isError ? 'Could not load entries' : '';

  const notes = (title = 'Notes', subtitle = 'Internal notes only'): SectionSpec => {
    const list = byChannel(['note']);
    return {
      key: 'notes',
      title,
      subtitle,
      rows: list.map((n) => ({
        key: n.id,
        title: n.body || n.summary,
        sub: n.actorName + ' · ' + relativeLong(n.occurredAt),
        actions: [{ label: '🗑', variant: 'red', title: 'Delete note', onClick: () => del.mutate(n.id, { onSuccess: () => toast('Note deleted') }) }],
      })),
      empty: list.length ? '' : loadingRow || 'No notes yet',
      formCols: 1,
      form: [f.inp('note', '', { type: 'textarea', placeholder: 'Add a note...' })],
      actions: [
        {
          label: 'Save Note',
          variant: 'primary',
          loading: add.isPending && f.str('note').trim() !== '',
          onClick: () => {
            const t = f.str('note').trim();
            if (!t) return void f.fail('note', 'Note cannot be empty');
            add.mutate({ channel: 'note', direction: 'internal', summary: t.slice(0, 300), body: t }, { onSuccess: () => { f.set('note', ''); toast('📝 Note saved'); } });
          },
        },
      ],
    };
  };

  const activity = (title = 'Activity'): SectionSpec => {
    const items = (timelineQ.data ?? []).slice(0, 10).map((a) => ({ text: a.summary + ' · ' + a.actorName, time: relativeLong(a.occurredAt) }));
    if (timelineQ.isPending && enabled) items.push({ text: 'Loading activity…', time: '' });
    if (createdAt) items.push({ text: 'Record created', time: dateTime(createdAt), color: '#94a3b8' } as { text: string; time: string; color?: string });
    return { key: 'activity', title, timeline: items, empty: items.length ? '' : 'No activity yet' };
  };

  const callLog = (opts: { title?: string; onLogged?: (outcome: string) => void } = {}): SectionSpec => {
    const list = byChannel(['call']);
    return {
      key: 'calls',
      title: opts.title || 'Call Log',
      rows: list.map((k) => ({
        key: k.id,
        title: (k.outcome || 'Call') + (k.durationMinutes ? ' · ' + k.durationMinutes + ' min' : ''),
        sub: (k.body ? k.body + '\n' : '') + k.actorName + ' · ' + dateTime(k.occurredAt),
        badges: k.outcome ? [badge(k.outcome, OUT_TONE[k.outcome] || 'muted')] : [],
      })),
      empty: list.length ? '' : loadingRow || 'No call attempts yet — log your first call',
      chips: CALL_OUTCOMES.map((o) => ({ label: o, on: f.str('call.out') === o, onClick: () => { f.set('call.out', o); f.set('call.err', ''); } })),
      form: [
        f.inp('call.dur', 'Duration (minutes)', { type: 'number', placeholder: '5' }),
        f.inp('call.at', 'Called at', { type: 'datetime-local' }),
        f.inp('call.notes', 'Notes', { type: 'textarea', placeholder: 'What was discussed?' }),
      ],
      banners: f.str('call.err') ? [{ text: 'Select an outcome', tone: 'error' }] : [],
      actions: [
        {
          label: '+ Log Call',
          variant: 'primary',
          loading: add.isPending && !!f.str('call.out'),
          onClick: () => {
            const out = f.str('call.out');
            if (!out) return f.set('call.err', '1');
            const at = f.str('call.at');
            add.mutate(
              {
                channel: 'call',
                direction: 'outbound',
                summary: 'Call logged: ' + out,
                outcome: out,
                body: f.str('call.notes') || null,
                durationMinutes: Number(f.str('call.dur')) || 0,
                occurredAt: at ? new Date(at).toISOString() : undefined,
              },
              { onSuccess: () => { f.clear('call.'); toast('📞 Call logged'); opts.onLogged?.(out); } },
            );
          },
        },
      ],
    };
  };

  const sent = (): SectionSpec => {
    const m = byChannel(SENT_CHANNELS);
    return {
      key: 'sent',
      title: 'Sent Messages',
      rows: m.slice(0, 6).map((x) => ({
        key: x.id,
        title: (x.channel === 'email' ? '📧 ' : x.channel === 'message' ? '✉️ ' : x.channel === 'push' ? '🔔 ' : '💬 ') + String(x.body || x.summary).slice(0, 70),
        sub: x.summary + ' · ' + relativeLong(x.occurredAt),
      })),
      empty: m.length ? '' : loadingRow || 'No messages sent yet',
    };
  };

  return { notes, activity, callLog, sent, logs, logsQ, timelineQ, addLog: add };
}
