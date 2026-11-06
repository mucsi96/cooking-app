import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { Client } from 'pg';
import { test, expect } from '../fixtures';
import { GULYAS } from '../utils';
import { PHOTO } from '../photo';

const exec = promisify(execFile);
async function freePort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

test('adopts a populated legacy database and preserves data and image files across restarts', async ({ request, apiHeaders }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = randomUUID().replace(/-/g, '');
  const database = `cooking_upgrade_${suffix}`;
  const container = `cooking-upgrade-${suffix}`;
  const port = await freePort();
  const managementPort = await freePort();
  const origin = `http://localhost:${port}`;
  const connection = { host: '127.0.0.1', port: Number(process.env.TEST_DB_PORT ?? 5461), user: 'postgres', password: 'postgres' };
  const admin = new Client({ ...connection, database: 'test' });
  const legacy = new Client({ ...connection, database });
  const storage = await mkdtemp(join(tmpdir(), 'cooking-upgrade-'));
  const recipeId = randomUUID();
  const imageId = randomUUID();
  const image = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  const selection = { extraction: 'gpt-6-astra', scene: 'claude-sonnet-5', images: [] };
  try {
    await admin.connect();
    // A uniquely named database in Cooking's own test PostgreSQL; never use another app's DB.
    await admin.query(`CREATE DATABASE "${database}"`);
    await legacy.connect();
    for (const file of ['00001_recipes.sql', '00002_model_settings.sql', '00003_image_source.sql']) {
      const sql = await readFile(resolve(__dirname, '../../server/internal/database/migrations', file), 'utf8');
      await legacy.query(sql.split('-- +goose Down')[0]);
    }
    await legacy.query('CREATE TABLE public.goose_db_version (id bigserial PRIMARY KEY, version_id bigint, is_applied boolean)');
    await legacy.query('INSERT INTO public.goose_db_version(version_id,is_applied) VALUES (1,true),(2,true),(3,true)');
    await legacy.query('INSERT INTO cooking.recipes(id,title,description,category,servings,image_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [recipeId, GULYAS.title, GULYAS.description, GULYAS.category, GULYAS.servings, imageId, '2024-01-02T03:04:05Z']);
    for (const [position, ingredient] of GULYAS.ingredients.entries()) {
      await legacy.query('INSERT INTO cooking.recipe_ingredients VALUES($1,$2,$3,$4,$5)', [recipeId, position, ingredient.name, ingredient.amount, ingredient.unit]);
    }
    for (const [position, step] of GULYAS.steps.entries()) {
      await legacy.query('INSERT INTO cooking.recipe_steps VALUES($1,$2,$3)', [recipeId, position, step]);
    }
    await legacy.query("INSERT INTO cooking.image_generation_jobs(id,recipe_id,status,created_at) VALUES($1,$2,'COMPLETED',now())", [imageId, recipeId]);
    await legacy.query('INSERT INTO cooking.model_settings VALUES(1,$1)', [selection]);
    await mkdir(join(storage, 'images'));
    await writeFile(join(storage, 'images', `${imageId}.webp`), image);
    const env = {
      SERVER_PORT: String(port), MANAGEMENT_PORT: String(managementPort), BROWSER_ORIGIN: origin,
      DB_URL: `postgres://postgres:postgres@127.0.0.1:${connection.port}/${database}?sslmode=disable`,
      OIDC_ISSUER: `${process.env.TEST_OAUTH2_URL ?? 'http://localhost:8060'}/default`, API_CLIENT_ID: 'mock-api-client-id',
      ANTHROPIC_API_KEY: 'mock-key', ANTHROPIC_BASE_URL: process.env.TEST_ANTHROPIC_URL ?? 'http://localhost:3060',
      OPENAI_API_KEY: 'mock-key', OPENAI_BASE_URL: process.env.TEST_OPENAI_URL ?? 'http://localhost:3061',
      OPENAI_ALLOW_LOCAL_HTTP: 'true', STORAGE_DIRECTORY: '/storage',
    };
    await exec('podman', ['run', '-d', '--name', container, '--network', 'host', '-v', `${storage}:/storage:Z`,
      ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
      process.env.TEST_SERVER_IMAGE ?? 'localhost/cooking-app-server:test']);
    for (let startup = 0; startup < 2; startup++) {
      if (startup) await exec('podman', ['restart', container]);
      await expect.poll(async () => {
        try { return (await request.get(`http://localhost:${managementPort}/health/readiness`)).status(); } catch { return 0; }
      }, { timeout: 45_000 }).toBe(200);
      const response = await request.get(`${origin}/api/recipes/${recipeId}`, { headers: apiHeaders });
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ id: recipeId, imageId, ...GULYAS });
      expect(await (await request.get(`${origin}/api/settings/models`, { headers: apiHeaders })).json()).toEqual(selection);
      const storedImage = await request.get(`${origin}/api/images/${imageId}`, { headers: apiHeaders });
      expect(await storedImage.body()).toEqual(image);
      expect(storedImage.headers()['cache-control']).toContain('immutable');
      expect((await legacy.query('SELECT created_at FROM cooking.recipes WHERE id=$1', [recipeId])).rows[0].created_at.toISOString()).toBe('2024-01-02T03:04:05.000Z');
      expect((await legacy.query('SELECT version_id FROM public.goose_db_version ORDER BY id')).rows).toEqual([{ version_id: '1' }, { version_id: '2' }, { version_id: '3' }]);
      expect((await legacy.query('SELECT last_value FROM public.goose_db_version_id_seq')).rows[0].last_value).toBe('3');
    }
    // Normal writes continue against the adopted schema and keep the selected image.
    expect((await request.put(`${origin}/api/recipes/${recipeId}`, { headers: { ...apiHeaders, Origin: origin }, data: { ...GULYAS, servings: 6 } })).status()).toBe(204);
    expect((await (await request.get(`${origin}/api/recipes/${recipeId}`, { headers: apiHeaders })).json()).imageId).toBe(imageId);

    // Interrupt an in-flight photo edit. Its transaction must return the durable
    // JPEG to the pending queue, then a new process must finish that same job.
    const mock = process.env.TEST_OPENAI_URL ?? 'http://localhost:3061';
    await request.post(`${mock}/reset`);
    await request.post(`${mock}/image-edit-behavior`, { data: { delayMs: 20_000 } });
    expect((await request.put(`${origin}/api/settings/models`, { headers: { ...apiHeaders, Origin: origin }, data: {
      ...selection, images: [{ id: 'gpt-image-2.5-sunburst-medium', count: 1 }],
    } })).status()).toBe(204);
    const queued = await request.post(`${origin}/api/recipes/${recipeId}/images`, {
      headers: { ...apiHeaders, Origin: origin },
      multipart: { image: { name: 'food.bmp', mimeType: 'image/bmp', buffer: PHOTO } },
    });
    expect(queued.status()).toBe(200);
    const [{ id: jobId }] = await queued.json();
    await expect.poll(async () => (await (await request.get(`${mock}/requests`)).json()).some((r: { operation: string }) => r.operation === 'edit'), { timeout: 15_000 }).toBe(true);
    await exec('podman', ['stop', '--time', '10', container]);
    const interrupted = (await legacy.query('SELECT status,source_photo FROM cooking.image_generation_jobs WHERE id=$1', [jobId])).rows[0];
    expect(interrupted.status).toBe('PENDING');
    expect(interrupted.source_photo.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    await request.post(`${mock}/image-edit-behavior`, { data: { delayMs: 0 } });
    await exec('podman', ['start', container]);
    await expect.poll(async () => (await legacy.query('SELECT status FROM cooking.image_generation_jobs WHERE id=$1', [jobId])).rows[0].status, { timeout: 30_000 }).toBe('COMPLETED');
    expect((await legacy.query('SELECT source_photo FROM cooking.image_generation_jobs WHERE id=$1', [jobId])).rows[0].source_photo).toBeNull();
    expect((await request.get(`${origin}/api/images/${jobId}`, { headers: apiHeaders })).status()).toBe(200);
  } finally {
    const logs = await exec('podman', ['logs', container]).catch(() => ({ stdout: '', stderr: '' }));
    await testInfo.attach('upgrade-server.log', { body: logs.stdout + logs.stderr, contentType: 'text/plain' });
    await exec('podman', ['rm', '-f', container]).catch(() => {});
    await legacy.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
    await rm(storage, { recursive: true, force: true });
  }
});
