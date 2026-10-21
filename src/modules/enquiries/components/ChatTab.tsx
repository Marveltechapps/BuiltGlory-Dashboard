import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/tables/DataTable';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { Modal } from '../../../components/ui/Modal';
import ms from '../../../components/ui/Modal.module.css';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useViewport } from '../../../hooks/useViewport';
import { formatApiError } from '../../../lib/apiClient';
import { callPhone } from '../../../lib/contact';
import { badge, initials, price, relative } from '../../../lib/format';
import { sendChatMessage } from '../../../services/enquiries';
import { createSalesDeal } from '../../../services/sales';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';
import type { ChatThread } from '../../../types/enquiries';
import { useChatThreads } from '../hooks/useEnquiries';
import { enqBadge } from './enquiryHelpers';
import styles from './Enquiries.module.css';

const D = 864e5;
const CHIPS: Array<[string, string]> = [['all', 'All'], ['active', 'Active'], ['deal_agreed', 'Deal Agreed'], ['lost', 'Lost'], ['inactive', 'Inactive']];

type ModalState = { type: 'offer' } | { type: 'deal'; amount: number } | null;

export function ChatTab() {
  const navigate = useNavigate();
  const { isLg } = useViewport();
  const q = useChatThreads();
  const [chatQ, setChatQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [chatId, setChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [mAmount, setMAmount] = useState('');
  const [mNote, setMNote] = useState('');
  const [mError, setMError] = useState('');
  const send = useRefreshingMutation((v: { id: string; body: Parameters<typeof sendChatMessage>[1] }) => sendChatMessage(v.id, v.body), [['chats']]);
  const deal = useRefreshingMutation(
    async (v: { t: ChatThread; amount: number }) => {
      const d = await createSalesDeal({ buyerId: v.t.buyerId, propertyId: v.t.propertyId, stage: 'token_payment', financials: { offeredPrice: v.amount, agreedPrice: v.amount } });
      await sendChatMessage(v.t.id, { type: 'deal_agreed', text: 'Deal agreed at ' + price(v.amount), offerAmount: v.amount });
      return d;
    },
    [['chats'], ['sales-deals']],
  );

  const threads = (q.data?.items ?? []).slice().sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
  const cq = chatQ.trim().toLowerCase();
  const visible = threads.filter((t) => (filter === 'all' || t.status === filter) && (!cq || (t.buyerName + ' ' + t.propertyTitle).toLowerCase().includes(cq)));
  const cur = threads.find((t) => t.id === chatId) ?? null;

  if (q.isPending || q.isError || threads.length === 0) {
    return (
      <PageStack>
        <ListHeader title="Chat" count={String(threads.length)} />
        <DataTable
          columns={['Thread']}
          rows={[]}
          state={q.isPending ? 'loading' : q.isError ? 'error' : 'empty'}
          onRetry={() => void q.refetch()}
          errorTitle="Could not load data"
          empty={{ icon: 'message-square', title: 'No negotiation threads yet', text: 'Buyer price negotiations from the app appear here' }}
        />
      </PageStack>
    );
  }

  const offers = (t: ChatThread) => t.messages.filter((m) => m.type === 'offer');
  const lastOffer = (t: ChatThread, sender: string) => [...t.messages].reverse().find((m) => m.type === 'offer' && m.sender === sender);
  const openModal = (m: ModalState) => {
    setModal(m);
    setMAmount(m?.type === 'deal' ? String(m.amount || '') : '');
    setMNote('');
    setMError('');
  };
  const sendText = () => {
    const txt = draft.trim();
    if (!txt || !cur) return;
    send.mutate({ id: cur.id, body: { type: 'text', text: txt } }, { onSuccess: () => setDraft('') });
  };
  const submitModal = () => {
    if (!cur || !modal) return;
    const amt = Number(mAmount);
    if (modal.type === 'offer') {
      if (!amt || amt <= 0) return setMError('Enter a valid amount');
      send.mutate(
        { id: cur.id, body: { type: 'offer', offerAmount: amt, text: mNote || 'Counter offer from Builtglory.' } },
        { onSuccess: () => { setModal(null); toast('💰 Counter offer of ' + price(amt) + ' sent'); }, onError: (e) => setMError(formatApiError(e)) },
      );
    } else {
      if (!amt || amt <= 0) return setMError('Final price is required');
      deal.mutate(
        { t: cur, amount: amt },
        { onSuccess: () => { setModal(null); toast('🎉 Deal closed — moved to Sales Pipeline'); }, onError: (e) => setMError(formatApiError(e)) },
      );
    }
  };

  const showList = isLg || !cur;
  const showConv = isLg || !!cur;
  const lb = cur ? lastOffer(cur, 'buyer') : undefined;
  const la = cur ? lastOffer(cur, 'admin') : undefined;

  return (
    <PageStack>
      <ListHeader title="Chat" count={String(threads.length)} />
      <div className={styles.chat} style={{ gridTemplateColumns: isLg ? '320px minmax(0, 1fr)' : 'minmax(0, 1fr)' }}>
        {showList && (
          <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid #e2e8f0', padding: 12 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', display: 'inline-flex', transform: 'translateY(-50%)', color: '#64748b' }}><Icon name="search" size={16} /></span>
                <input type="search" className={styles.chatSearch} value={chatQ} onChange={(e) => setChatQ(e.target.value)} placeholder="Search threads..." aria-label="Search threads" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CHIPS.map(([k, label]) => (
                  <button key={k} type="button" className={styles.chip} onClick={() => setFilter(k)} style={{ borderColor: filter === k ? '#2563eb' : '#e2e8f0', background: filter === k ? '#2563eb' : '#ffffff', color: filter === k ? '#ffffff' : '#334155' }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 640 }}>
              {visible.length === 0 && <p style={{ padding: '32px 16px', textAlign: 'center', fontSize: 14, color: '#64748b' }}>No threads match</p>}
              {visible.map((t) => {
                const last = t.messages[t.messages.length - 1];
                const flags = [Date.now() - Date.parse(t.lastMessageAt) > 7 * D ? 'Inactive 7d+' : null, offers(t).length >= 3 ? 'Long negotiation' : null].filter(Boolean) as string[];
                const st = enqBadge('chat', t.status);
                const on = cur?.id === t.id;
                return (
                  <button key={t.id} type="button" className={styles.thread} style={{ background: on ? '#eff6ff' : '#ffffff', borderLeftColor: on ? '#2563eb' : 'transparent' }} onClick={() => { setChatId(t.id); setDraft(''); }}>
                    <span style={{ display: 'flex', width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: 'rgba(37,99,235,0.1)', fontSize: 12, fontWeight: 600, color: '#2563eb' }}>{initials(t.buyerName)}</span>
                    <span style={{ display: 'block', minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span className={styles.ellipsis} style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>{t.buyerName}</span>
                        <span style={{ flexShrink: 0, fontSize: 11, color: '#94a3b8' }}>{relative(t.lastMessageAt)}</span>
                      </span>
                      <span className={styles.ellipsis} style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{t.propertyTitle}</span>
                      <span className={styles.ellipsis} style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: '#334155' }}>{last ? (last.type === 'offer' ? '💰 Offer ' + price(last.offerAmount) : last.text) : 'No messages yet'}</span>
                      <span style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <span className={styles.tinyBadge} style={{ background: st.bg, color: st.fg }}>{st.text}</span>
                        {flags.map((f) => <span key={f} className={styles.tinyBadge} style={{ background: '#ffedd5', color: '#c2410c' }}>{f}</span>)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {showConv && (
          <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column' }}>
            {!cur ? (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center', color: '#64748b' }}>
                <span style={{ display: 'inline-flex', color: 'rgba(100,116,139,0.4)' }}><Icon name="message-square" size={64} stroke={1.5} /></span>
                <p style={{ marginTop: 16, fontSize: 18, lineHeight: '28px', fontWeight: 600, color: '#0f172a' }}>Select a conversation</p>
                <p style={{ fontSize: 14, lineHeight: '20px' }}>Pick a negotiation thread from the list</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #e2e8f0', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
                    {!isLg && <button type="button" onClick={() => setChatId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#2563eb' }}><Icon name="chevron-left" size={16} />Back to threads</button>}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600 }}>{cur.buyerName}</p>
                      <p className={styles.ellipsis} style={{ fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{cur.propertyTitle}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button type="button" className={styles.convBtn} onClick={() => callPhone(cur.buyerName, cur.phone)}><Icon name="phone" size={14} />Call</button>
                    <button type="button" className={styles.convBtn} onClick={() => navigate('/admin/users/' + cur.buyerId)} disabled={!cur.buyerId}><Icon name="user" size={14} />View Profile</button>
                    <button type="button" className={styles.convBtn} onClick={() => navigate('/admin/properties/' + cur.propertyId)} disabled={!cur.propertyId}><Icon name="building-2" size={14} />View Property</button>
                    <button type="button" className={styles.convBtn} onClick={() => openCompose({ channel: 'whatsapp', name: cur.buyerName, to: cur.phone, property: cur.propertyTitle, entity: cur.buyerId ? { type: 'user', id: cur.buyerId } : undefined })}><Icon name="send" size={14} />Send Follow-up</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderBottom: '1px solid #e2e8f0', background: 'rgba(241,245,249,0.5)' }}>
                  <div style={{ padding: '10px 16px' }}><p className={styles.statLbl}>Listed</p><p style={{ fontWeight: 700 }}>{price(cur.listedPrice)}</p></div>
                  <div style={{ borderLeft: '1px solid #e2e8f0', padding: '10px 16px' }}><p className={styles.statLbl}>Buyer</p><p style={{ fontWeight: 700, color: '#c2410c' }}>{lb ? price(lb.offerAmount) : '—'}</p></div>
                  <div style={{ borderLeft: '1px solid #e2e8f0', padding: '10px 16px' }}><p className={styles.statLbl}>Counter</p><p style={{ fontWeight: 700, color: '#2563eb' }}>{la ? price(la.offerAmount) : '—'}</p></div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid #e2e8f0', padding: '8px 16px', fontSize: 13 }}>
                  <span style={{ fontWeight: 500, color: cur.status === 'deal_agreed' ? '#15803d' : cur.status === 'lost' ? '#b91c1c' : '#c2410c' }}>
                    {cur.status === 'deal_agreed' ? 'Deal Agreed' : cur.status === 'lost' ? 'Negotiation Failed' : 'Negotiation in progress'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {cur.deadline && <span style={{ fontSize: 12, color: '#64748b' }}>Deadline: {cur.deadline}</span>}
                    <button
                      type="button"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: '#2563eb' }}
                      onClick={() =>
                        askConfirm({
                          title: 'Set negotiation deadline',
                          select: { label: 'Respond within', placeholder: 'Select deadline', options: ['24 hours', '48 hours', '72 hours', '7 days'], required: true },
                          confirmLabel: 'Set Deadline',
                          onConfirm: async ({ select }) => {
                            await send.mutateAsync({ id: cur.id, body: { type: 'text', text: 'Please respond to the current offer within ' + select + '.' } });
                            toast('⏱ Deadline set: ' + select);
                          },
                        })
                      }
                    >
                      <Icon name="clock" size={12} />Set Deadline
                    </button>
                  </div>
                </div>
                {cur.status === 'deal_agreed' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#f0fdf4', padding: '10px 16px', fontSize: 14, color: '#15803d' }}>
                    <span style={{ fontWeight: 500 }}>✅ Deal closed — moved to Sales Pipeline</span>
                    {cur.dealId && <button type="button" onClick={() => navigate('/admin/sales/' + cur.dealId)} style={{ fontSize: 13, fontWeight: 500, color: '#15803d', textDecoration: 'underline' }}>View deal →</button>}
                  </div>
                )}
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 420, padding: 16 }}>
                  {cur.messages.length === 0 && <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#64748b' }}>No messages yet</p>}
                  {cur.messages.map((m) => {
                    const own = m.sender === 'admin';
                    const sb = m.offerStatus === 'accepted' ? badge('Accepted', 'green') : m.offerStatus === 'declined' ? badge('Declined', 'red') : m.offerStatus === 'countered' ? badge('Countered', 'purple') : badge('Pending', 'orange');
                    const canAct = !own && m.type === 'offer' && (!m.offerStatus || m.offerStatus === 'pending') && cur.status !== 'deal_agreed';
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start' }}>
                        <span style={{ marginBottom: 2, fontSize: 11, color: '#94a3b8' }}>{own ? 'You' : cur.buyerName.split(' ')[0]} · {relative(m.at)}</span>
                        {m.type === 'offer' ? (
                          <div style={{ minWidth: 220, maxWidth: '75%', borderRadius: 12, border: '1px solid ' + (own ? '#bfdbfe' : '#e2e8f0'), background: '#ffffff', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>💰 Offer</span>
                              <span className={styles.tinyBadge} style={{ background: sb.bg, color: sb.fg }}>{sb.text}</span>
                            </div>
                            <p style={{ marginTop: 2, fontSize: 20, lineHeight: '28px', fontWeight: 700 }}>{price(m.offerAmount)}</p>
                            {m.text && <p style={{ fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{m.text}</p>}
                            {canAct && (
                              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                                <button type="button" onClick={() => openModal({ type: 'deal', amount: m.offerAmount || 0 })} style={{ height: 28, borderRadius: 8, background: '#16a34a', padding: '0 10px', fontSize: 12, fontWeight: 500, color: '#ffffff' }}>Accept</button>
                                <button type="button" className={styles.miniBtn} onClick={() => openModal({ type: 'deal', amount: m.offerAmount || 0 })}>Move to Deal</button>
                              </div>
                            )}
                          </div>
                        ) : m.type === 'deal_agreed' ? (
                          <div style={{ borderRadius: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: '8px 12px', fontSize: 14, fontWeight: 500, color: '#15803d' }}>🎉 {m.text}</div>
                        ) : (
                          <div style={{ maxWidth: '75%', borderRadius: 12, padding: '8px 12px', fontSize: 14, lineHeight: '20px', background: own ? '#2563eb' : '#f1f5f9', color: own ? '#ffffff' : '#0f172a' }}>{m.text}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderTop: '1px solid #e2e8f0', padding: '12px 16px' }}>
                  <input className={styles.composer} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()} placeholder="Type a message..." aria-label="Message" />
                  <button type="button" className={styles.send} onClick={sendText} disabled={send.isPending}><Icon name={send.isPending ? 'loader-2' : 'send'} size={16} spin={send.isPending} />Send</button>
                  <button type="button" className={styles.outlineLg} onClick={() => openModal({ type: 'offer' })}>💰 Send Offer</button>
                  <button type="button" className={styles.greenLg} onClick={() => openModal({ type: 'deal', amount: la?.offerAmount || cur.listedPrice })}>✅ Deal Agreed</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} maxWidth={420} zIndex={105}>
          <h3 className={ms.title}>{modal.type === 'offer' ? 'Send counter offer' : 'Confirm deal agreed'}</h3>
          <div className={ms.fields}>
            <label className={ms.label}>
              {modal.type === 'offer' ? 'Amount (₹)' : 'Final price (₹)'}
              <input className="bg-input" type="number" value={mAmount} placeholder={modal.type === 'offer' ? 'e.g. 4350000' : ''} aria-invalid={!!mError} onChange={(e) => { setMAmount(e.target.value); setMError(''); }} />
            </label>
            {modal.type === 'offer' && (
              <label className={ms.label}>
                Note (optional)
                <input className="bg-input" value={mNote} placeholder="Message with offer" onChange={(e) => setMNote(e.target.value)} />
              </label>
            )}
            {mError && <span className={ms.error}>{mError}</span>}
          </div>
          <div className={ms.actions}>
            <Button variant="primary" onClick={submitModal} loading={send.isPending || deal.isPending}>{modal.type === 'offer' ? 'Send Offer' : 'Confirm'}</Button>
            <Button onClick={() => setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </PageStack>
  );
}
