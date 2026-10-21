import { useLocation } from 'react-router-dom';
import { AccessControlTab } from '../components/AccessControlTab';
import { AuditTrailTab } from '../components/AuditTrailTab';
import { FeedbackTab } from '../components/FeedbackTab';
import { GeneralSettingsTab } from '../components/GeneralSettingsTab';
import { LegalContentTab } from '../components/LegalContentTab';
import { SupportTicketsTab } from '../components/SupportTicketsTab';

/** /admin/settings/{support|feedback|access|general|legal|audit} */
export function AdminSettingsPage() {
  const { pathname } = useLocation();
  const tab = pathname.split('/').pop();
  if (tab === 'feedback') return <FeedbackTab />;
  if (tab === 'access') return <AccessControlTab />;
  if (tab === 'general') return <GeneralSettingsTab />;
  if (tab === 'legal') return <LegalContentTab />;
  if (tab === 'audit') return <AuditTrailTab />;
  return <SupportTicketsTab />;
}
