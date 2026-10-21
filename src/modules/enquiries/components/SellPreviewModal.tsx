import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Modal } from '../../../components/ui/Modal';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { price } from '../../../lib/format';
import { createAcquisitionFromSell } from '../../../services/enquiries';
import { toast } from '../../../store/uiStore';
import type { SellRequest } from '../../../types/enquiries';
import styles from './Enquiries.module.css';

const specOf = (r: SellRequest, ...keys: string[]) => {
  for (const k of keys) if (r.specifications[k]) return r.specifications[k]!;
  return '';
};

/** "Listing Preview — How buyers see this" + Accept for Acquisition (POST /admin/sell-requests/:id/create-acquisition). */
export function SellPreviewModal({ r, onClose }: { r: SellRequest; onClose: () => void }) {
  const accept = useRefreshingMutation((id: string) => createAcquisitionFromSell(id), [['sell-requests'], ['acquisitions']]);
  const bhk = specOf(r, 'bhk') || (r.title.match(/(\d)\s*BHK/i) || [])[1];
  const area = specOf(r, 'builtUpArea', 'carpetArea', 'plotArea', 'area');
  const specs = [
    { label: 'BHK', value: bhk ? (String(bhk).toUpperCase().includes('BHK') ? bhk : bhk + ' BHK') : '—' },
    { label: 'Area', value: area ? area + ' sqft' : '—' },
    { label: 'Floor', value: specOf(r, 'floor', 'floorNumber') || '—' },
    { label: 'Facing', value: specOf(r, 'facing', 'facingDirection') || '—' },
  ];
  const canAccept = !r.acquisitionId && r.status !== 'rejected' && r.status !== 'sold';
  return (
    <Modal open onClose={onClose} maxWidth={520} zIndex={105}>
      <h3 style={{ fontWeight: 600 }}>Listing Preview — How buyers see this</h3>
      <div className={styles.previewBox}>
        {r.photos[0] ? (
          <img src={r.photos[0]} alt="" style={{ height: 200, width: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', height: 160, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f1f5f9', color: '#94a3b8' }}>
            <Icon name="building-2" size={36} /><span style={{ fontSize: 13 }}>No photos</span>
          </div>
        )}
        <div style={{ padding: 14 }}>
          <p style={{ fontWeight: 600 }}>{r.title}</p>
          <p style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700, color: '#2563eb' }}>{price(r.askingPrice)}</p>
          <p style={{ fontSize: 12, color: '#64748b' }}>{[r.locality, r.city].filter(Boolean).join(', ')}</p>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {specs.map((sp) => (
              <div key={sp.label} className={styles.spec}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{sp.label}</p>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{sp.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p style={{ marginTop: 12, borderRadius: 8, background: '#fffbeb', padding: '8px 12px', fontSize: 12, color: '#92400e' }}>This is a preview. Listing is not live yet.</p>
      <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
        {canAccept && (
          <Button
            variant="primary"
            loading={accept.isPending}
            onClick={() =>
              accept.mutate(r.id, {
                onSuccess: (acq) => {
                  onClose();
                  toast('✅ Moved to Acquisition Pipeline — ' + acq.referenceId);
                },
              })
            }
          >
            Accept for Acquisition
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
