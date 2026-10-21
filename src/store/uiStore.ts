import { create } from 'zustand';
import type { EntityType } from '../types/workflow';

export type ToastTone = 'dark' | 'green';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'destructive' | 'green';
  input?: { label: string; placeholder?: string; required?: boolean; error?: string; defaultValue?: string };
  select?: { label: string; placeholder?: string; options: string[]; required?: boolean; error?: string };
  onConfirm: (v: { value: string; select: string }) => unknown;
}

export type ComposeChannel = 'email' | 'whatsapp' | 'sms';

export interface ComposeOptions {
  channel: ComposeChannel;
  name?: string;
  /** Email address or phone number depending on channel. */
  to?: string | null;
  subject?: string;
  body?: string;
  title?: string;
  property?: string;
  /** Record the message is logged against (communication log). */
  entity?: { type: EntityType; id: string };
  onSent?: () => void;
  /** Show an editable recipient field (compose from a template with no record context). */
  askTo?: boolean;
}

interface UiState {
  toasts: Toast[];
  confirm: ConfirmOptions | null;
  compose: ComposeOptions | null;
  toast: (text: string, tone?: ToastTone) => void;
  askConfirm: (o: ConfirmOptions) => void;
  closeConfirm: () => void;
  openCompose: (o: ComposeOptions) => void;
  closeCompose: () => void;
}

let seq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  confirm: null,
  compose: null,
  toast: (text, tone = 'dark') => {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3000);
  },
  askConfirm: (o) => set({ confirm: o }),
  closeConfirm: () => set({ confirm: null }),
  openCompose: (o) => set({ compose: o }),
  closeCompose: () => set({ compose: null }),
}));

/** Imperative helpers for event handlers outside React render. */
export const toast = (text: string, tone?: ToastTone) => useUiStore.getState().toast(text, tone);
export const askConfirm = (o: ConfirmOptions) => useUiStore.getState().askConfirm(o);
export const openCompose = (o: ComposeOptions) => useUiStore.getState().openCompose(o);
