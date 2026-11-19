export const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:5001';
export const APP_URL = process.env.E2E_APP_URL || 'http://127.0.0.1:5174';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@builtglory.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

export const LIMITED_EMAIL = process.env.E2E_LIMITED_EMAIL || 'e2e-ops@builtglory.test';
export const LIMITED_PASSWORD = process.env.E2E_LIMITED_PASSWORD || 'OpsPass123!';
