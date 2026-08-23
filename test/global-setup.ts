import { cleanupDb, populateDb } from './utils';

async function globalSetup() {
  await cleanupDb();
  await populateDb();
}

export default globalSetup;
