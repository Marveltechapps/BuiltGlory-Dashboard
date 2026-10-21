import { useQuery } from '@tanstack/react-query';
import { listBuyEnquiries, listCallbacks, listChatThreads, listInteriorLeads, listSellRequests, listVisits } from '../../../services/enquiries';

export const useBuyEnquiries = () => useQuery({ queryKey: ['buy-enquiries'], queryFn: ({ signal }) => listBuyEnquiries(signal) });
export const useSellRequests = () => useQuery({ queryKey: ['sell-requests'], queryFn: ({ signal }) => listSellRequests(signal) });
export const useVisits = () => useQuery({ queryKey: ['visits'], queryFn: ({ signal }) => listVisits(signal) });
export const useCallbacks = () => useQuery({ queryKey: ['callbacks'], queryFn: ({ signal }) => listCallbacks(signal) });
export const useInteriorLeads = () => useQuery({ queryKey: ['interior-leads'], queryFn: ({ signal }) => listInteriorLeads(signal) });
export const useChatThreads = () => useQuery({ queryKey: ['chats'], queryFn: ({ signal }) => listChatThreads(signal), refetchInterval: 30_000 });
