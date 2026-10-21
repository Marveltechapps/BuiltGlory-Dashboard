import { navigation, type NavSection } from './nav';

export type AdminPermission =
  | 'properties.read' | 'properties.write' | 'properties.publish'
  | 'users.read' | 'users.write' | 'users.kyc.review' | 'users.fema.review'
  | 'enquiries.read' | 'enquiries.write'
  | 'acquisitions.read' | 'acquisitions.write'
  | 'sales.read' | 'sales.write'
  | 'support.read' | 'support.write'
  | 'admin.access.manage' | 'audit.read'
  | 'visits.read' | 'visits.write';

export const ALL_PERMISSIONS: AdminPermission[] = [
  'properties.read', 'properties.write', 'properties.publish', 'users.read', 'users.write', 'users.kyc.review', 'users.fema.review',
  'enquiries.read', 'enquiries.write', 'acquisitions.read', 'acquisitions.write', 'sales.read', 'sales.write', 'support.read', 'support.write',
  'admin.access.manage', 'audit.read', 'visits.read', 'visits.write',
];

export const ROLES = ['super_admin', 'admin', 'operations', 'support', 'sales_manager', 'sales_executive', 'relationship_manager', 'designer'] as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => p !== 'admin.access.manage'),
  operations: ['properties.read', 'properties.write', 'enquiries.read', 'enquiries.write', 'acquisitions.read', 'acquisitions.write', 'support.read', 'support.write'],
  support: ['users.read', 'support.read', 'support.write'],
  sales_manager: ['properties.read', 'enquiries.read', 'enquiries.write', 'sales.read', 'sales.write', 'visits.read', 'visits.write'],
  sales_executive: ['properties.read', 'enquiries.read', 'enquiries.write', 'sales.read', 'sales.write'],
  relationship_manager: ['users.read', 'users.write', 'users.kyc.review', 'users.fema.review', 'support.read', 'support.write', 'sales.read'],
  designer: ['support.read', 'support.write'],
};

const SECTION_PERMISSIONS: Record<string, AdminPermission[]> = {
  enquiries: ['enquiries.read'], acquisition: ['acquisitions.read'], sales: ['sales.read'], properties: ['properties.read'], users: ['users.read'],
  reports: ['sales.read', 'audit.read'], tools: ['properties.write', 'support.write', 'admin.access.manage'], admin: ['support.read', 'admin.access.manage', 'audit.read'],
};

const PATH_RULES: Array<[RegExp, AdminPermission[]]> = [
  [/^\/admin\/overview$/, []], [/^\/admin\/enquiries/, ['enquiries.read']], [/^\/admin\/visits/, ['enquiries.read']], [/^\/admin\/callbacks/, ['enquiries.read']],
  [/^\/admin\/acquisition/, ['acquisitions.read']], [/^\/admin\/sales/, ['sales.read']], [/^\/admin\/properties\/(?:add|upload)/, ['properties.write']],
  [/^\/admin\/properties/, ['properties.read']], [/^\/admin\/users/, ['users.read']], [/^\/admin\/reports\/export/, ['audit.read']], [/^\/admin\/reports/, ['sales.read']],
  [/^\/admin\/tools/, ['properties.write', 'support.write', 'admin.access.manage']], [/^\/admin\/settings\/access/, ['admin.access.manage']],
  [/^\/admin\/settings\/audit/, ['audit.read']], [/^\/admin\/settings\/feedback/, ['support.read']], [/^\/admin\/settings\/legal/, ['support.write']],
  [/^\/admin\/settings\/support/, ['support.read']], [/^\/admin\/settings\/general/, ['admin.access.manage']],
];

export interface PermissionSubject {
  role: string;
  permissions?: string[];
}

export function grantedPermissions(admin: PermissionSubject | null | undefined): Set<string> {
  if (!admin) return new Set();
  if (admin.role === 'super_admin') return new Set(ALL_PERMISSIONS);
  const explicit = admin.permissions ?? [];
  return new Set(explicit.length ? explicit : DEFAULT_ROLE_PERMISSIONS[admin.role] ?? []);
}

export function hasAny(admin: PermissionSubject | null | undefined, list: AdminPermission[] = []): boolean {
  if (!list.length) return true;
  if (admin?.role === 'super_admin') return true;
  const g = grantedPermissions(admin);
  return list.some((p) => g.has(p));
}

export const isPathAllowed = (admin: PermissionSubject | null | undefined, path: string) =>
  hasAny(admin, PATH_RULES.find(([re]) => re.test(path))?.[1] ?? []);

export function allowedSections(admin: PermissionSubject | null | undefined): NavSection[] {
  return navigation
    .filter((s) => hasAny(admin, SECTION_PERMISSIONS[s.id] ?? []))
    .map((s) => ({ ...s, tabs: s.tabs.filter((t) => isPathAllowed(admin, t.path)) }))
    .filter((s) => s.tabs.length > 0);
}

export const firstAllowedPath = (admin: PermissionSubject | null | undefined) => allowedSections(admin)[0]?.tabs[0]?.path ?? '/admin/overview';
