// ============================================================
//  CSEP — 컴퓨터 A/S ERP  (필드서비스 뼈대 기반: Express + pg + SSE + FCM)
// ============================================================
try { require('dotenv').config(); } catch (e) {}  // 로컬 개발용 (.env), 없으면 무시
const express = require('express');
const { Pool, types } = require('pg');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
let webpush = null, admin = null;
try { webpush = require('web-push'); } catch (e) {}
try { admin = require('firebase-admin'); } catch (e) {}

// timestamp를 Date 객체가 아닌 문자열로 반환 (필드서비스 방식)
types.setTypeParser(1114, v => v);
types.setTypeParser(1184, v => v);

// ── VAPID (웹푸시) ──
if (webpush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:wotjq2@gmail.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

// ── Firebase Admin (FCM) ──
try {
  if (admin && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log('Firebase Admin SDK 초기화 완료');
  }
} catch (e) { console.log('Firebase 초기화 실패 (푸시 비활성):', e.message); }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, '../admin')));
app.use('/engineer', express.static(path.join(__dirname, '../engineer')));

// 슬립 방지용 경량 헬스체크 (UptimeRobot). 응답 2바이트.
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('text/plain').send('ok');
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── 유틸 ──
const digits = s => (s || '').replace(/\D/g, '');
const wrap = fn => (req, res) => fn(req, res).catch(e => {
  console.error(req.method, req.path, e.message);
  res.status(500).json({ error: e.message });
});

// ============================================================
//  SSE (실시간)
// ============================================================
const adminClients = new Set();          // 관리자 SSE 연결
const engineerClients = new Map();        // engineer_id → res

function notifyEngineer(engineerId, event, data) {
  const res = engineerClients.get(String(engineerId));
  if (!res) return;
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
  catch (e) { engineerClients.delete(String(engineerId)); }
}

function broadcastAdmin(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  adminClients.forEach(res => { try { res.write(msg); } catch (e) { adminClients.delete(res); } });
}

// 무효(죽은) FCM 토큰이면 DB에서 삭제
function isDeadToken(e) {
  const c = e && e.code || '';
  return c === 'messaging/registration-token-not-registered'
      || c === 'messaging/invalid-registration-token'
      || c === 'messaging/invalid-argument'
      || /not.?found/i.test(e && e.message || '');
}
async function fcmSend(token, msg) {
  try {
    await admin.messaging().send(msg);
    return true;
  } catch (e) {
    if (isDeadToken(e)) {
      try { await pool.query('DELETE FROM fcm_tokens WHERE fcm_token=$1', [token]); console.log('죽은 FCM 토큰 삭제'); } catch (_) {}
    } else { console.log('FCM 전송 오류:', e.message); }
    return false;
  }
}

// 기사에게 푸시 (FCM 우선, 웹푸시 폴백)
async function sendPushToEngineer(engineer_id, title, body) {
  try {
    const fcm = await pool.query('SELECT fcm_token FROM fcm_tokens WHERE engineer_id=$1', [engineer_id]);
    if (fcm.rows[0] && admin && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      // data-only → 앱의 MyFCMService가 커스텀 소리 재생 + 무음 알림
      await fcmSend(fcm.rows[0].fcm_token, {
        token: fcm.rows[0].fcm_token,
        data: { title: String(title), body: String(body), type: 'engineer' },
        notification: { title: String(title), body: String(body) },
        android: { priority: 'high' },
      });
      return;
    }
    if (webpush) {
      const subs = await pool.query('SELECT subscription FROM push_subscriptions WHERE engineer_id=$1', [engineer_id]);
      for (const r of subs.rows) {
        try { await webpush.sendNotification(JSON.parse(r.subscription), JSON.stringify({ title, body })); } catch (e) {}
      }
    }
  } catch (e) { console.log('푸시 실패:', e.message); }
}

// 대표(is_admin) 전원에게 FCM (data-only → 앱이 커스텀 소리로 처리)
async function sendPushToBosses(title, body, type) {
  try {
    if (!admin || !process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) return;
    const rows = (await pool.query(
      'SELECT f.fcm_token FROM fcm_tokens f JOIN engineers e ON e.id=f.engineer_id WHERE e.is_admin=TRUE AND f.fcm_token IS NOT NULL'
    )).rows;
    for (const r of rows) {
      await fcmSend(r.fcm_token, {
        token: r.fcm_token,
        data: { title: String(title), body: String(body), type: type || 'incoming_call' },
        android: { priority: 'high' },
      });
    }
  } catch (e) { console.log('sendPushToBosses 오류:', e.message); }
}

// ============================================================
//  DB 초기화
// ============================================================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS engineers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'idle',
      location TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      password TEXT,
      total_jobs INTEGER DEFAULT 0,
      total_revenue DOUBLE PRECISION DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      customer_type TEXT DEFAULT 'personal',
      company_name TEXT,
      contact_person TEXT,
      phone TEXT,
      phone2 TEXT,
      email TEXT,
      address TEXT,
      address_detail TEXT,
      memo TEXT,
      outstanding_amount DOUBLE PRECISION DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS computers (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT,
      device_type TEXT DEFAULT 'desktop',
      cpu TEXT, ram TEXT, ssd TEXT, hdd TEXT, motherboard TEXT, gpu TEXT,
      os TEXT, os_version TEXT, office_version TEXT, antivirus TEXT,
      ip_address TEXT, mac_address TEXT, serial_number TEXT, assembled BOOLEAN DEFAULT FALSE,
      power TEXT, purchase_date TEXT, warranty_expiry TEXT, printer TEXT, monitor TEXT,
      nas_name TEXT, nas_model TEXT, nas_ip TEXT, nas_hdd_count INTEGER, nas_hdd_detail TEXT,
      nas_total_capacity TEXT, nas_partition_info TEXT, nas_maintenance_period TEXT, nas_maintenance_notes TEXT,
      nas_admin_id TEXT, nas_admin_password TEXT,
      router_name TEXT, router_model TEXT, router_ip TEXT, router_admin_id TEXT, router_admin_password TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS receptions (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      computer_id INTEGER REFERENCES computers(id) ON DELETE SET NULL,
      reception_channel TEXT,
      reception_phone TEXT,
      symptom TEXT,
      initial_memo TEXT,
      status TEXT DEFAULT 'new',
      assigned_engineer_id INTEGER REFERENCES engineers(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      solution TEXT,
      received_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      reception_id INTEGER REFERENCES receptions(id) ON DELETE CASCADE,
      engineer_id INTEGER REFERENCES engineers(id) ON DELETE SET NULL,
      scheduled_date TEXT,
      status TEXT DEFAULT 'assigned',
      started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
      work_description TEXT, parts_used TEXT,
      cost_parts DOUBLE PRECISION DEFAULT 0, cost_labor DOUBLE PRECISION DEFAULT 0, total_cost DOUBLE PRECISION DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      engineer_id INTEGER REFERENCES engineers(id) ON DELETE SET NULL,
      item_type TEXT, item_name TEXT, quantity INTEGER,
      unit_price DOUBLE PRECISION, total_price DOUBLE PRECISION,
      sale_date TEXT, payment_method TEXT, paid BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      part_name TEXT NOT NULL, part_code TEXT, category TEXT,
      quantity INTEGER DEFAULT 0, reorder_level INTEGER DEFAULT 5,
      unit_cost DOUBLE PRECISION, unit_price DOUBLE PRECISION,
      supplier TEXT, supplier_phone TEXT, location TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
      amount DOUBLE PRECISION, payment_method TEXT,
      payment_status TEXT DEFAULT 'pending', paid_at TIMESTAMPTZ, due_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      engineer_id INTEGER PRIMARY KEY,
      fcm_token TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      engineer_id INTEGER,
      subscription TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS result_presets (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      sort INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS work_photos (
      id SERIAL PRIMARY KEY,
      reception_id INTEGER REFERENCES receptions(id) ON DELETE CASCADE,
      photo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_messages (
      id SERIAL PRIMARY KEY,
      reception_id INTEGER REFERENCES receptions(id) ON DELETE CASCADE,
      sender TEXT,
      text TEXT,
      photo TEXT,
      read_admin BOOLEAN DEFAULT FALSE,
      read_engineer BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      engineer_id INTEGER REFERENCES engineers(id) ON DELETE SET NULL,
      date TEXT,
      memo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS leave_requests (
      id SERIAL PRIMARY KEY,
      engineer_id INTEGER REFERENCES engineers(id) ON DELETE CASCADE,
      start_date TEXT,
      end_date TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // 결과 프리셋 기본값 시드 (비어있을 때만)
  const pc = await pool.query('SELECT count(*) FROM result_presets');
  if (Number(pc.rows[0].count) === 0) {
    const defaults = ['재부팅/정상화', '윈도우 재설치', '악성코드 제거', '부품 교체', '데이터 백업/복구', '네트워크 설정', '프린터 설정', '점검 완료'];
    for (let i = 0; i < defaults.length; i++) await pool.query('INSERT INTO result_presets (text, sort) VALUES ($1,$2)', [defaults[i], i]);
  }
  // 기존 테이블(옛 스키마) 대비 누락 컬럼 보강
  await pool.query(`
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS password TEXT;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle';
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS total_revenue DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS solution TEXT;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS reserved_date TEXT;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS customer_request TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_visit_parts TEXT;
  `);
  console.log('DB 초기화 완료');
}

// ============================================================
//  SSE 엔드포인트
// ============================================================
app.get('/api/admin-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  res.write(':connected\n\n');
  adminClients.add(res);
  const hb = setInterval(() => { try { res.write(':hb\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(hb); adminClients.delete(res); });
});

app.get('/api/engineer-stream/:id', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  res.write(':connected\n\n');
  engineerClients.set(String(req.params.id), res);
  const hb = setInterval(() => { try { res.write(':hb\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(hb); engineerClients.delete(String(req.params.id)); });
});

// ============================================================
//  고객 (customers)
// ============================================================
app.get('/api/customers', wrap(async (req, res) => {
  const { search } = req.query;
  let q = 'SELECT * FROM customers';
  const params = [];
  if (search) {
    q += ' WHERE name ILIKE $1 OR phone ILIKE $1 OR phone2 ILIKE $1 OR company_name ILIKE $1';
    params.push(`%${search}%`);
  }
  q += ' ORDER BY id';
  res.json((await pool.query(q, params)).rows);
}));

app.get('/api/customers/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM customers WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '고객 없음' });
  res.json(rows[0]);
}));

app.post('/api/customers', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO customers (name, customer_type, company_name, contact_person, phone, phone2, email, address, address_detail, memo, outstanding_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0) RETURNING *`,
    [b.name, b.customer_type || 'personal', b.company_name, b.contact_person, b.phone, b.phone2, b.email, b.address, b.address_detail, b.memo]
  );
  res.json(rows[0]);
}));

app.put('/api/customers/:id', wrap(async (req, res) => {
  const b = req.body;
  const fields = ['name', 'customer_type', 'company_name', 'contact_person', 'phone', 'phone2', 'email', 'address', 'address_detail', 'memo', 'outstanding_amount'];
  const sets = [], vals = [];
  fields.forEach(f => { if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f}=$${vals.length}`); } });
  if (!sets.length) { const { rows } = await pool.query('SELECT * FROM customers WHERE id=$1', [req.params.id]); return res.json(rows[0]); }
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE customers SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ error: '고객 없음' });
  res.json(rows[0]);
}));

app.delete('/api/customers/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/customers/:id/computers', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM computers WHERE customer_id=$1 ORDER BY id', [req.params.id])).rows);
}));

app.get('/api/customers/:id/receptions', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM receptions WHERE customer_id=$1 ORDER BY received_at DESC', [req.params.id])).rows);
}));

// ============================================================
//  컴퓨터/장비 (computers)
// ============================================================
const COMPUTER_FIELDS = ['customer_id', 'name', 'device_type', 'cpu', 'ram', 'ssd', 'hdd', 'motherboard', 'gpu', 'os', 'os_version', 'office_version', 'antivirus', 'ip_address', 'mac_address', 'serial_number', 'assembled', 'power', 'purchase_date', 'warranty_expiry', 'printer', 'monitor', 'nas_name', 'nas_model', 'nas_ip', 'nas_hdd_count', 'nas_hdd_detail', 'nas_total_capacity', 'nas_partition_info', 'nas_maintenance_period', 'nas_maintenance_notes', 'nas_admin_id', 'nas_admin_password', 'router_name', 'router_model', 'router_ip', 'router_admin_id', 'router_admin_password', 'notes'];

app.get('/api/computers', wrap(async (req, res) => {
  const { customer_id } = req.query;
  if (customer_id) return res.json((await pool.query('SELECT * FROM computers WHERE customer_id=$1 ORDER BY id', [customer_id])).rows);
  res.json((await pool.query('SELECT * FROM computers ORDER BY id')).rows);
}));

app.get('/api/computers/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM computers WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '장비 없음' });
  res.json(rows[0]);
}));

app.post('/api/computers', wrap(async (req, res) => {
  const b = req.body;
  const cols = COMPUTER_FIELDS.filter(f => b[f] !== undefined);
  const vals = cols.map(f => b[f]);
  const ph = cols.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(`INSERT INTO computers (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING *`, vals);
  res.json(rows[0]);
}));

app.put('/api/computers/:id', wrap(async (req, res) => {
  const b = req.body;
  const cols = COMPUTER_FIELDS.filter(f => b[f] !== undefined);
  const vals = cols.map(f => b[f]);
  const sets = cols.map((f, i) => `${f}=$${i + 1}`);
  if (!sets.length) { const { rows } = await pool.query('SELECT * FROM computers WHERE id=$1', [req.params.id]); return res.json(rows[0]); }
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE computers SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ error: '장비 없음' });
  res.json(rows[0]);
}));

app.delete('/api/computers/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM computers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  기사 (engineers)
// ============================================================
app.get('/api/engineers', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM engineers ORDER BY id')).rows);
}));

app.get('/api/engineers/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM engineers WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '기사 없음' });
  res.json(rows[0]);
}));

app.post('/api/engineers', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO engineers (name, phone, status, is_admin, password, total_jobs, total_revenue)
     VALUES ($1,$2,'idle',$3,$4,0,0) RETURNING *`,
    [b.name, b.phone, b.is_admin || false, b.password || null]
  );
  res.json(rows[0]);
}));

app.put('/api/engineers/:id/status', wrap(async (req, res) => {
  const { rows } = await pool.query('UPDATE engineers SET status=$1 WHERE id=$2 RETURNING *', [req.query.status || req.body.status, req.params.id]);
  broadcastAdmin('engineer_update', rows[0]);
  res.json(rows[0]);
}));

app.put('/api/engineers/:id/location', wrap(async (req, res) => {
  const { rows } = await pool.query('UPDATE engineers SET location=$1 WHERE id=$2 RETURNING *', [req.query.location || req.body.location, req.params.id]);
  res.json(rows[0]);
}));

app.delete('/api/engineers/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM engineers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  접수 (receptions)  — 배정 시 기사에게 푸시+SSE
// ============================================================
app.get('/api/receptions', wrap(async (req, res) => {
  const { status } = req.query;
  if (status) return res.json((await pool.query('SELECT * FROM receptions WHERE status=$1 ORDER BY received_at DESC', [status])).rows);
  res.json((await pool.query('SELECT * FROM receptions ORDER BY received_at DESC')).rows);
}));

app.get('/api/receptions/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM receptions WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  res.json(rows[0]);
}));

app.post('/api/receptions', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO receptions (customer_id, computer_id, reception_channel, reception_phone, symptom, initial_memo, status, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,'new',NOW()) RETURNING *`,
    [b.customer_id, b.computer_id || null, b.reception_channel, b.reception_phone, b.symptom, b.initial_memo]
  );
  broadcastAdmin('reception_new', rows[0]);
  res.json(rows[0]);
}));

app.put('/api/receptions/:id/assign', wrap(async (req, res) => {
  const engineerId = req.query.engineer_id || req.body.engineer_id;
  const { rows } = await pool.query(
    `UPDATE receptions SET assigned_engineer_id=$1, status='assigned', assigned_at=NOW() WHERE id=$2 RETURNING *`,
    [engineerId, req.params.id]
  );
  // jobs 생성 (이미 있으면 기사만 갱신 — 재배정 시 중복 방지)
  const existJob = await pool.query('SELECT id FROM jobs WHERE reception_id=$1', [req.params.id]);
  if (existJob.rows[0]) await pool.query('UPDATE jobs SET engineer_id=$1 WHERE reception_id=$2', [engineerId, req.params.id]);
  else await pool.query('INSERT INTO jobs (reception_id, engineer_id, status) VALUES ($1,$2,$3)', [req.params.id, engineerId, 'assigned']);
  const cust = await pool.query('SELECT name FROM customers WHERE id=$1', [rows[0].customer_id]);
  // 기사에게 알림
  await sendPushToEngineer(engineerId, '새 작업 배정', `${cust.rows[0]?.name || '고객'} - ${rows[0].symptom || ''}`);
  notifyEngineer(engineerId, 'new_assignment', rows[0]);
  broadcastAdmin('reception_update', rows[0]);
  res.json(rows[0]);
}));

app.put('/api/receptions/:id/status', wrap(async (req, res) => {
  const status = req.query.status || req.body.status;
  const extra = status === 'completed' ? ', completed_at=NOW()' : '';
  const { rows } = await pool.query(`UPDATE receptions SET status=$1${extra} WHERE id=$2 RETURNING *`, [status, req.params.id]);
  broadcastAdmin('reception_update', rows[0]);
  res.json(rows[0]);
}));

app.delete('/api/receptions/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM receptions WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  작업 이력 (jobs)
// ============================================================
app.get('/api/jobs', wrap(async (req, res) => {
  const { engineer_id, status } = req.query;
  const cond = [], params = [];
  if (engineer_id) { params.push(engineer_id); cond.push(`engineer_id=$${params.length}`); }
  if (status) { params.push(status); cond.push(`status=$${params.length}`); }
  const where = cond.length ? ' WHERE ' + cond.join(' AND ') : '';
  res.json((await pool.query('SELECT * FROM jobs' + where + ' ORDER BY id', params)).rows);
}));

app.get('/api/jobs/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM jobs WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '작업 없음' });
  res.json(rows[0]);
}));

app.put('/api/jobs/:id', wrap(async (req, res) => {
  const b = req.body;
  const fields = ['work_description', 'parts_used', 'cost_parts', 'cost_labor', 'total_cost', 'status'];
  const sets = [], vals = [];
  fields.forEach(f => { if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f}=$${vals.length}`); } });
  if (b.status === 'completed') sets.push('completed_at=NOW()');
  if (!sets.length) { const { rows } = await pool.query('SELECT * FROM jobs WHERE id=$1', [req.params.id]); return res.json(rows[0]); }
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  broadcastAdmin('job_update', rows[0]);
  res.json(rows[0]);
}));

// ============================================================
//  판매 (sales)
// ============================================================
app.get('/api/sales', wrap(async (req, res) => {
  const { paid } = req.query;
  if (paid !== undefined) return res.json((await pool.query('SELECT * FROM sales WHERE paid=$1 ORDER BY id', [paid === 'true'])).rows);
  res.json((await pool.query('SELECT * FROM sales ORDER BY id')).rows);
}));

app.post('/api/sales', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO sales (customer_id, engineer_id, item_type, item_name, quantity, unit_price, total_price, sale_date, payment_method, paid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE) RETURNING *`,
    [b.customer_id, b.engineer_id || null, b.item_type, b.item_name, b.quantity, b.unit_price, b.total_price, b.sale_date, b.payment_method]
  );
  res.json(rows[0]);
}));

app.put('/api/sales/:id/pay', wrap(async (req, res) => {
  const { rows } = await pool.query('UPDATE sales SET paid=TRUE WHERE id=$1 RETURNING *', [req.params.id]);
  res.json(rows[0]);
}));

app.delete('/api/sales/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM sales WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  재고 (inventory)
// ============================================================
const INV_FIELDS = ['part_name', 'part_code', 'category', 'quantity', 'reorder_level', 'unit_cost', 'unit_price', 'supplier', 'supplier_phone', 'location'];

app.get('/api/inventory', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM inventory ORDER BY id')).rows);
}));

app.post('/api/inventory', wrap(async (req, res) => {
  const b = req.body;
  const cols = INV_FIELDS.filter(f => b[f] !== undefined);
  const vals = cols.map(f => b[f]);
  const ph = cols.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(`INSERT INTO inventory (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING *`, vals);
  res.json(rows[0]);
}));

app.put('/api/inventory/:id', wrap(async (req, res) => {
  const b = req.body;
  const cols = INV_FIELDS.filter(f => b[f] !== undefined);
  const vals = cols.map(f => b[f]);
  const sets = cols.map((f, i) => `${f}=$${i + 1}`);
  if (!sets.length) { const { rows } = await pool.query('SELECT * FROM inventory WHERE id=$1', [req.params.id]); return res.json(rows[0]); }
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE inventory SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  res.json(rows[0]);
}));

app.delete('/api/inventory/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM inventory WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  결제 (payments)
// ============================================================
app.get('/api/payments', wrap(async (req, res) => {
  const { status } = req.query;
  if (status) return res.json((await pool.query('SELECT * FROM payments WHERE payment_status=$1 ORDER BY id', [status])).rows);
  res.json((await pool.query('SELECT * FROM payments ORDER BY id')).rows);
}));

app.post('/api/payments', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO payments (job_id, sale_id, amount, payment_method, payment_status, due_date)
     VALUES ($1,$2,$3,$4,'pending',$5) RETURNING *`,
    [b.job_id || null, b.sale_id || null, b.amount, b.payment_method, b.due_date || null]
  );
  res.json(rows[0]);
}));

app.put('/api/payments/:id/complete', wrap(async (req, res) => {
  const { rows } = await pool.query(`UPDATE payments SET payment_status='completed', paid_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
  res.json(rows[0]);
}));

// ============================================================
//  대시보드 / 통계
// ============================================================
app.get('/api/dashboard', wrap(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const receptions = (await pool.query('SELECT * FROM receptions')).rows;
  const customers = (await pool.query('SELECT id, outstanding_amount FROM customers')).rows;
  const inventory = (await pool.query('SELECT id, quantity, reorder_level FROM inventory')).rows;
  const engineers = (await pool.query('SELECT * FROM engineers ORDER BY id')).rows;
  const todayR = receptions.filter(r => (r.received_at || '').slice(0, 10) === today);
  res.json({
    today_new: todayR.filter(r => r.status === 'new').length,
    assigned_pending: receptions.filter(r => r.status === 'assigned').length,
    in_progress: receptions.filter(r => r.status === 'in_progress').length,
    completed_today: todayR.filter(r => r.status === 'completed').length,
    total_outstanding: customers.reduce((s, c) => s + (c.outstanding_amount || 0), 0),
    low_stock_count: inventory.filter(i => i.quantity <= i.reorder_level).length,
    engineers,
    pending_receptions: receptions.filter(r => ['new', 'assigned'].includes(r.status)),
  });
}));

app.get('/api/stats', wrap(async (req, res) => {
  const receptions = (await pool.query('SELECT * FROM receptions')).rows;
  const jobs = (await pool.query('SELECT * FROM jobs')).rows;
  const sales = (await pool.query('SELECT * FROM sales')).rows;
  const customers = (await pool.query('SELECT id, outstanding_amount FROM customers')).rows;
  const engineers = (await pool.query('SELECT * FROM engineers ORDER BY id')).rows;
  const inventory = (await pool.query('SELECT * FROM inventory')).rows;
  const completed = jobs.filter(j => j.status === 'completed');
  const repairRev = completed.reduce((s, j) => s + (j.total_cost || 0), 0);
  const salesRev = sales.filter(s => s.paid).reduce((s, x) => s + (x.total_price || 0), 0);
  const channelCounts = {};
  receptions.forEach(r => { const c = r.reception_channel || 'unknown'; channelCounts[c] = (channelCounts[c] || 0) + 1; });
  const engineerStats = engineers.map(e => {
    const ej = jobs.filter(j => j.engineer_id === e.id);
    return { id: e.id, name: e.name, total_jobs: ej.length, completed_jobs: ej.filter(j => j.status === 'completed').length, revenue: ej.filter(j => j.status === 'completed').reduce((s, j) => s + (j.total_cost || 0), 0) };
  });
  res.json({
    total_customers: customers.length,
    total_receptions: receptions.length,
    completed_jobs: completed.length,
    repair_revenue: repairRev,
    sales_revenue: salesRev,
    total_revenue: repairRev + salesRev,
    total_outstanding: customers.reduce((s, c) => s + (c.outstanding_amount || 0), 0),
    channel_counts: channelCounts,
    engineer_stats: engineerStats,
    inventory_low_stock: inventory.filter(i => i.quantity <= i.reorder_level),
  });
}));

// ============================================================
//  전화 수신 (CTI) — 메모리 임시 저장
// ============================================================
const incomingCalls = [];
let callCounter = 1;
const incomingSms = [];
let smsCounter = 1;

async function matchCustomer(phone) {
  const clean = digits(phone);
  const { rows } = await pool.query('SELECT * FROM customers');
  const matched = rows.find(c => digits(c.phone) === clean || digits(c.phone2) === clean) || null;
  let recent = [];
  if (matched) recent = (await pool.query('SELECT * FROM receptions WHERE customer_id=$1 ORDER BY received_at DESC LIMIT 3', [matched.id])).rows;
  return { matched, recent };
}

app.post('/api/incoming-call', wrap(async (req, res) => {
  const phone = req.query.phone || req.body.phone;
  const { matched, recent } = await matchCustomer(phone);
  const call = { id: callCounter++, phone: digits(phone), customer: matched, recent_receptions: recent, received_at: new Date().toISOString(), dismissed: false };
  incomingCalls.push(call);
  broadcastAdmin('incoming_call', call);
  // 대표 폰에 푸시 (백그라운드에서도 알림)
  sendPushToBosses('📞 전화 수신', (matched ? (matched.name || phone) : digits(phone)) + ' — 탭하여 등록', 'incoming_call');
  res.json(call);
}));

// 고객 조회 전용 (팝업 생성 안 함) — 폰 오버레이가 사용
app.get('/api/customer-lookup', wrap(async (req, res) => {
  const { matched, recent } = await matchCustomer(req.query.phone);
  res.json({ phone: digits(req.query.phone), customer: matched, recent_receptions: recent });
}));

app.get('/api/incoming-call/pending', wrap(async (req, res) => {
  res.json(incomingCalls.filter(c => !c.dismissed));
}));

app.delete('/api/incoming-call/:id', wrap(async (req, res) => {
  const c = incomingCalls.find(x => x.id == req.params.id);
  if (c) c.dismissed = true;
  res.json({ ok: true });
}));

// ============================================================
//  SMS 수신
// ============================================================
app.post('/api/incoming-sms', wrap(async (req, res) => {
  const b = req.body;
  const { matched, recent } = await matchCustomer(b.phone);
  const sms = { id: smsCounter++, phone: digits(b.phone), message: b.message, customer: matched, recent_receptions: recent, received_at: b.received_at || new Date().toISOString(), dismissed: false };
  incomingSms.push(sms);
  broadcastAdmin('incoming_sms', sms);
  sendPushToBosses('💬 SMS 수신', (matched ? (matched.name || sms.phone) : sms.phone) + ': ' + (b.message || '').slice(0, 30), 'incoming_sms');
  res.json(sms);
}));

app.get('/api/incoming-sms/pending', wrap(async (req, res) => {
  res.json(incomingSms.filter(s => !s.dismissed));
}));

app.delete('/api/incoming-sms/:id', wrap(async (req, res) => {
  const s = incomingSms.find(x => x.id == req.params.id);
  if (s) s.dismissed = true;
  res.json({ ok: true });
}));

// ============================================================
//  FCM 토큰 등록 (기사앱)
// ============================================================
app.post('/api/fcm-token', wrap(async (req, res) => {
  const { engineer_id, fcm_token } = req.body;
  await pool.query(
    `INSERT INTO fcm_tokens (engineer_id, fcm_token, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (engineer_id) DO UPDATE SET fcm_token=$2, updated_at=NOW()`,
    [engineer_id, fcm_token]
  );
  res.json({ ok: true });
}));

app.post('/api/push-subscribe', wrap(async (req, res) => {
  const { engineer_id, subscription } = req.body;
  await pool.query('INSERT INTO push_subscriptions (engineer_id, subscription) VALUES ($1,$2)', [engineer_id, JSON.stringify(subscription)]);
  res.json({ ok: true });
}));

// ============================================================
//  작업 사진 (수리 전/후) — base64, 20일 후 자동정리
// ============================================================
app.get('/api/receptions/:id/photos', wrap(async (req, res) => {
  res.json((await pool.query('SELECT id, photo, created_at FROM work_photos WHERE reception_id=$1 ORDER BY id', [req.params.id])).rows);
}));
app.post('/api/receptions/:id/photos', wrap(async (req, res) => {
  const { rows } = await pool.query('INSERT INTO work_photos (reception_id, photo) VALUES ($1,$2) RETURNING id', [req.params.id, req.body.photo]);
  res.json({ id: rows[0].id });
}));
app.delete('/api/work-photos/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM work_photos WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));
async function cleanupOldPhotos() {
  try {
    const r = await pool.query("DELETE FROM work_photos WHERE created_at < NOW() - INTERVAL '20 days'");
    if (r.rowCount) console.log('오래된 작업사진 정리:', r.rowCount);
  } catch (e) {}
}

// ============================================================
//  일정 (예약)
// ============================================================
app.get('/api/schedules', wrap(async (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (month) return res.json((await pool.query("SELECT * FROM schedules WHERE date LIKE $1 ORDER BY date, id", [month + '%'])).rows);
  res.json((await pool.query('SELECT * FROM schedules ORDER BY date, id')).rows);
}));
app.post('/api/schedules', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query('INSERT INTO schedules (title, engineer_id, date, memo) VALUES ($1,$2,$3,$4) RETURNING *', [b.title, b.engineer_id || null, b.date, b.memo || null]);
  broadcastAdmin('schedule_update', rows[0]);
  res.json(rows[0]);
}));
app.delete('/api/schedules/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM schedules WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  휴가 신청/승인
// ============================================================
app.get('/api/leave-requests', wrap(async (req, res) => {
  const { engineer_id } = req.query;
  if (engineer_id) return res.json((await pool.query('SELECT * FROM leave_requests WHERE engineer_id=$1 ORDER BY id DESC', [engineer_id])).rows);
  res.json((await pool.query('SELECT lr.*, e.name AS engineer_name FROM leave_requests lr LEFT JOIN engineers e ON e.id=lr.engineer_id ORDER BY lr.id DESC')).rows);
}));
app.post('/api/leave-requests', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query('INSERT INTO leave_requests (engineer_id, start_date, end_date, reason, status) VALUES ($1,$2,$3,$4,$5) RETURNING *', [b.engineer_id, b.start_date, b.end_date, b.reason || null, 'pending']);
  broadcastAdmin('leave_update', rows[0]);
  res.json(rows[0]);
}));
app.put('/api/leave-requests/:id/status', wrap(async (req, res) => {
  const status = req.query.status || req.body.status;
  const { rows } = await pool.query('UPDATE leave_requests SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
  if (rows[0] && rows[0].engineer_id) notifyEngineer(rows[0].engineer_id, 'leave_result', rows[0]);
  res.json(rows[0]);
}));

// ============================================================
//  작업별 채팅 (기사 ↔ 관리자)
// ============================================================
app.get('/api/receptions/:id/messages', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM order_messages WHERE reception_id=$1 ORDER BY id', [req.params.id])).rows);
}));
app.post('/api/receptions/:id/messages', wrap(async (req, res) => {
  const { sender, text, photo } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO order_messages (reception_id, sender, text, photo, read_admin, read_engineer)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.id, sender, text || '', photo || null, sender === 'admin', sender === 'engineer']
  );
  const rec = await pool.query('SELECT assigned_engineer_id FROM receptions WHERE id=$1', [req.params.id]);
  const engId = rec.rows[0] && rec.rows[0].assigned_engineer_id;
  if (sender === 'engineer') {
    broadcastAdmin('new_message', { reception_id: Number(req.params.id) });
  } else {
    if (engId) { notifyEngineer(engId, 'new_message', { reception_id: Number(req.params.id) }); sendPushToEngineer(engId, '새 메시지', text || '사진'); }
  }
  res.json(rows[0]);
}));
app.post('/api/receptions/:id/messages/read', wrap(async (req, res) => {
  const side = req.query.side || req.body.side;
  const col = side === 'admin' ? 'read_admin' : 'read_engineer';
  await pool.query(`UPDATE order_messages SET ${col}=TRUE WHERE reception_id=$1`, [req.params.id]);
  res.json({ ok: true });
}));
app.get('/api/messages/unread-admin', wrap(async (req, res) => {
  const { rows } = await pool.query("SELECT reception_id, count(*)::int AS cnt FROM order_messages WHERE sender='engineer' AND read_admin=FALSE GROUP BY reception_id");
  const map = {}; rows.forEach(r => map[r.reception_id] = r.cnt); res.json(map);
}));
app.get('/api/messages/unread-engineer/:engId', wrap(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT m.reception_id, count(*)::int AS cnt FROM order_messages m JOIN receptions r ON r.id=m.reception_id WHERE m.sender='admin' AND m.read_engineer=FALSE AND r.assigned_engineer_id=$1 GROUP BY m.reception_id",
    [req.params.engId]
  );
  const map = {}; rows.forEach(r => map[r.reception_id] = r.cnt); res.json(map);
}));

// ============================================================
//  결과 프리셋 (완료 입력 빠르게)
// ============================================================
app.get('/api/result-presets', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM result_presets ORDER BY sort, id')).rows);
}));
app.post('/api/result-presets', wrap(async (req, res) => {
  const { rows } = await pool.query('INSERT INTO result_presets (text, sort) VALUES ($1, (SELECT COALESCE(MAX(sort),0)+1 FROM result_presets)) RETURNING *', [req.body.text]);
  res.json(rows[0]);
}));
app.delete('/api/result-presets/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM result_presets WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  기사앱 전용 API
// ============================================================
// 기사 로그인 (이름 선택 / 대표는 비번 확인)
app.post('/api/engineer-login', wrap(async (req, res) => {
  const { engineer_id, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM engineers WHERE id=$1', [engineer_id]);
  const e = rows[0];
  if (!e) return res.status(404).json({ error: '기사 없음' });
  if (e.is_admin && e.password && e.password !== password) return res.status(401).json({ error: '비밀번호 오류' });
  res.json({ id: e.id, name: e.name, is_admin: e.is_admin });
}));

// 기사의 배정 작업 (고객정보 조인). 대표(all=1)는 전체
app.get('/api/engineer/:id/receptions', wrap(async (req, res) => {
  const all = req.query.all === '1';
  const params = all ? [] : [req.params.id];
  const where = all ? '' : 'WHERE r.assigned_engineer_id=$1';
  const { rows } = await pool.query(`
    SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
           c.company_name AS customer_company,
           j.id AS job_id, j.work_description, j.parts_used, j.cost_parts, j.cost_labor, j.total_cost, j.next_visit_parts
    FROM receptions r
    LEFT JOIN customers c ON c.id=r.customer_id
    LEFT JOIN jobs j ON j.reception_id=r.id
    ${where}
    ORDER BY r.received_at DESC`, params);
  res.json(rows);
}));

// 작업 시작
app.put('/api/engineer/receptions/:id/start', wrap(async (req, res) => {
  const { rows } = await pool.query(`UPDATE receptions SET status='in_progress' WHERE id=$1 RETURNING *`, [req.params.id]);
  await pool.query(`UPDATE jobs SET status='in_progress', started_at=NOW() WHERE reception_id=$1`, [req.params.id]);
  broadcastAdmin('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 작업 완료 (결과 입력) → 접수+작업+기사실적 갱신, 관리자 실시간 알림
app.put('/api/engineer/receptions/:id/complete', wrap(async (req, res) => {
  const b = req.body;
  const total = (Number(b.cost_parts) || 0) + (Number(b.cost_labor) || 0);
  const { rows } = await pool.query(`UPDATE receptions SET status='completed', completed_at=NOW(), solution=$2, customer_request=$3, reserved_date=NULL WHERE id=$1 RETURNING *`, [req.params.id, b.work_description || '', b.customer_request || null]);
  await pool.query(
    `UPDATE jobs SET status='completed', completed_at=NOW(), work_description=$2, parts_used=$3, cost_parts=$4, cost_labor=$5, total_cost=$6, next_visit_parts=$7 WHERE reception_id=$1`,
    [req.params.id, b.work_description || '', b.parts_used || '', Number(b.cost_parts) || 0, Number(b.cost_labor) || 0, total, b.next_visit_parts || null]
  );
  const eng = rows[0].assigned_engineer_id;
  if (eng) await pool.query('UPDATE engineers SET total_jobs=total_jobs+1, total_revenue=total_revenue+$2 WHERE id=$1', [eng, total]);
  broadcastAdmin('job_update', { reception_id: req.params.id, total_cost: total });
  res.json(rows[0]);
}));

// 미처리(예약) — 예약일 지정, 작업 유지
app.put('/api/engineer/receptions/:id/reserve', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(`UPDATE receptions SET reserved_date=$2, status='assigned', customer_request=$3 WHERE id=$1 RETURNING *`, [req.params.id, b.reserved_date || null, b.customer_request || null]);
  await pool.query(`UPDATE jobs SET work_description=$2, parts_used=$3, next_visit_parts=$4 WHERE reception_id=$1`, [req.params.id, b.work_description || '', b.parts_used || '', b.next_visit_parts || null]);
  broadcastAdmin('reception_update', rows[0]);
  res.json(rows[0]);
}));

// ============================================================
//  SPA 폴백 + 서버 시작
// ============================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../admin/index.html')));

initDB()
  .then(() => { cleanupOldPhotos(); setInterval(cleanupOldPhotos, 24 * 60 * 60 * 1000); })
  .then(() => app.listen(PORT, () => console.log(`CSEP 서버 실행: http://localhost:${PORT}`)))
  .catch(e => { console.error('DB 초기화 실패:', e.message); app.listen(PORT, () => console.log(`CSEP 서버 실행(DB오류): http://localhost:${PORT}`)); });
