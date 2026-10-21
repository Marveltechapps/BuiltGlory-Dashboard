import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import s from '../../../components/ui/Modal.module.css';
import { SLOTS } from '../../../constants/enquiries';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { date, time12, time24, todayIso } from '../../../lib/format';
import { updateVisitStatus } from '../../../services/enquiries';
import { toast } from '../../../store/uiStore';
import type { Visit } from '../../../types/enquiries';

/** Reschedule visit: PATCH /admin/visits/:id/status { status: 'rescheduled', visitDate, visitTime }. */
export function RescheduleVisitModal({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const today = todayIso();
  const [day, setDay] = useState(visit.visitDate >= today ? visit.visitDate : today);
  const cur = time12(visit.visitTime).replace(/^(\d):/, '0$1:');
  const [time, setTime] = useState(SLOTS.includes(cur) ? cur : '10:00 AM');
  const [error, setError] = useState('');
  const m = useRefreshingMutation(() => updateVisitStatus(visit.id, { status: 'rescheduled', visitDate: day, visitTime: time24(time) }), [['visits'], ['visit', visit.id]]);
  const submit = () => {
    if (!day || day < today) return setError(!day ? 'Date is required' : 'Visit date cannot be in the past');
    m.mutate(undefined, {
      onSuccess: () => {
        onClose();
        toast('🔄 Visit rescheduled to ' + date(day + 'T12:00:00') + ', ' + time);
      },
    });
  };
  return (
    <Modal open onClose={onClose} maxWidth={420} zIndex={105}>
      <h3 className={s.title}>Reschedule visit</h3>
      <div className={s.fields}>
        <label className={s.label}>
          Date
          <input className="bg-input" type="date" min={today} value={day} aria-invalid={!!error} onChange={(e) => { setDay(e.target.value); setError(''); }} />
          {error && <span className={s.error}>{error}</span>}
        </label>
        <label className={s.label}>
          Time
          <select className="bg-input" value={time} onChange={(e) => setTime(e.target.value)}>
            {SLOTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
      <div className={s.actions}>
        <Button variant="primary" onClick={submit} loading={m.isPending}>Reschedule</Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
