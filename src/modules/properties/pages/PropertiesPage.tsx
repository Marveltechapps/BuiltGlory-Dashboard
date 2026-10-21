import { useLocation } from 'react-router-dom';
import { AddProperty } from '../components/AddProperty';
import { BulkUpload } from '../components/BulkUpload';
import { PropertiesList } from '../components/PropertiesList';
import { PropertyTemplates } from '../components/PropertyTemplates';
import { PROPERTY_TAB } from '../constants';

/** /admin/properties/{all|featured|upcoming|add|upload|templates} */
export function PropertiesPage() {
  const { pathname } = useLocation();
  const tab = PROPERTY_TAB[pathname] || 'all';
  if (tab === 'add') return <AddProperty />;
  if (tab === 'upload') return <BulkUpload />;
  if (tab === 'templates') return <PropertyTemplates />;
  return <PropertiesList tab={tab} />;
}
