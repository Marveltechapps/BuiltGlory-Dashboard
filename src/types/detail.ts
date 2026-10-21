import type { ReactNode } from 'react';
import type { BadgeSpec } from '../lib/format';

export type ActionVariant = 'primary' | 'outline' | 'destructive' | 'green' | 'red' | 'amber' | 'link';

export interface DetailAction {
  label: string;
  onClick?: () => void;
  variant?: ActionVariant;
  disabled?: boolean;
  title?: string;
  loading?: boolean;
}

export interface DetailField {
  label: string;
  value?: string | number | null;
  strong?: boolean;
  color?: string;
}

export type BannerTone = 'info' | 'warn' | 'error' | 'success' | 'muted';

export interface DetailBanner {
  text: string;
  tone?: BannerTone;
  action?: { label: string; onClick: () => void };
}

export interface DetailCheck {
  label: string;
  done?: boolean;
  onToggle?: () => void;
  sub?: string;
}

export interface DetailRow {
  key?: string;
  title: string;
  sub?: string;
  initials?: string;
  badges?: Array<BadgeSpec | null | false | undefined>;
  right?: string;
  rightColor?: string;
  onClick?: () => void;
  actions?: Array<DetailAction | null | false | undefined>;
}

export interface DetailChip {
  label: string;
  on?: boolean;
  onClick?: () => void;
}

export type InputType = 'text' | 'number' | 'date' | 'datetime-local' | 'time' | 'email' | 'tel' | 'url' | 'password' | 'select' | 'textarea' | 'checkbox' | 'file';

export interface FormInput {
  key: string;
  label: string;
  type?: InputType;
  value?: string | boolean;
  onChange?: (v: string | boolean) => void;
  onFile?: (f: File | null) => void;
  accept?: string;
  options?: Array<string | { value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  full?: boolean;
  min?: string;
  max?: string;
}

export interface TimelineItem {
  text: string;
  time: string;
  color?: string;
}

export interface SectionSpec {
  key?: string;
  title?: string;
  subtitle?: string;
  tag?: string;
  tone?: 'next' | 'danger';
  flat?: boolean;
  banners?: Array<DetailBanner | null | false | undefined>;
  images?: string[];
  fields?: Array<DetailField | null | false | undefined>;
  cols?: 1 | 2 | 3;
  text?: string;
  checks?: Array<DetailCheck | null | false | undefined>;
  rows?: Array<DetailRow | null | false | undefined>;
  chips?: DetailChip[];
  form?: Array<FormInput | null | false | undefined>;
  formCols?: 1 | 2;
  timeline?: TimelineItem[];
  empty?: string;
  actions?: Array<DetailAction | null | false | undefined>;
  stack?: boolean;
  /** Escape hatch for content the declarative spec does not cover (file pickers, previews). */
  custom?: ReactNode;
}

export interface StepSpec {
  value: string;
  label: string;
}

export interface Crumb {
  label: string;
  path?: string;
}

export interface HeaderBadge {
  text: string;
  tone?: string;
  dot?: string;
}

export interface PageBanner {
  text: string;
  tone?: BannerTone;
  actions?: Array<{ label: string; onClick: () => void }>;
  dismiss?: () => void;
}

export interface DetailTab {
  label: string;
  active: boolean;
  onClick: () => void;
}
