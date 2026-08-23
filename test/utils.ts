import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5461,
  database: 'test',
  user: 'postgres',
  password: 'postgres',
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function cleanupDb() {
  await query('DELETE FROM cooking.greetings');
}

export async function populateDb() {
  await query(`
    INSERT INTO cooking.greetings (name, message)
    VALUES ('World', 'Welcome to the cooking app!')
    ON CONFLICT DO NOTHING
  `);
}

export async function cleanupDbRecords() {
  await query('DELETE FROM cooking.greetings');
}

export async function insertGreeting(name: string, message: string) {
  await query('INSERT INTO cooking.greetings (name, message) VALUES ($1, $2)', [name, message]);
}

export async function getGreetings() {
  const result = await query('SELECT * FROM cooking.greetings ORDER BY id');
  return result.rows;
}
