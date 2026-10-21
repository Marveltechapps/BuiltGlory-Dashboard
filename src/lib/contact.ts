import { toast } from '../store/uiStore';

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
