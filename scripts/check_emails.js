import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.exfyprnpkplhzuuloebf:Kdilshanbandara5712indika@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT * FROM email_logs ORDER BY log_id DESC LIMIT 5");
  console.log(res.rows);
  await client.end();
}

run().catch(console.error);
