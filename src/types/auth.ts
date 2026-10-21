export interface AdminUser {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: string;
  permissions?: string[];
}

/** `POST /api/v1/auth/admin/login` → data */
export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  admin: AdminUser;
}

/** `GET /api/v1/public/admin-login-stats` → data */
export interface AdminLoginStats {
  properties: number;
  users: number;
  deals: number;
}

/** `GET /api/v1/admin/sessions` → data[] */
export interface AdminDeviceSession {
  sid: string;
  type: string;
  role: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
  status: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}
