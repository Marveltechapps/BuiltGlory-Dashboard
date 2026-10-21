import type { NavigateFunction } from 'react-router-dom';
import { STATUS_TONES } from '../../constants/labels';
import { callPhone } from '../../lib/contact';
import { price as fmtPrice, statusLabel, typeLabel } from '../../lib/format';
import { openCompose } from '../../store/uiStore';
import type { Property } from '../../types/properties';
import type { ActionVariant, DetailAction, DetailField, HeaderBadge, SectionSpec } from '../../types/detail';
import type { EntityType } from '../../types/workflow';

export const btn = (label: string, onClick?: () => void, variant: ActionVariant = 'outline', extra: Partial<DetailAction> = {}): DetailAction => ({ label, onClick, variant, ...extra });

export const statusBadge = (status: string, label?: string): HeaderBadge => ({ text: label || statusLabel(status), tone: STATUS_TONES[status] || 'muted' });

export interface Person {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export function personSection(title: string, p: Person, extra: DetailField[], link: string | null, linkLabel: string, navigate: NavigateFunction): SectionSpec {
  return {
    title,
    cols: 1,
    fields: [{ label: 'Name', value: p.name, strong: true }, { label: 'Phone', value: p.phone }, { label: 'Email', value: p.email }, ...extra],
    actions: link ? [btn(linkLabel || 'View Profile →', () => navigate(link), 'link')] : [],
  };
}

export interface PropertyFallback {
  id?: string | null;
  title: string;
  price?: number | null;
  type?: string | null;
  location?: string | null;
  image?: string | null;
}

/** Property card from the live property record (when loaded) or the record's snapshot. */
export function propertySection(title: string, p: Property | null | undefined, fb: PropertyFallback, navigate: NavigateFunction): SectionSpec {
  const photos = p ? p.photos : fb.image ? [fb.image] : [];
  const id = p?.id || fb.id;
  const loc = p ? [p.locality, p.city].filter(Boolean).join(', ') : fb.location;
  const pr = p?.price ?? fb.price;
  return {
    title: title || 'Property',
    images: photos.slice(0, 1),
    cols: 1,
    fields: [
      { label: 'Title', value: p?.title || fb.title, strong: true },
      { label: 'Price', value: pr ? fmtPrice(pr) : '' },
      { label: 'Type', value: typeLabel(p?.type || fb.type) },
      { label: 'Location', value: loc },
    ],
    banners: photos.length ? [] : [{ text: 'No photos on this listing', tone: 'muted' }],
    actions: id ? [btn('View Property →', () => navigate('/admin/properties/' + id), 'link')] : [],
  };
}

export interface ContactOpts {
  name: string;
  phone?: string | null;
  email?: string | null;
  property?: string;
  callLabel?: string;
  entity?: { type: EntityType; id: string };
}

/** 📞 Call / 💬 WhatsApp / 📧 Email header actions. */
export function contactActions(o: ContactOpts): DetailAction[] {
  return [
    btn('📞 ' + (o.callLabel || 'Call'), () => callPhone(o.name, o.phone)),
    btn('💬 WhatsApp', () => openCompose({ channel: 'whatsapp', name: o.name, to: o.phone, property: o.property, entity: o.entity }), 'green'),
    btn('📧 Email', () => openCompose({ channel: 'email', name: o.name, to: o.email, property: o.property, entity: o.entity }), 'outline', { disabled: !o.email, title: o.email ? '' : 'No email on file' }),
  ];
}

export const crumbsFor = (section: string, sectionPath: string, tab: string, tabPath: string, name: string) => [
  { label: section, path: sectionPath },
  { label: tab, path: tabPath },
  { label: name },
];
