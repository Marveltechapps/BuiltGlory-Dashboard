import { useLocation } from 'react-router-dom';
import { BuyEnquiriesTab } from '../components/BuyEnquiriesTab';
import { CallbacksTab } from '../components/CallbacksTab';
import { ChatTab } from '../components/ChatTab';
import { InteriorLeadsTab } from '../components/InteriorLeadsTab';
import { SellRequestsTab } from '../components/SellRequestsTab';
import { VisitsTab } from '../components/VisitsTab';

/** Enquiries section: one route per tab (/admin/enquiries/{buy|sell|visits|callbacks|interior|chat}). */
export function EnquiriesPage() {
  const { pathname } = useLocation();
  const tab = pathname.split('/')[3];
  switch (tab) {
    case 'sell':
      return <SellRequestsTab key="sell" />;
    case 'visits':
      return <VisitsTab key="visits" />;
    case 'callbacks':
      return <CallbacksTab key="callbacks" />;
    case 'interior':
      return <InteriorLeadsTab key="interior" />;
    case 'chat':
      return <ChatTab key="chat" />;
    default:
      return <BuyEnquiriesTab key="buy" />;
  }
}
