import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore, toast } from '../../store/uiStore';
import { createLog, sendEmail } from '../../services/workflow';
import { formatApiError } from '../../lib/apiClient';
import { Button } from './Button';
import { Modal } from './Modal';
import s from './Modal.module.css';

const digits = (p: string) => p.replace(/\D/g, '');

/**
 * Global compose dialog. Email is sent through `POST /admin/workflow/:type/:id/email`.
 * WhatsApp / SMS have no send endpoint on the backend, so the dialog opens the device
 * handler (wa.me / sms:) with the text and records the outbound message as a
 * communication log (`POST /admin/workflow/:type/:id/logs`).
 */
export function ComposeDialog() {
  const cm = useUiStore((st) => st.compose);
  const close = useUiStore((st) => st.closeCompose);
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!cm) return;
    const first = (cm.name || '').split(' ')[0];
    const prop = cm.property || 'your property';
    setSubject(cm.subject ?? (cm.channel === 'email' ? 'Regarding ' + prop : ''));
    setBody(cm.body ?? 'Hi ' + first + ', regarding ' + prop + ' on BuiltGlory.');
    setError('');
    setBusy(false);
    setTo(cm.to || '');
  }, [cm]);

  if (!cm) return null;
  const isEmail = cm.channel === 'email';
  const label = isEmail ? 'Send Email' : cm.channel === 'sms' ? 'Send SMS' : 'Send WhatsApp';
  const recipient = cm.askTo ? to.trim() : cm.to || '';
  const toLine = 'To: ' + (cm.name ? cm.name + ' · ' : '') + (cm.to || (isEmail ? 'No email on file' : ''));

  const send = async () => {
    if (!body.trim()) return setError('Message cannot be empty');
    if (!recipient) return setError(cm.askTo ? (isEmail ? 'Enter an email address' : 'Enter a phone number') : isEmail ? 'No email on file' : 'No valid phone number available');
    if (cm.askTo && isEmail && !/^\S+@\S+\.\S+$/.test(recipient)) return setError('Enter a valid email address');
    if (cm.askTo && !isEmail && digits(recipient).length < 10) return setError('Enter a valid phone number');
    setBusy(true);
    try {
      if (isEmail) {
        if (cm.entity) await sendEmail(cm.entity.type, cm.entity.id, { to: recipient, subject: subject || '(no subject)', body, summary: 'Email sent to ' + (cm.name || recipient) });
        else window.open(`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
      } else {
        const url = cm.channel === 'whatsapp' ? `https://wa.me/${digits(recipient)}?text=${encodeURIComponent(body)}` : `sms:${recipient}?body=${encodeURIComponent(body)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        if (cm.entity) {
          await createLog(cm.entity.type, cm.entity.id, {
            channel: cm.channel === 'whatsapp' ? 'whatsapp' : 'message',
            direction: 'outbound',
            summary: (cm.channel === 'whatsapp' ? 'WhatsApp' : 'SMS') + ' sent to ' + (cm.name || recipient),
            body,
            outcome: recipient,
          });
        }
      }
      void qc.invalidateQueries({ queryKey: ['logs'] });
      toast(isEmail ? '✅ Email sent to ' + (cm.name || recipient) : cm.channel === 'sms' ? '✅ SMS sent to ' + (cm.name || recipient) : '✅ WhatsApp message sent to ' + (cm.name || recipient));
      cm.onSent?.();
      close();
    } catch (e) {
      setError(formatApiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={close} labelledBy="compose-title">
      <h3 id="compose-title" className={s.title}>{cm.title || label}</h3>
      {!cm.askTo && <p className={s.sub}>{toLine}</p>}
      <div className={s.fields}>
        {cm.askTo && (
          <label className={s.label}>
            {isEmail ? 'To (email)' : 'To (phone number)'}
            <input className="bg-input" type={isEmail ? 'email' : 'tel'} value={to} onChange={(e) => { setTo(e.target.value); setError(''); }} placeholder={isEmail ? 'name@example.com' : '+91 98765 43210'} />
          </label>
        )}
        {isEmail && (
          <label className={s.label}>
            Subject
            <input className="bg-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
        )}
        <label className={s.label}>
          {isEmail ? 'Body' : 'Message'}
          <textarea className="bg-input" rows={5} value={body} onChange={(e) => { setBody(e.target.value); setError(''); }} />
        </label>
        {error && <p className={s.error}>{error}</p>}
      </div>
      <div className={s.actions}>
        <Button variant="primary" onClick={send} loading={busy}>{label}</Button>
        <Button onClick={close}>Cancel</Button>
      </div>
    </Modal>
  );
}
