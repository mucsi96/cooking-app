import { test as base, TestInfo } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cleanupDb } from './utils';

const MOCK_SERVERS = [
  process.env.TEST_ANTHROPIC_URL ?? 'http://localhost:3060',
  process.env.TEST_OPENAI_URL ?? 'http://localhost:3061',
];

export const test = base.extend<{ apiHeaders: Record<string, string> }>({
  apiHeaders: async ({ request }, use) => {
    const issuer = process.env.TEST_OAUTH2_URL ?? 'http://localhost:8060';
    const redirect = 'http://localhost/test';
    const authorization = await request.get(`${issuer}/default/authorize`, {
      params: { client_id: 'test-client', redirect_uri: redirect, response_type: 'code' },
      maxRedirects: 0,
    });
    const code = new URL(authorization.headers()['location']).searchParams.get('code')!;
    const tokens = await request.post(`${issuer}/default/token`, {
      form: { grant_type: 'authorization_code', client_id: 'test-client', redirect_uri: redirect, code },
    });
    if (!tokens.ok()) throw new Error(`Mock token request failed: ${tokens.status()}`);
    await use({ Authorization: `Bearer ${(await tokens.json()).access_token}` });
  },
  page: async ({ page, apiHeaders }, use, testInfo: TestInfo) => {
    await cleanupDb();

    await page.route('**/_telemetry/collect', route => route.fulfill({ status: 202, body: 'ok' }));

    // Stand in for the gateway's verified identity; no proxy/session stack in app tests.
    await page.route('**/api/**', route => route.continue({ headers: { ...route.request().headers(), ...apiHeaders } }));
    await page.route('**/oauth2/userinfo', route => route.fulfill({ json: { email: 'owner@example.test', additionalClaims: { name: 'Owner' } } }));

    // Reset mock AI servers
    await Promise.all(
      MOCK_SERVERS.map(async (server) => {
          const response = await fetch(`${server}/reset`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) throw new Error(`Could not reset mock AI server ${server}`);
      })
    );

    // Capture browser console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      const timestamp = new Date().toISOString();
      consoleLogs.push(
        `[${timestamp}] [${type.toUpperCase()}] ${text} (${location.url}:${location.lineNumber})`
      );
    });

    page.on('pageerror', (error) => {
      const timestamp = new Date().toISOString();
      consoleLogs.push(`[${timestamp}] [PAGE_ERROR] ${error.message}\n${error.stack}`);
    });

    // Now expose the page to tests
    await use(page);

    // Save console logs on test failure
    if (testInfo.status !== testInfo.expectedStatus && consoleLogs.length > 0) {
      const outputDir = testInfo.outputDir;
      mkdirSync(outputDir, { recursive: true });
      const logPath = join(outputDir, 'console-logs.txt');
      writeFileSync(logPath, consoleLogs.join('\n'));
      testInfo.attachments.push({
        name: 'console-logs',
        path: logPath,
        contentType: 'text/plain',
      });
    }
  },
});

export { expect } from '@playwright/test';
