import { useLocation } from 'react-router-dom';
import { AppContentTab } from '../components/AppContentTab';
import { BulkMessageTab } from '../components/BulkMessageTab';
import { LocationsTab } from '../components/LocationsTab';
import { MasterSheetTab } from '../components/MasterSheetTab';
import { PricingTab } from '../components/PricingTab';
import { PushTab } from '../components/PushTab';
import { TemplatesTab } from '../components/TemplatesTab';

/** /admin/tools/{content|mastersheet|locations|pricing|templates|bulkmessage|push} */
export function ToolsPage() {
  const { pathname } = useLocation();
  const tab = pathname.split('/').pop();
  if (tab === 'mastersheet') return <MasterSheetTab />;
  if (tab === 'locations') return <LocationsTab />;
  if (tab === 'pricing') return <PricingTab />;
  if (tab === 'templates') return <TemplatesTab />;
  if (tab === 'bulkmessage') return <BulkMessageTab />;
  if (tab === 'push') return <PushTab />;
  return <AppContentTab />;
}
