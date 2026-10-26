import { openCompose, toast } from '../store/uiStore';
import type { EntityType } from '../types/workflow';

export const phoneDigits = (phone: string) => phone.replace(/\D/g, '');
export const isValidPhone = (phone: string | null | undefined) => !!phone && phoneDigits(phone).length >= 10;

/** Opens the device dialer (tel:) and confirms with a toast. */
export function callPhone(name: string, phone: string | null | undefined) {
  if (!isValidPhone(phone)) {
    toast('No valid phone number available');
    return;
  }
  const p = phone!.trim();
  window.location.href = `tel:${p.startsWith('+') ? '+' + phoneDigits(p) : phoneDigits(p)}`;
  toast('📞 Calling ' + name + ' · ' + p);
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Copied!');
  } catch {
    toast('Copy failed');
  }
}

/** Opens the compose dialog for WhatsApp or email. Email needs an address on the record. */
export function reachOut(channel: 'whatsapp' | 'email', o: { name: string; to?: string | null; property?: string; entity?: { type: EntityType; id: string } }) {
  if (channel === 'email' && !o.to) {
    toast('No email on file for ' + o.name);
    return;
  }
  openCompose({ channel, name: o.name, to: o.to, property: o.property, entity: o.entity });
}
