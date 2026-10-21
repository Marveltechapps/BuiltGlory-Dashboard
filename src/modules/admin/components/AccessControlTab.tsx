import { useQuery } from '@tanstack/react-query';
import { btn } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from '../../../constants/permissions';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { formatApiError } from '../../../lib/apiClient';
import { dateTime, initials, relativeLong, statusBadge, statusLabel } from '../../../lib/format';
import { inviteAdmin, listAdmins, removeAdmin, resetAdminPassword, setAdminSuspended, updateAdmin, updateAdminPermissions, type AdminOperator } from '../../../services/admins';
import { listBuyEnquiries } from '../../../services/enquiries';
import { listAuditLogs } from '../../../services/support';
import { createSalesTeamMember, removeSalesTeamMember, updateSalesTeamMember } from '../../../services/team';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';

const SALES_ROLES: Array<[string, string]> = [['sales_manager', 'Sales Manager'], ['sales_executive', 'Sales Executive'], ['relationship_manager', 'Relationship Manager']];
const ASSIGNABLE = ROLES.filter((r) => r !== 'super_admin');
const s = (v: unknown) => (v == null ? '' : String(v));
const areasOf = (v: unknown) => s(v).split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Admin › Access Control — admins (GET /admin/admins, POST /admin/admins/invite, PATCH /admin/admins/:id[/permissions],
 * POST …/reset-password, POST …/suspend, DELETE …), sales team (/admin/sales-team) and recent sign-in activity (audit logs).
 */
export function AccessControlTab() {
  const modal = useFormModal();
  const adminsQ = useQuery({ queryKey: ['admins'], queryFn: ({ signal }) => listAdmins(signal), retry: false });
  const team = useSalesTeam();
  const enqQ = useQuery({ queryKey: ['buy-enquiries'], queryFn: ({ signal }) => listBuyEnquiries(signal) });
  const auditQ = useQuery({ queryKey: ['audit-logs'], queryFn: ({ signal }) => listAuditLogs('', signal), retry: false });
  const adminMut = useRefreshingMutation((fn: () => Promise<unknown>) => fn(), [['admins']]);
  const teamMut = useRefreshingMutation((fn: () => Promise<unknown>) => fn(), [['sales-team']]);

  const admins = adminsQ.data ?? [];
  const members = team.team;
  const enquiries = enqQ.data?.items ?? [];
  const accessLogs = (auditQ.data?.items ?? []).filter((a) => /login|logout|session|password|suspend/i.test(a.action)).slice(0, 20);
  const rolePerms = (r: string) => {
    const withExplicit = admins.find((a) => a.role === r && a.permissions.length);
    return withExplicit ? withExplicit.permissions : DEFAULT_ROLE_PERMISSIONS[r] ?? [];
  };

  const addAdmin = () =>
    modal.open({
      title: '+ Add Admin',
      wide: true,
      formCols: 2,
      fields: [
        { key: 'name', label: 'Full Name', required: true },
        { key: 'email', label: 'Email Address', required: true },
        { key: 'phone', label: 'Phone Number' },
        { key: 'photo', label: 'Profile Photo URL' },
        { key: 'pw', label: 'Password', type: 'password', required: true, hint: 'Min 8 characters' },
        { key: 'role', label: 'Role', type: 'select', options: ASSIGNABLE.map((r) => ({ value: r, label: statusLabel(r) })), required: true },
        { key: 'dept', label: 'Department' },
        { key: 'welcome', label: 'Send welcome email — Send login credentials to admin via email', type: 'checkbox', default: true },
      ],
      validate: (v) => {
        const email = s(v.email).trim().toLowerCase();
        return {
          email: /^\S+@\S+\.\S+$/.test(email) ? (admins.some((a) => a.email.toLowerCase() === email) ? 'An admin with this email already exists' : '') : 'Enter a valid email',
          pw: s(v.pw).length < 8 ? 'Min 8 characters' : '',
          photo: !s(v.photo).trim() || /^https:\/\//.test(s(v.photo).trim()) ? '' : 'URL must start with https://',
        };
      },
      submit: 'Add Admin',
      onSubmit: async (v) => {
        const email = s(v.email).trim().toLowerCase();
        const role = s(v.role);
        const created = await adminMut.mutateAsync(() =>
          inviteAdmin({
            name: s(v.name).trim(), email, phone: s(v.phone).trim() || undefined, photoUrl: s(v.photo).trim() || undefined, role,
            department: s(v.dept).trim() || undefined, permissions: DEFAULT_ROLE_PERMISSIONS[role] ?? [], status: 'active',
          }),
        );
        // The chosen password is applied through the reset-password endpoint once the account exists.
        const id = (created as AdminOperator).id;
        if (id) await resetAdminPassword(id, s(v.pw));
        toast('✅ Admin added');
        if (v.welcome) openCompose({ channel: 'email', name: s(v.name).trim(), to: email, subject: 'Your BuiltGlory admin account', body: 'Hi ' + s(v.name).trim().split(' ')[0] + ',\n\nAn admin account has been created for you on the BuiltGlory dashboard. Sign in with this email address; your administrator will share your password separately.\n\nThanks,\nBuiltGlory' });
      },
    });

  const addMember = () =>
    modal.open({
      title: '+ Add Sales Member',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'phone', label: 'Phone', required: true },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', type: 'select', options: SALES_ROLES.map(([value, label]) => ({ value, label })), default: 'sales_executive' },
        { key: 'areas', label: 'Assigned Areas (comma-separated)', placeholder: 'Whitefield, Marathahalli' },
      ],
      validate: (v) => ({ email: !s(v.email).trim() || /^\S+@\S+\.\S+$/.test(s(v.email).trim()) ? '' : 'Enter a valid email' }),
      submit: 'Add Member',
      onSubmit: (v) => teamMut.mutateAsync(() => createSalesTeamMember({ name: s(v.name).trim(), phone: s(v.phone).trim(), email: s(v.email).trim(), role: s(v.role), assignedArea: areasOf(v.areas) })).then(() => toast('✅ Member added')),
    });

  const viewActivity = async (a: AdminOperator) => {
    try {
      const r = await listAuditLogs(a.name);
      const acts = r.items.filter((x) => x.admin === a.name).slice(0, 8);
      modal.open({ title: a.name + ' — recent activity', text: acts.length ? acts.map((x) => '• ' + x.description + ' (' + relativeLong(x.at) + ')').join('\n') : 'No recent audit entries for this admin.', submit: 'Close' });
    } catch (e) {
      toast('⚠️ ' + formatApiError(e));
    }
  };

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Access Control"
      meta="Admins, sales team and role permissions"
      single
      hActions={[btn('+ Add Admin', addAdmin, 'primary', { disabled: adminsQ.isError }), btn('+ Add Member', addMember)]}
      banners={[adminsQ.isError ? { text: '⚠️ Could not load admin accounts: ' + formatApiError(adminsQ.error), tone: 'error', actions: [{ label: 'Retry', onClick: () => void adminsQ.refetch() }] } : null]}
      main={[
        {
          title: 'Admin Users',
          rows: admins.map((a) => ({
            key: a.id,
            initials: initials(a.name),
            title: a.name + ' · ' + a.email,
            sub: statusLabel(a.role) + (a.department ? ' · ' + a.department : '') + ' · Last active ' + (a.lastLoginAt ? relativeLong(a.lastLoginAt) : '—'),
            badges: [statusBadge(a.status, a.status === 'invited' ? 'Invited' : statusLabel(a.status))],
            actions:
              a.role === 'super_admin'
                ? []
                : a.status === 'invited'
                  ? [
                      { label: 'Resend Invite', disabled: true, title: 'The API has no resend-invite endpoint', onClick: () => undefined },
                      { label: 'Cancel Invite', variant: 'red' as const, onClick: () => askConfirm({ title: 'Cancel invite?', confirmLabel: 'Cancel Invite', tone: 'destructive', onConfirm: () => adminMut.mutateAsync(() => removeAdmin(a.id)).then(() => toast('Invite cancelled: ' + a.email)) }) },
                    ]
                  : [
                      {
                        label: 'Edit Profile',
                        onClick: () =>
                          modal.open({
                            title: 'Edit ' + a.name,
                            fields: [
                              { key: 'name', label: 'Full Name', default: a.name, required: true },
                              { key: 'role', label: 'Role', type: 'select', options: ASSIGNABLE.map((r) => ({ value: r, label: statusLabel(r) })), default: a.role },
                            ],
                            onSubmit: (v) => adminMut.mutateAsync(() => updateAdmin(a.id, { name: s(v.name).trim(), role: s(v.role) })).then(() => toast(a.name + ' profile updated')),
                          }),
                      },
                      {
                        label: 'Reset Password',
                        onClick: () =>
                          modal.open({
                            title: 'Reset Password',
                            fields: [
                              { key: 'p1', label: 'New password', type: 'password', required: true },
                              { key: 'p2', label: 'Confirm password', type: 'password', required: true },
                            ],
                            validate: (v) => ({ p1: s(v.p1).length < 8 ? 'Min 8 characters' : '', p2: v.p1 !== v.p2 ? 'Passwords do not match' : '' }),
                            submit: 'Reset',
                            onSubmit: (v) => adminMut.mutateAsync(() => resetAdminPassword(a.id, s(v.p1))).then(() => toast('🔑 Password reset for ' + a.name)),
                          }),
                      },
                      { label: 'View Activity', onClick: () => void viewActivity(a) },
                      a.status === 'suspended' || !a.isActive
                        ? { label: 'Activate', variant: 'green' as const, onClick: () => adminMut.mutate(() => setAdminSuspended(a.id, false), { onSuccess: () => toast(a.name + ' reactivated') }) }
                        : { label: 'Suspend', variant: 'red' as const, onClick: () => askConfirm({ title: 'Suspend admin?', message: 'They will not be able to login', confirmLabel: 'Suspend', tone: 'destructive', onConfirm: () => adminMut.mutateAsync(() => setAdminSuspended(a.id, true)).then(() => toast(a.name + ' suspended')) }) },
                      { label: 'Remove', variant: 'red' as const, onClick: () => askConfirm({ title: 'Remove admin?', message: a.name + ' will lose all access.', confirmLabel: 'Remove', tone: 'destructive', onConfirm: () => adminMut.mutateAsync(() => removeAdmin(a.id)).then(() => toast('Admin removed: ' + a.name)) }) },
                    ],
          })),
          empty: admins.length ? '' : adminsQ.isPending ? 'Loading…' : adminsQ.isError ? 'Unavailable' : 'No admin accounts yet',
        },
        {
          title: 'Sales Team',
          rows: members.map((m) => ({
            key: m.id,
            initials: initials(m.name),
            title: m.name + ' · ' + (SALES_ROLES.find(([k]) => k === m.role)?.[1] || statusLabel(m.role) || 'Sales Executive'),
            sub: (m.assignedArea.join(', ') || 'No areas assigned') + ' · ' + enquiries.filter((e) => e.assignedTo === m.id && e.status !== 'closed').length + ' active enquiries',
            badges: [statusBadge(m.isAvailable ? 'active' : 'inactive', m.isAvailable ? 'Available' : 'Unavailable')],
            actions: [
              { label: m.isAvailable ? 'Set unavailable' : 'Set available', onClick: () => teamMut.mutate(() => updateSalesTeamMember(m.id, { isAvailable: !m.isAvailable }), { onSuccess: () => toast(m.name + (m.isAvailable ? ' set unavailable' : ' set available')) }) },
              {
                label: 'Edit',
                onClick: () =>
                  modal.open({
                    title: 'Edit ' + m.name,
                    fields: [
                      { key: 'role', label: 'Role', type: 'select', options: SALES_ROLES.map(([value, label]) => ({ value, label })), default: m.role || 'sales_executive' },
                      { key: 'areas', label: 'Assigned Areas (comma-separated)', default: m.assignedArea.join(', ') },
                    ],
                    onSubmit: (v) => teamMut.mutateAsync(() => updateSalesTeamMember(m.id, { role: s(v.role), assignedArea: areasOf(v.areas) })).then(() => toast(m.name + ' updated')),
                  }),
              },
              { label: 'Remove', variant: 'red' as const, onClick: () => askConfirm({ title: 'Remove sales member?', confirmLabel: 'Remove', tone: 'destructive', onConfirm: () => teamMut.mutateAsync(() => removeSalesTeamMember(m.id)).then(() => toast('Sales member removed: ' + m.name)) }) },
            ],
          })),
          empty: members.length ? '' : team.isPending ? 'Loading…' : team.isError ? 'Could not load the sales team' : 'No sales team members yet',
        },
        {
          title: 'Roles & Permissions',
          subtitle: 'Permissions are stored per admin account; saving applies them to every admin with the role.',
          rows: ROLES.map((r) => ({
            key: r,
            title: statusLabel(r),
            sub: r === 'super_admin' ? 'Full access to everything · Cannot be edited or deleted' : rolePerms(r).length + ' permissions · ' + admins.filter((a) => a.role === r).length + ' admins',
            actions:
              r === 'super_admin'
                ? []
                : [
                    {
                      label: 'Edit Permissions',
                      disabled: adminsQ.isError,
                      onClick: () => {
                        const cur = new Set(rolePerms(r));
                        modal.open({
                          title: 'Edit Permissions — ' + statusLabel(r),
                          wide: true,
                          formCols: 2,
                          fields: ALL_PERMISSIONS.map((p, k) => ({ key: 'p' + k, label: p, type: 'checkbox' as const, default: cur.has(p) })),
                          submit: 'Save Permissions',
                          onSubmit: async (v) => {
                            const next = ALL_PERMISSIONS.filter((_, k) => v['p' + k]);
                            const targets = admins.filter((a) => a.role === r);
                            if (!targets.length) throw new Error('No admin accounts have the ' + statusLabel(r) + ' role yet — permissions are saved per admin.');
                            await adminMut.mutateAsync(() => Promise.all(targets.map((a) => updateAdminPermissions(a.id, next))));
                            toast('✅ Permissions saved for ' + targets.length + ' admin' + (targets.length > 1 ? 's' : ''));
                          },
                        });
                      },
                    },
                  ],
          })),
        },
        {
          title: 'Recent Access Logs',
          rows: accessLogs.map((l) => ({ key: l.id, title: l.admin + ' · ' + statusLabel(l.action), sub: l.ip + ' · ' + l.device + ' · ' + dateTime(l.at) })),
          empty: accessLogs.length ? '' : auditQ.isPending ? 'Loading…' : auditQ.isError ? 'Could not load access logs: ' + formatApiError(auditQ.error) : 'No backend access activity has been recorded yet.',
        },
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
