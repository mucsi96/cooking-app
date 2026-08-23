import { cleanupDb } from './utils';

async function globalSetup() {
  await cleanupDb();
}

export default globalSetup;
