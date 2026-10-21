import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from '../../layouts/AdminLayout/AdminLayout';
import { LoginPage } from '../../modules/auth/pages/LoginPage';
import { OverviewPage } from '../../modules/overview/pages/OverviewPage';
import { PROPERTY_TAB } from '../../modules/properties/constants';
import { USER_TAB } from '../../modules/users/constants';
import { ACQ_TAB, SALES_TAB } from '../../constants/pipeline';
import { EntryRedirect, PublicOnly, RequireAuth, RootLayout } from './guards';

/* Feature screens load on demand (one chunk per module). */
const EnquiriesPage = lazy(() => import('../../modules/enquiries/pages/EnquiriesPage').then((m) => ({ default: m.EnquiriesPage })));
const BuyEnquiryDetailPage = lazy(() => import('../../modules/enquiries/pages/BuyEnquiryDetailPage').then((m) => ({ default: m.BuyEnquiryDetailPage })));
const SellRequestDetailPage = lazy(() => import('../../modules/enquiries/pages/SellRequestDetailPage').then((m) => ({ default: m.SellRequestDetailPage })));
const InteriorLeadDetailPage = lazy(() => import('../../modules/enquiries/pages/InteriorLeadDetailPage').then((m) => ({ default: m.InteriorLeadDetailPage })));
const VisitDetailPage = lazy(() => import('../../modules/enquiries/pages/VisitDetailPage').then((m) => ({ default: m.VisitDetailPage })));
const CallbackDetailPage = lazy(() => import('../../modules/enquiries/pages/CallbackDetailPage').then((m) => ({ default: m.CallbackDetailPage })));
const PipelinePage = lazy(() => import('../../modules/pipeline/pages/PipelinePage').then((m) => ({ default: m.PipelinePage })));
const AcquisitionDetailPage = lazy(() => import('../../modules/acquisition/pages/AcquisitionDetailPage').then((m) => ({ default: m.AcquisitionDetailPage })));
const SalesDealDetailPage = lazy(() => import('../../modules/sales/pages/SalesDealDetailPage').then((m) => ({ default: m.SalesDealDetailPage })));
const PropertiesPage = lazy(() => import('../../modules/properties/pages/PropertiesPage').then((m) => ({ default: m.PropertiesPage })));
const PropertyDetailPage = lazy(() => import('../../modules/properties/pages/PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage })));
const UsersPage = lazy(() => import('../../modules/users/pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const UserDetailPage = lazy(() => import('../../modules/users/pages/UserDetailPage').then((m) => ({ default: m.UserDetailPage })));
const ReportsPage = lazy(() => import('../../modules/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ToolsPage = lazy(() => import('../../modules/tools/pages/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const AdminSettingsPage = lazy(() => import('../../modules/admin/pages/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const SupportTicketDetailPage = lazy(() => import('../../modules/admin/pages/SupportTicketDetailPage').then((m) => ({ default: m.SupportTicketDetailPage })));

const ENQUIRY_TABS = ['buy', 'sell', 'visits', 'callbacks', 'interior', 'chat'];
const TOOL_TABS = ['content', 'mastersheet', 'locations', 'pricing', 'templates', 'bulkmessage', 'push'];
const SETTINGS_TABS = ['support', 'feedback', 'access', 'general', 'legal', 'audit'];

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <EntryRedirect /> },
      { path: '/login', element: <PublicOnly><LoginPage /></PublicOnly> },
      {
        path: '/admin',
        element: <RequireAuth><AdminLayout /></RequireAuth>,
        children: [
          { index: true, element: <Navigate to="/admin/overview" replace /> },
          { path: 'overview', element: <OverviewPage /> },
          { path: 'enquiries', element: <Navigate to="/admin/enquiries/buy" replace /> },
          ...ENQUIRY_TABS.map((t) => ({ path: 'enquiries/' + t, element: <EnquiriesPage /> })),
          { path: 'enquiries/buy/:id', element: <BuyEnquiryDetailPage /> },
          { path: 'enquiries/sell/:id', element: <SellRequestDetailPage /> },
          { path: 'enquiries/interior/:id', element: <InteriorLeadDetailPage /> },
          { path: 'visits/:id', element: <VisitDetailPage /> },
          { path: 'callbacks/:id', element: <CallbackDetailPage /> },
          { path: 'acquisition', element: <Navigate to="/admin/acquisition/all" replace /> },
          ...Object.keys(ACQ_TAB).map((t) => ({ path: 'acquisition/' + t, element: <PipelinePage key="acquisition" kind="acquisition" /> })),
          { path: 'acquisition/:id', element: <AcquisitionDetailPage /> },
          { path: 'sales', element: <Navigate to="/admin/sales/all" replace /> },
          ...Object.keys(SALES_TAB).map((t) => ({ path: 'sales/' + t, element: <PipelinePage key="sales" kind="sales" /> })),
          { path: 'sales/:id', element: <SalesDealDetailPage /> },
          { path: 'properties', element: <Navigate to="/admin/properties/all" replace /> },
          ...Object.keys(PROPERTY_TAB).map((path) => ({ path: path.slice(7), element: <PropertiesPage key="properties" /> })),
          { path: 'properties/:id', element: <PropertyDetailPage /> },
          { path: 'users', element: <Navigate to="/admin/users/all" replace /> },
          ...Object.keys(USER_TAB).map((path) => ({ path: path.slice(7), element: <UsersPage key="users" /> })),
          { path: 'users/:id', element: <UserDetailPage /> },
          { path: 'reports', element: <Navigate to="/admin/reports/sales" replace /> },
          ...['sales', 'acquisition', 'revenue', 'export'].map((t) => ({ path: 'reports/' + t, element: <ReportsPage key="reports" /> })),
          { path: 'tools', element: <Navigate to="/admin/tools/content" replace /> },
          ...TOOL_TABS.map((t) => ({ path: 'tools/' + t, element: <ToolsPage key="tools" /> })),
          { path: 'settings', element: <Navigate to="/admin/settings/support" replace /> },
          ...SETTINGS_TABS.map((t) => ({ path: 'settings/' + t, element: <AdminSettingsPage key="settings" /> })),
          { path: 'settings/support/:id', element: <SupportTicketDetailPage /> },
          { path: '*', element: <Navigate to="/admin/overview" replace /> },
        ],
      },
      { path: '*', element: <EntryRedirect /> },
    ],
  },
]);
