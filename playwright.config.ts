import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(root, '..', 'BG-Service');
const API = process.env.E2E_API_URL || 'http://127.0.0.1:5002';
// Prefer localhost: on Windows Vite may bind ::1 only, so 127.0.0.1:5174 can fail.
const APP = process.env.E2E_APP_URL || 'http://localhost:5174';
const startServers = process.env.E2E_START_SERVERS !== '0';

/** QA-BUG-010: refuse to start the API against a shared/production MongoDB. */
const assertSafeMongoUri = (uri: string | undefined, label: string) => {
  const value = String(uri || '').trim();
  if (!value) {
    throw new Error(
      `[E2E safety] ${label} is missing. Set a local/test MongoDB URI (e.g. mongodb://127.0.0.1:27017/bg-e2e) before starting servers.`
    );
  }
  const lower = value.toLowerCase();
  const isLocal =
    lower.includes('127.0.0.1') ||
    lower.includes('localhost') ||
    lower.includes('mongodb-memory') ||
    /\/bg[-_]?(e2e|test|qa)\b/i.test(value);
  const looksShared =
    lower.includes('mongodb+srv://') ||
    lower.includes('amazonaws.com') ||
    lower.includes('mongo.cosmos') ||
    lower.includes('atlas');
  if (!isLocal || looksShared) {
    throw new Error(
      `[E2E safety] ${label} does not look like an isolated local/test database. ` +
        `Refusing to start. Use E2E_START_SERVERS=0 with an already-isolated API, or set E2E_MONGODB_URI to a local URI.`
    );
  }
};

if (startServers) {
  assertSafeMongoUri(process.env.E2E_MONGODB_URI || process.env.MONGODB_URI, 'E2E_MONGODB_URI / MONGODB_URI');
}

const reuseExistingServer = process.env.E2E_REUSE_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: APP,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: startServers
    ? [
        {
          command: 'node src/server.js',
          cwd: serviceRoot,
          url: `${API}/health`,
          // Default false so a developer Atlas server on :5002 is never reused silently (QA-BUG-010).
          reuseExistingServer,
          timeout: 180_000,
          env: {
            ...process.env,
            PORT: '5002',
            NODE_ENV: process.env.NODE_ENV || 'test',
            MONGODB_URI: process.env.E2E_MONGODB_URI || process.env.MONGODB_URI || '',
            REDIS_URL: process.env.E2E_REDIS_URL || process.env.REDIS_URL || '',
            SMS_DELIVERY_MODE: 'log',
            AWS_S3_BUCKET: '',
            AWS_ACCESS_KEY_ID: '',
            AWS_SECRET_ACCESS_KEY: '',
          },
        },
        {
          command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort',
          cwd: root,
          url: APP,
          reuseExistingServer,
          timeout: 180_000,
          env: {
            ...process.env,
            VITE_API_URL: API,
          },
        },
      ]
    : undefined,
});
