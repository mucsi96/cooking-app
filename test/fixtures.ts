import { test as base, TestInfo } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cleanupDb } from './utils';

const MOCK_SERVERS = ['http://localhost:3060', 'http://localhost:3061'];

export const test = base.extend({
  page: async ({ page }, use, testInfo: TestInfo) => {
    await cleanupDb();

    // Reset mock AI servers
    await Promise.all(
      MOCK_SERVERS.map(async (server) => {
        try {
          await fetch(`${server}/reset`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000),
          });
        } catch (error) {
          console.warn(`Warning: Could not reset mock AI server ${server}:`, error);
        }
      })
    );

    // Keep tests hermetic: never wait on the external font CDN
    await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort());

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
