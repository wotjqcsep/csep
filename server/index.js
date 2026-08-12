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

// ── 비밀번호 해시 (Node 내장 crypto, 외부 패키지 불필요) ──
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(pw, stored) {
  if (!stored) return false;
  if (!stored.includes(':')) return pw === stored; // plain-text legacy
  const [salt, hash] = stored.split(':');
  return crypto.scryptSync(pw, salt, 64).toString('hex') === hash;
}

// ── 로그인 세션 저장소 (메모리) ──
const sessions = new Map();

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
// 관리자(PC) 정적파일: HTML/JS/CSS는 캐시 금지 → 배포 즉시 최신 코드 로드 (옛/새 JS 섞임 방지)
app.use(express.static(path.join(__dirname, '../admin'), {
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-store');
  },
}));
// engineer HTML은 캐시 금지 (기사앱 APK 웹뷰가 항상 최신 코드 로드)
app.use('/engineer', express.static(path.join(__dirname, '../engineer'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  },
}));

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
  console.error(req.method, req.path, e);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

// ============================================================
//  SSE (실시간)
// ============================================================
const adminClients = new Set();          // 관리자 SSE 연결
const engineerClients = new Map();        // engineer_id → Set<res> (다중 연결 지원)

function addEngineerClient(id, res) {
  const key = String(id);
  if (!engineerClients.has(key)) engineerClients.set(key, new Set());
  engineerClients.get(key).add(res);
}
function removeEngineerClient(id, res) {
  const key = String(id);
  const s = engineerClients.get(key);
  if (s) { s.delete(res); if (s.size === 0) engineerClients.delete(key); }
}

function notifyEngineer(engineerId, event, data) {
  const s = engineerClients.get(String(engineerId));
  if (!s) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  s.forEach(res => { try { res.write(msg); } catch (e) { s.delete(res); } });
}

function broadcastAdmin(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  adminClients.forEach(res => { try { res.write(msg); } catch (e) { adminClients.delete(res); } });
}

// 접속된 모든 기사(대표 포함)에게 실시간 이벤트 → 접수 목록 동기화
function broadcastEngineers(event, data) {
  const minimal = { id: data.id || data.reception_id };
  const msg = `event: ${event}\ndata: ${JSON.stringify(minimal)}\n\n`;
  engineerClients.forEach((clients, id) => {
    clients.forEach(res => { try { res.write(msg); } catch (e) { clients.delete(res); } });
  });
}

// 접수 변경을 PC·기사앱 모두에 동시 반영
function broadcastReception(event, data) {
  broadcastAdmin(event, data);
  broadcastEngineers(event, data);
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
      // data-only → 앱의 MyFCMService가 커스텀 소리 재생 + 무음 알림 (필드서비스 동일)
      await fcmSend(fcm.rows[0].fcm_token, {
        token: fcm.rows[0].fcm_token,
        data: { title: String(title), body: String(body), type: 'engineer' },
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
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      address TEXT,
      address_detail TEXT,
      status TEXT DEFAULT 'active',
      memo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS part_options (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      grp TEXT DEFAULT '',
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS estimates (
      id SERIAL PRIMARY KEY,
      no TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      phone TEXT,
      company TEXT,
      contact TEXT,
      est_date TEXT,
      memo TEXT,
      items JSONB,
      opts JSONB,
      subtotal DOUBLE PRECISION DEFAULT 0,
      vat DOUBLE PRECISION DEFAULT 0,
      total DOUBLE PRECISION DEFAULT 0,
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
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS login_fail_count INTEGER DEFAULT 0;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle';
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0;
    ALTER TABLE engineers ADD COLUMN IF NOT EXISTS total_revenue DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS solution TEXT;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS reserved_date TEXT;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS customer_request TEXT;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS labor_fee DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS parts_fee DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS payment_method TEXT;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS tax_invoice BOOLEAN DEFAULT FALSE;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS woori_settled BOOLEAN DEFAULT FALSE;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS estimate_amount DOUBLE PRECISION;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS visit_fee DOUBLE PRECISION;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS picked_up BOOLEAN DEFAULT FALSE;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS outcome TEXT;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS estimate_id INTEGER;
    ALTER TABLE receptions ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
    ALTER TABLE estimates ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT FALSE;
    ALTER TABLE estimates ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
    ALTER TABLE estimates ADD COLUMN IF NOT EXISTS field_discount DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE estimates ADD COLUMN IF NOT EXISTS final_amount DOUBLE PRECISION;
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_invoice BOOLEAN DEFAULT FALSE;
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS woori_settled BOOLEAN DEFAULT FALSE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_visit_parts TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS cad TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS adobe TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS etc_program1 TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS etc_program2 TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS printer_model TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS printer_ip TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS router_hub_count TEXT;
    ALTER TABLE computers ADD COLUMN IF NOT EXISTS bios_version TEXT;
  `);
  console.log('DB 초기화 완료');
}

// ============================================================
//  로그인 (인증 미들웨어보다 먼저 등록 — 보호 대상 제외)
// ============================================================
// 관리자(PC) 로그인 — DB settings 또는 환경변수 비밀번호
app.post('/api/admin-login', express.json(), wrap(async (req, res) => {
  const { password } = req.body;
  const dbRow = (await pool.query("SELECT value FROM settings WHERE key='admin_password'")).rows[0];
  const adminPw = dbRow ? dbRow.value : (process.env.ADMIN_PASSWORD || 'csep2026!');
  if (adminPw && adminPw.length > 0 && password !== adminPw) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다' });
  const token = crypto.randomUUID();
  sessions.set(token, { role: 'admin', expires: Date.now() + 24 * 60 * 60 * 1000 });
  res.json({ token });
}));

// 관리자 비밀번호 조회 (공란 여부 확인용)
app.get('/api/admin-password-status', wrap(async (req, res) => {
  const dbRow = (await pool.query("SELECT value FROM settings WHERE key='admin_password'")).rows[0];
  const pw = dbRow ? dbRow.value : (process.env.ADMIN_PASSWORD || 'csep2026!');
  res.json({ hasPassword: !!(pw && pw.length > 0) });
}));

// 기사 로그인 (이름 선택 / 대표는 비번 확인)
app.post('/api/engineer-login', wrap(async (req, res) => {
  const { engineer_id, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM engineers WHERE id=$1', [engineer_id]);
  const e = rows[0];
  if (!e) return res.status(404).json({ error: '기사 없음' });
  if (e.locked) return res.status(423).json({ error: '계정이 잠겼습니다. 관리자(CSEP)에게 문의하세요.', locked: true });
  const hasPw = !!(e.password && String(e.password).length);
  if (hasPw && !verifyPassword(password, e.password)) {
    const cnt = (e.login_fail_count || 0) + 1;
    const lock = cnt >= 3;
    await pool.query('UPDATE engineers SET login_fail_count=$1, locked=$2 WHERE id=$3', [cnt, lock, e.id]);
    if (lock) return res.status(423).json({ error: '비밀번호 3회 오류로 계정이 잠겼습니다. 관리자(CSEP)에게 문의하세요.', locked: true });
    return res.status(401).json({ error: `비밀번호 오류 (남은 시도 ${3 - cnt}회)` });
  }
  if (hasPw && e.login_fail_count) await pool.query('UPDATE engineers SET login_fail_count=0 WHERE id=$1', [e.id]);
  // 평문 비밀번호로 로그인 성공 시 해시로 자동 업그레이드
  if (e.password && !e.password.includes(':')) {
    pool.query('UPDATE engineers SET password=$2 WHERE id=$1', [e.id, hashPassword(password)]).catch(err => console.error(err));
  }
  const token = crypto.randomUUID();
  sessions.set(token, { role: 'engineer', engineerId: e.id, expires: Date.now() + 24 * 60 * 60 * 1000 });
  res.json({ id: e.id, name: e.name, is_admin: e.is_admin, token });
}));

// ============================================================
//  인증 미들웨어 — 이후의 모든 /api 라우트(SSE 스트림 포함) 보호
// ============================================================
app.use('/api', (req, res, next) => {
  // 로그인 엔드포인트는 인증 없이 허용
  if (req.path === '/admin-login' || req.path === '/engineer-login' || req.path === '/admin-password-status' || (req.method === 'GET' && req.path === '/engineers')) return next();
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  session.expires = Date.now() + 24 * 60 * 60 * 1000; // 만료시간 갱신
  req.user = session;
  next();
});

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
  addEngineerClient(req.params.id, res);
  const hb = setInterval(() => { try { res.write(':hb\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(hb); removeEngineerClient(req.params.id, res); });
});

// ============================================================
//  고객 (customers)
// ============================================================
app.get('/api/customers', wrap(async (req, res) => {
  const { search } = req.query;
  let q = 'SELECT * FROM customers';
  const params = [];
  if (search) {
    q += ' WHERE name ILIKE $1 OR phone ILIKE $1 OR phone2 ILIKE $1 OR company_name ILIKE $1 OR address ILIKE $1';
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
//  견적서 저장 (estimates) — 저장/검색/불러오기 + 거래처 자동 등록
// ============================================================
app.get('/api/estimates', wrap(async (req, res) => {
  const q = String((req.query.q || '')).trim();
  let sql = 'SELECT id,no,customer_id,customer_name,phone,company,est_date,total,delivered,field_discount,final_amount,created_at FROM estimates';
  const params = [];
  if (q) { sql += ' WHERE customer_name ILIKE $1 OR phone ILIKE $1 OR no ILIKE $1 OR company ILIKE $1'; params.push('%' + q + '%'); }
  sql += ' ORDER BY id DESC LIMIT 300';
  res.json((await pool.query(sql, params)).rows);
}));
app.get('/api/customers/:id/estimates', wrap(async (req, res) => {
  res.json((await pool.query('SELECT id,no,customer_name,phone,est_date,total,created_at FROM estimates WHERE customer_id=$1 ORDER BY id DESC', [req.params.id])).rows);
}));
app.get('/api/estimates/:id', wrap(async (req, res) => {
  const r = await pool.query('SELECT * FROM estimates WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });
  res.json(r.rows[0]);
}));
app.post('/api/estimates', wrap(async (req, res) => {
  const b = req.body || {};
  const cname = String(b.customer_name || '').trim(), phone = String(b.phone || '').trim();
  // 거래처 자동 연결/등록: id 없으면 연락처→이름 순 매칭, 그래도 없으면 신규 등록
  let customerId = b.customer_id || null, customerCreated = false;
  if (!customerId && (cname || phone)) {
    let match = null;
    if (phone) match = (await pool.query('SELECT id FROM customers WHERE phone=$1 LIMIT 1', [phone])).rows[0];
    if (!match && cname) match = (await pool.query('SELECT id FROM customers WHERE name=$1 LIMIT 1', [cname])).rows[0];
    if (match) customerId = match.id;
    else { const ins = await pool.query('INSERT INTO customers (name, phone) VALUES ($1,$2) RETURNING id', [cname || phone, phone]); customerId = ins.rows[0].id; customerCreated = true; }
  }
  const items = Array.isArray(b.items) ? b.items : [];
  const row = await pool.query(
    `INSERT INTO estimates (no,customer_id,customer_name,phone,company,contact,est_date,memo,items,opts,subtotal,vat,total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [b.no || '', customerId, cname, phone, b.company || '', b.contact || '', b.est_date || '', b.memo || '',
     JSON.stringify(items), JSON.stringify(b.opts || {}), Number(b.subtotal) || 0, Number(b.vat) || 0, Number(b.total) || 0]);
  res.json({ ...row.rows[0], customer_created: customerCreated });
}));
app.delete('/api/estimates/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM estimates WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  현장 (sites) — 거래처(고객)에 딸린 지점/설치장소
// ============================================================
app.get('/api/sites', wrap(async (req, res) => {
  const { customer_id } = req.query;
  if (customer_id) return res.json((await pool.query('SELECT * FROM sites WHERE customer_id=$1 ORDER BY id', [customer_id])).rows);
  res.json((await pool.query('SELECT * FROM sites ORDER BY id')).rows);
}));

app.post('/api/sites', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO sites (customer_id, name, contact_person, phone, address, address_detail, status, memo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [b.customer_id, b.name, b.contact_person, b.phone, b.address, b.address_detail, b.status || 'active', b.memo]
  );
  res.json(rows[0]);
}));

app.put('/api/sites/:id', wrap(async (req, res) => {
  const b = req.body;
  const fields = ['name', 'contact_person', 'phone', 'address', 'address_detail', 'status', 'memo'];
  const sets = [], vals = [];
  fields.forEach(f => { if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f}=$${vals.length}`); } });
  if (!sets.length) { const { rows } = await pool.query('SELECT * FROM sites WHERE id=$1', [req.params.id]); return res.json(rows[0]); }
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE sites SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ error: '현장 없음' });
  res.json(rows[0]);
}));

app.delete('/api/sites/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM sites WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  부품 옵션 (part_options) — 드롭다운 수동 추가 데이터
// ============================================================
app.get('/api/part-options', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM part_options ORDER BY id')).rows);
}));
app.post('/api/part-options', wrap(async (req, res) => {
  const b = req.body;
  if (!b.kind || !b.value) return res.status(400).json({ error: 'kind, value 필수' });
  const { rows } = await pool.query(
    'INSERT INTO part_options (kind, grp, value) VALUES ($1,$2,$3) RETURNING *',
    [b.kind, b.grp || '', b.value]
  );
  res.json(rows[0]);
}));
app.delete('/api/part-options/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM part_options WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  컴퓨터/장비 (computers)
// ============================================================
const COMPUTER_FIELDS = ['customer_id', 'name', 'device_type', 'cpu', 'ram', 'ssd', 'hdd', 'motherboard', 'gpu', 'os', 'os_version', 'office_version', 'antivirus', 'ip_address', 'mac_address', 'serial_number', 'assembled', 'power', 'purchase_date', 'warranty_expiry', 'printer', 'monitor', 'nas_name', 'nas_model', 'nas_ip', 'nas_hdd_count', 'nas_hdd_detail', 'nas_total_capacity', 'nas_partition_info', 'nas_maintenance_period', 'nas_maintenance_notes', 'nas_admin_id', 'nas_admin_password', 'router_name', 'router_model', 'router_ip', 'router_admin_id', 'router_admin_password', 'notes', 'cad', 'adobe', 'etc_program1', 'etc_program2', 'printer_model', 'printer_ip', 'router_hub_count', 'bios_version'];

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

// BIOS 화면 사진 → 장치정보 자동추출 (Cloud Vision OCR 전용, 무료).
// env: GOOGLE_VISION_API_KEY (또는 GOOGLE_API_KEY). 키 없으면 503.
// OCR로 읽은 글자를 서버에서 규칙기반으로 파싱 → CPU/RAM/메인보드/시리얼 추정.
function parseBiosText(text) {
  const out = { name: '', device_type: 'desktop', cpu: '', gpu: '', serial_number: '', bios_version: '',
    motherboard: { plat: '', maker: '', chipset: '', model: '' }, ram: [], ssd: [], hdd: [] };
  if (!text) return out;
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const joined = lines.join('\n');
  // ── CPU (OCR가 i를 1/l로 오독하는 것 허용, 'Core' 문맥 우선) ──
  const ry = joined.match(/Ryzen\s*(?:Threadripper\s*)?[3579]\s*\d{3,4}[A-Z0-9]{0,3}/i);
  const ci = joined.match(/Core[^\n]{0,10}?\b[il1]?([3579])[\s-]?(\d{4,5})([A-Z]{0,2})\b/i)
    || joined.match(/\bi([3579])[\s-]?(\d{4,5})([A-Z]{0,2})\b/i);
  const xe = joined.match(/Xeon[\w-]*\s*[\w-]*\d{3,4}[A-Z0-9]{0,3}/i);
  const pc = joined.match(/\b(?:Pentium|Celeron|Athlon)[\w\s-]*?\d{2,5}[A-Z0-9]{0,3}\b/i);
  if (ry) { out.cpu = 'AMD ' + ry[0].replace(/\s+/g, ' ').trim(); out.motherboard.plat = 'AMD'; }
  else if (ci) { out.cpu = 'Intel Core i' + ci[1] + '-' + ci[2] + (ci[3] || ''); out.motherboard.plat = 'Intel'; }
  else if (xe) { out.cpu = 'Intel ' + xe[0].replace(/\s+/g, ' ').trim(); out.motherboard.plat = 'Intel'; }
  else if (pc) { out.cpu = pc[0].replace(/\s+/g, ' ').trim(); }
  // CPU 폴백: 모델번호 없는 구형(Pentium 4/D, Core 2 등)은 'Processor Type/CPU Type' 줄에서 추출
  if (!out.cpu) {
    const pl = lines.find(l => /(Processor\s*Type|CPU\s*Type|Processor\s*Name)/i.test(l));
    if (pl) {
      let c = pl.replace(/.*?(Processor\s*Type|CPU\s*Type|Processor\s*Name)\s*[:：]?\s*/i, '')
        .replace(/\(R\)|\(TM\)/gi, '').replace(/\bCPU\b/gi, '').replace(/@[^\n]*$/, '')
        .replace(/\s+/g, ' ').trim();
      if (c) out.cpu = c;
    }
  }
  if (!out.motherboard.plat) {
    if (/\bAMD\b|Ryzen|Athlon/i.test(joined)) out.motherboard.plat = 'AMD';
    else if (/\bIntel\b|Xeon|Pentium|Celeron/i.test(joined)) out.motherboard.plat = 'Intel';
  }
  // ── 메인보드 ──
  const brand = joined.match(/\b(ASUS|ASRock|GIGABYTE|MSI|BIOSTAR|SuperMicro|ECS|Foxconn|COLORFUL)\b/i);
  if (brand) out.motherboard.maker = brand[1].toUpperCase() === 'ASUS' ? 'ASUS' : brand[1];
  else if (/\b(PRIME|ROG|TUF|STRIX|PROART)\b/i.test(joined)) out.motherboard.maker = 'ASUS';
  else if (/\bIntel\s+Corporation\b/i.test(joined)) out.motherboard.maker = 'Intel';
  const modelM = joined.match(/\b(ROG\s*STRIX|TUF(?:\s*GAMING)?|PRIME|STRIX|PROART|AORUS|MPG|MAG|MORTAR|TOMAHAWK)\s+([A-Z]?\d{2,3}[A-Z0-9-]*)/i);
  if (modelM) out.motherboard.model = modelM[0].replace(/\s+/g, ' ').trim();
  const chM = joined.match(/\b([ABHXZ]\d{2,3})[A-Z]?\b/);
  if (chM) out.motherboard.chipset = chM[1];
  // ── BIOS 버전 (+ 보드명이 섞인 경우 분리) ──
  // 예1) "PRIME Z390-A BIOS Ver. 1201" → 1201
  // 예2) "BIOS Version : 775XFire-eSATA2 BIOS P1.00" → 버전 P1.00, 보드모델 775XFire-eSATA2
  const bvLine = lines.find(l => /BIOS\s*Ver/i.test(l)) || '';
  if (bvLine) {
    const bvVal = bvLine.replace(/.*?BIOS\s*Ver(?:sion)?\.?\s*[:：]?\s*/i, '');
    const inner = bvVal.match(/BIOS\s+([A-Za-z]?\d[\w.\/-]*)/i);   // "... BIOS P1.00"
    if (inner) {
      out.bios_version = inner[1];
      const pre = bvVal.slice(0, bvVal.search(/\s*BIOS\s+/i)).replace(/\s+/g, ' ').trim();   // 보드명
      if (pre && pre.length <= 30 && !out.motherboard.model) out.motherboard.model = pre;
    } else {
      const t = bvVal.match(/([A-Za-z0-9][A-Za-z0-9.\-]{1,15})/);
      if (t) out.bios_version = t[1];
    }
  }
  // ── GPU (BIOS엔 드묾, CPU-Z/시스템정보용) ──
  const gpuM = joined.match(/((?:NVIDIA\s*)?GeForce\s*(?:RTX|GTX)?\s*\d{3,4}\s*(?:Ti|SUPER)?|Radeon\s*(?:RX)?\s*\d{3,4}\s*[A-Z]{0,3}|Intel\s*(?:UHD|Iris|HD)\s*Graphics\s*\d{0,4}|Quadro\s*[\w-]+)/i);
  if (gpuM) out.gpu = gpuM[0].replace(/\s+/g, ' ').trim();
  // ── 시리얼 ──
  const snM = joined.match(/(?:Serial\s*(?:Number|No\.?|#)?|S\/N)\s*[:：]?\s*([A-Za-z0-9\-]{5,})/i);
  if (snM) out.serial_number = snM[1];
  // ── RAM: 라인 단위 통합 파싱 (DDR2~5, DDRII 로마표기, 슬롯라벨/값토큰/2열 레이아웃) ──
  // DDR 세대 정규화(DDRII→2, DDRIII→3, DDR2~5). fmtGB: 512MB→0.5, 4096MB→4
  const ddrGenOf = s => { const r = (s || '').match(/DDR\s*(III|II|IV|V|[2-5])/i); if (!r) return ''; const t = r[1].toUpperCase(); return ({ II: '2', III: '3', IV: '4', V: '5' })[t] || t; };
  const fmtGB = mb => { const g = mb / 1024; return Number.isInteger(g) ? String(g) : String(Math.round(g * 10) / 10); };
  const globalGen = ddrGenOf(joined);
  const ramList = [];
  for (const l of lines) {
    if (/(total|system|installed)\s+memory/i.test(l) || /^memory\s*[:：]/i.test(l)) continue;   // 총합/요약 제외
    const mbm = l.match(/(\d{3,6})\s*MB/i);
    if (!mbm) continue;
    // 모듈 라인 조건: 슬롯 라벨(DIMM/DDRn/Slot/Channel)로 시작 OR 값에 (DDR..) 포함
    const isModule = /^(?:DIMM|DDR(?:II|III|IV|V|[2-5])?\s*\d|Slot|Channel)/i.test(l) || /\(\s*DDR/i.test(l);
    if (!isModule) continue;
    const g = ddrGenOf(l) || globalGen;
    // 속도: (DDRnnnn)의 숫자 우선, 없으면 MHz
    const spd = (l.match(/DDR\S*?(\d{3,5})/i) || [])[1] || (l.match(/(\d{3,5})\s*MHz/i) || [])[1] || '';
    // 제조사: 용량(NNNMB) 바로 앞 단어 — 단, 슬롯/규격 키워드는 제외
    let maker = (l.match(/([A-Za-z][A-Za-z0-9.]{2,})\s*\d{3,6}\s*MB/i) || [])[1] || '';
    if (/^(DIMM|DDR|Slot|Channel|Memory|Dual|Single|Type)/i.test(maker)) maker = '';
    ramList.push({ size: fmtGB(parseInt(mbm[1], 10)), spec: (g ? 'DDR' + g : '') + (spd ? '-' + spd : ''), maker });
  }
  if (ramList.length) out.ram = ramList;
  else {   // 슬롯이 안 보이면 총합 요약 1개
    const mbM = joined.match(/(?:Total\s*Memory|System\s*Memory|Installed\s*Memory|Memory)\s*[:：]?\s*(\d{3,6})\s*MB/i);
    const ramSize = mbM ? fmtGB(parseInt(mbM[1], 10)) : '';
    const ddrSpd = joined.match(/DDR[2-5][\s-]*(\d{3,5})/i);
    const spec = globalGen ? ('DDR' + globalGen + (ddrSpd ? '-' + ddrSpd[1] : '')) : '';
    if (ramSize || spec) out.ram.push({ size: ramSize, spec, maker: '' });
  }
  // ── 저장장치(SSD/HDD): 드라이브처럼 보이는 라인만, USB/중복 제외 ──
  const seen = new Set();
  for (const l of lines) {
    if (/USB\s*Flash|Flash\s*Drive|\bUFD\b/i.test(l)) continue;
    const capM = l.match(/(\d{2,5}(?:\.\d+)?)\s*GB/i) || l.match(/(\d{1,2}(?:\.\d+)?)\s*TB/i);
    if (!capM) continue;
    if (!/SATA|M\.?\s*2|NVME|SSD|HDD|EVO|Crucial|Samsung|WD\b|Western|Seagate|ST\d|CT\d|Kingston|SanDisk|Toshiba|Micron/i.test(l)) continue;
    let name = l.replace(/^.*?[:：]\s*/, '').replace(/\(?\s*\d{1,5}(?:\.\d+)?\s*[GT]B\s*\)?/ig, '')
      .replace(/^(AHCI|NVME|SATA\w*|M\.?\s*2\w*)\s*/i, '').replace(/[)(]/g, '').replace(/\s+/g, ' ').trim();
    if (!name || name.length < 3) continue;
    const isTB = /TB/i.test(capM[0]);
    const cap = (isTB ? capM[1] + 'TB' : Math.round(parseFloat(capM[1])) + 'GB');
    const key = (name + cap).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue; seen.add(key);
    const isHDD = /HDD|\bST\d{3,4}|Seagate\s+Barracuda|WD\d|Toshiba\s+DT/i.test(l) && !/SSD/i.test(l);
    if (isHDD) { out.hdd.push({ cap, maker: name }); }
    else { const type = /NVME|M\.?\s*2|EVO|9[78]0/i.test(l) ? 'NVMe' : (/SATA/i.test(l) ? 'SATA' : ''); out.ssd.push({ type, cap, maker: name }); }
  }
  return out;
}
// BIOS OCR 텍스트 → 구조화 추출용 공통 프롬프트
function biosAiPrompt(ocrText) {
  return [
    '다음은 PC의 BIOS/UEFI 또는 CPU-Z·시스템정보 등 하드웨어 정보 화면을 OCR로 읽은 텍스트입니다. 하드웨어 정보를 추출해 아래 JSON 스키마로만 답하세요(설명·코드펜스 없이 JSON만).',
    '값이 없으면 빈 문자열("") 또는 빈 배열([]). OCR 오탈자를 문맥으로 보정하세요. cpu는 Intel/AMD 접두 유지(예: Intel Core i3-6006U). 특히 "Core 17-"→"Core i7-", "Core 15-"→"Core i5-", "Core 13-"→"Core i3-", "Core 19-"→"Core i9-" 로 반드시 보정.',
    'RAM 규칙: 화면의 슬롯 라벨(DIMM/Slot1·Slot2/Channel/DDRn)이 여러 개면 "채워진 슬롯마다 별도 항목"을 만드세요. 같은 용량이 여러 슬롯에 있어도 각각 넣으세요(예: 2048MB가 Slot1·Slot2 → 항목 2개). 라벨과 값이 표의 다른 열/줄에 떨어져 있어도 순서대로 짝지으세요. 용량은 GB 숫자만(2048MB→2, 512MB→0.5). spec은 화면 그대로(DDR4, LPDDR3 등). "None/N/A" 슬롯은 제외.',
    'RAM maker에는 절대 저장장치/SSD 브랜드(LITEON, Samsung SSD, WD, LITEON 등)나 CPU/보드명을 넣지 마세요. 메모리 제조사가 화면에 명시 안 되면 비워두세요.',
    '저장장치(ssd/hdd)의 maker 필드에는 화면에 보이는 "전체 모델명"을 그대로 넣으세요(브랜드만 축약 금지). 예: "Samsung SSD 850 PRO", "WDC WD20EZRZ-00Z5HB", "WDC WD5000AAKX-22ER". 구분: 이름에 SSD/NVMe/M.2 있으면 ssd, WDC/Seagate/Toshiba 등 회전식 하드는 hdd. 용량(cap)은 "숫자+GB" 또는 "숫자+TB" 형식으로. 화면에 용량이 없어도 모델명으로 표준 용량을 알 수 있으면 추정해 넣으세요(예: WD20EZRZ→2TB, WD10EZEX→1TB, WD5000AAKX→500GB, Samsung 850 PRO(MZ-7KE256)→256GB, 970 EVO Plus 500GB→500GB). USB/이동식/카드리더는 제외. bios_version은 보드명과 분리.',
    'gpu는 그래픽카드 모델명(예: NVIDIA GeForce RTX 3060, AMD Radeon RX 6600, Intel UHD Graphics 630). 내장그래픽도 보이면 넣으세요.',
    '스키마: {"name":"","device_type":"desktop|laptop|server|printer|other","cpu":"","gpu":"","serial_number":"","bios_version":"","motherboard":{"plat":"Intel|AMD|","maker":"","chipset":"","model":""},"ram":[{"size":"","spec":"","maker":""}],"ssd":[{"type":"SATA|NVMe|","cap":"","maker":""}],"hdd":[{"cap":"","maker":""}]}',
    'OCR 텍스트:', '"""', String(ocrText).slice(0, 4000), '"""',
  ].join('\n');
}
function normalizeAiResult(g) {
  g.motherboard = g.motherboard || { plat: '', maker: '', chipset: '', model: '' };
  g.ram = Array.isArray(g.ram) ? g.ram : []; g.ssd = Array.isArray(g.ssd) ? g.ssd : []; g.hdd = Array.isArray(g.hdd) ? g.hdd : [];
  return g;
}
function extractJson(text) {
  const s = (text || '').indexOf('{'), e = (text || '').lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('AI 응답 파싱 실패');
  return JSON.parse(text.slice(s, e + 1));
}
// Groq (무료 티어, 카드 불필요) — OpenAI 호환 엔드포인트
async function groqParse(ocrText) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY 미설정');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: biosAiPrompt(ocrText) }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + resp.status));
  let text = ''; try { text = data.choices[0].message.content; } catch (e) {}
  return normalizeAiResult(extractJson(text));
}
// Gemini (유료 티어 필요) — Google Generative Language
async function geminiParse(ocrText) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY 미설정');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: biosAiPrompt(ocrText) }] }], generationConfig: { temperature: 0, response_mime_type: 'application/json' } }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + resp.status));
  let text = ''; try { text = data.candidates[0].content.parts.map(p => p.text || '').join(''); } catch (e) {}
  return normalizeAiResult(extractJson(text));
}
// AI 보완: Groq 우선(무료), 없으면 Gemini. 둘 다 없으면 throw.
async function aiParse(ocrText) {
  if (process.env.GROQ_API_KEY) return groqParse(ocrText);
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return geminiParse(ocrText);
  throw new Error('AI 키(GROQ_API_KEY 또는 GEMINI_API_KEY) 미설정');
}
app.post('/api/computers/ai-scan', wrap(async (req, res) => {
  const body = req.body || {};
  // 1) 수동 AI 정밀분석: {text, ai:true} → Gemini로 재해석
  if (body.ai && typeof body.text === 'string' && body.text.trim()) {
    try { const g = await aiParse(body.text); g._ocr = body.text.slice(0, 2000); g._src = 'ai'; return res.json(g); }
    catch (e) { console.log('[AI정밀분석] 오류:', e.message); return res.status(502).json({ error: 'AI 정밀분석 실패: ' + e.message }); }
  }
  // 2) 폰 OCR 텍스트만 → 규칙 파싱(무료)
  if (typeof body.text === 'string' && body.text.trim() && !body.image) {
    const parsed = parseBiosText(body.text); parsed._ocr = body.text.slice(0, 2000); parsed._src = 'regex';
    return res.json(parsed);
  }
  // 3) 이미지 → Vision OCR → 규칙 파싱 → (핵심값 비면) 자동 Gemini 폴백
  const key = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return res.status(503).json({ error: 'OCR 키가 없습니다. 직접 입력해주세요.' });
  const image = body.image;
  if (!image) return res.status(400).json({ error: '이미지가 없습니다' });
  const m = String(image).match(/^data:(image\/[^;]+);base64,(.*)$/s);
  const b64 = m ? m[2] : String(image);
  try {
    const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.log('[BIOS스캔] Vision 오류:', JSON.stringify(data).slice(0, 300));
      return res.status(502).json({ error: 'OCR 실패: ' + ((data.error && data.error.message) || resp.status) });
    }
    const r = data.responses && data.responses[0];
    const ocrText = (r && r.fullTextAnnotation && r.fullTextAnnotation.text) || '';
    let parsed = parseBiosText(ocrText); parsed._src = 'regex';
    // AI 무료(Groq)이므로 항상 AI로 정리 → 실패하면 규칙 결과를 안전망으로 사용
    const hasAiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (ocrText && hasAiKey) {
      try { const g = await aiParse(ocrText); g._src = 'ai'; parsed = g; }
      catch (e) { console.log('[AI] 실패, 규칙 결과 사용:', e.message); parsed._aiError = e.message; }
    }
    parsed._ocr = ocrText.slice(0, 2000);
    res.json(parsed);
  } catch (e) {
    console.log('[BIOS스캔] 오류:', e.message);
    res.status(500).json({ error: 'OCR 스캔 중 오류: ' + e.message });
  }
}));

// 텍스트 프롬프트 → AI JSON (Groq 우선, 없으면 Gemini). 견적 등 범용.
async function aiJsonFromText(prompt) {
  const gKey = process.env.GROQ_API_KEY;
  if (gKey) {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + gKey },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0, max_tokens: 4000, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + resp.status));
    let t = ''; try { t = data.choices[0].message.content; } catch (e) {}
    return extractJson(t);
  }
  const gemKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (gemKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemKey}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, response_mime_type: 'application/json' } }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + resp.status));
    let t = ''; try { t = data.candidates[0].content.parts.map(p => p.text || '').join(''); } catch (e) {}
    return extractJson(t);
  }
  throw new Error('AI 키(GROQ_API_KEY 또는 GEMINI_API_KEY) 미설정');
}
// 컴퓨존 견적 텍스트/HTML → AI 파싱 프롬프트
function estimatePrompt(txt) {
  return [
    '다음은 컴퓨존 PC견적(조립) 내용입니다(견적서 소스복사 텍스트/HTML 또는 화면 OCR). 견적에 담긴 부품들을 추출해 JSON으로만 답하세요(설명·코드펜스 없이).',
    '각 부품 필드: cat(분류), name(화면의 전체 상세 품명 그대로 — 대괄호[]·괄호()·제조사·모델명·용량·클럭 전부 포함, 절대 축약/요약 금지. 예: "[AMD] 라이젠5 라파엘 7500F (6코어/12스레드/3.7GHz/대리점정품/멀티팩) 쿨러포함"), price(판매가격 원, 숫자만-콤마·"원" 제거), qty(수량, 없으면 1).',
    '★미선택 제외: "옵션을 선택하세요"/"선택하세요"/"운영체제(OS)를 선택하세요" 등 선택 안 된 칸은 항목으로 만들지 마세요. 화면에 실제 선택된 부품만. 없는 항목(예: OS 미선택)을 지어내지 마세요.',
    'cat은 다음 중 하나로 정규화: CPU, 메인보드, 메모리, 그래픽카드, SSD, HDD, 케이스, 파워, 쿨러/튜닝, 모니터, 소프트웨어, 주변기기, 조립비/AS.',
    '매핑 예: "AMD CPU"/"인텔 CPU"→CPU, "AMD 소켓"/"인텔 소켓"→메인보드, "RAM"→메모리, "VGA"/"그래픽카드"→그래픽카드, "M.2"/"NVMe"→SSD, "POWER"→파워, "쿨러"→쿨러/튜닝.',
    '★중요: 목록에 있는 모든 구성 부품을 하나도 빠짐없이 전부 포함하세요. (쿨러/케이스/파워/모니터/소프트웨어/주변기기까지 전부). 개수를 임의로 줄이지 마세요.',
    '총 견적금액/합계/총액/배송비/할인 안내 줄은 제외하고 실제 부품만. 가격 없는 항목은 제외. HTML 태그는 무시하고 내용만.',
    'JSON 형식: {"items":[{"cat":"","name":"","price":0,"qty":1}]}',
    '견적 내용:', '"""', String(txt).slice(0, 8000), '"""',
  ].join('\n');
}
// URL → HTML 원문 디코드 (인코딩 감지, 태그 유지)
async function fetchHtmlDecoded(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko' } });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const buf = Buffer.from(await resp.arrayBuffer());
  // 인코딩 감지 (컴퓨존 등 국내 사이트는 EUC-KR/CP949 가 많음)
  let charset = '';
  const ct = resp.headers.get('content-type') || '';
  const m1 = ct.match(/charset=["']?([\w-]+)/i);
  if (m1) charset = m1[1];
  else { const head = buf.slice(0, 3000).toString('latin1'); const m2 = head.match(/charset=["']?([\w-]+)/i); if (m2) charset = m2[1]; }
  charset = (charset || 'utf-8').toLowerCase().replace('ks_c_5601-1987', 'euc-kr').replace('cp949', 'euc-kr').replace('utf8', 'utf-8');
  try { return new TextDecoder(charset).decode(buf); }
  catch (e) { try { return new TextDecoder('euc-kr').decode(buf); } catch (e2) { return buf.toString('utf-8'); } }
}
// 컴퓨존 공유 URL(사용자 본인 견적 링크) → 페이지 텍스트 추출 (AI 폴백용)
async function fetchQuoteText(url) {
  const html = await fetchHtmlDecoded(url);
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}
// 컴퓨존 견적/상품 URL에서 완성품 상품번호(pno) 추출
function compuzonePno(url) {
  const m = String(url || '').match(/(?:ProductNo|pno)=(\d+)/i);
  return m ? m[1] : '';
}
// 컴퓨존 분류(tit) → CSEP 견적 분류 매핑
const CZ_CAT = {
  'CPU': 'CPU', '메인보드': '메인보드', '메모리': '메모리', 'RAM': '메모리', 'MEMORY': '메모리',
  '그래픽카드': '그래픽카드', 'VGA': '그래픽카드', 'SSD': 'SSD',
  'HDD': 'HDD', '케이스': '케이스', '파워': '파워', 'POWER': '파워', '쿨러': '쿨러/튜닝', '모니터': '모니터',
  '유선키보드+마우스': '주변기기', '키보드': '주변기기', '마우스': '주변기기',
  '운영체제(OS)': '소프트웨어', 'OS': '소프트웨어', '소프트웨어': '소프트웨어',
  '조립비': '조립비/AS', '서비스': '조립비/AS',
};
function czMapCat(t) {
  t = String(t || '').trim();
  if (CZ_CAT[t]) return CZ_CAT[t];
  const inner = t.replace(/^옵션추가\s*\(?/, '').replace(/\)\s*$/, '').trim();  // "옵션추가 (HDD)" → "HDD"
  if (CZ_CAT[inner]) return CZ_CAT[inner];
  for (const k in CZ_CAT) if (t.indexOf(k) >= 0) return CZ_CAT[k];
  return '';
}
// 컴퓨존 "소스코드 공유" 온라인견적서 HTML 표 → 부품 직접 파싱 (붙여넣기, AI 불필요)
// 각 <tr> 셀 = [번호, 분류, 제품명, 판매가, 수량, 합계]. 번호가 "1-1" 형태(구성부품)인 행만.
function parseCompuzoneShareText(text) {
  const items = [];
  const trs = String(text || '').split(/<tr[\s>]/i).slice(1);
  for (const tr of trs) {
    const cells = []; const re = /<td[^>]*>([\s\S]*?)<\/td>/gi; let m;
    while ((m = re.exec(tr))) cells.push(m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim());
    if (cells.length < 6) continue;
    const [no, cat, name, sale, qty] = cells;
    if (!/^\d+\s*-\s*\d+$/.test(no)) continue;   // 1-1, 1-2 …(완성품 헤더행/합계행 제외)
    if (!name) continue;
    const price = Number((sale.match(/[\d,]+/) || [''])[0].replace(/,/g, '')) || '';
    const q = Number((qty.match(/\d+/) || ['1'])[0]) || 1;
    const nm = name.replace(/\s*-\s*\d{4,}\s*$/, '').trim();   // 끝의 상품번호 제거
    items.push({ cat: czMapCat(cat), name: nm, price, qty: q });
  }
  return items;
}
// 컴퓨존 완성품 상품상세 HTML → 기본사양(구성부품) 직접 파싱 (AI 불필요, 서버 원문 그대로)
function parseCompuzoneSpec(html) {
  const items = [];
  const rows = String(html).split(/<tr[\s>]/i).slice(1);
  for (const row of rows) {
    const tit = (row.match(/<td class="tit">([^<]+)<\/td>/) || [])[1];
    if (!tit) continue;
    const nameCell = (row.match(/<td class="name">([\s\S]*?)<\/td>/) || [])[1] || '';
    const a = (nameCell.match(/<a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '';
    const name = a.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!name || /선택하세요|선택 안|미선택/.test(name)) continue;  // 미선택(옵션을 선택하세요 등) 제외 → OS 지어냄 방지
    const price = Number((row.match(/prm_def_ori="(\d+)"/) || [])[1]) || '';
    const qty = Number((row.match(/prm_ori_num="(\d+)"/) || [])[1]) || 1;
    items.push({ cat: czMapCat(tit), name, price, qty });
  }
  return items;
}
async function fetchCompuzoneSpec(pno) {
  const html = await fetchHtmlDecoded('https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=' + pno);
  return parseCompuzoneSpec(html);
}
// 컴퓨존 견적 → AI로 부품·가격 파싱 (텍스트/HTML 붙여넣기, URL 공유, 스크린샷)
app.post('/api/estimate/scan', wrap(async (req, res) => {
  // 텍스트/URL(소스복사·URL공유) 우선 — OCR 불필요, 더 정확
  let textIn = req.body && (req.body.text || req.body.url);
  if (typeof textIn === 'string' && /^https?:\/\//i.test(textIn.trim())) {
    const url = textIn.trim();
    // 컴퓨존 완성품 URL이면 상품상세의 기본사양표를 직접 파싱(AI 불필요, 100% 정확 — 이름 축약·OS 지어냄 없음)
    const pno = /compuzone\.co\.kr/i.test(url) ? compuzonePno(url) : '';
    if (pno) {
      try {
        const items = await fetchCompuzoneSpec(pno);
        if (items.length) return res.json({ items, _src: 'compuzone-spec' });
      } catch (e) { console.log('[견적URL] 컴퓨존 기본사양 파싱 실패, AI 폴백:', e.message); }
    }
    try { textIn = await fetchQuoteText(url); }
    catch (e) { return res.status(502).json({ error: 'URL에서 견적을 불러오지 못했습니다: ' + e.message + ' (텍스트 복사나 캡처를 이용해보세요)' }); }
  }
  if (typeof textIn === 'string' && textIn.trim()) {
    // 컴퓨존 "소스코드 공유" HTML 표가 있으면 직접 파싱(AI 불필요, Groq 한도 무관)
    const direct = parseCompuzoneShareText(textIn);
    if (direct.length) return res.json({ items: direct, _src: 'compuzone-share' });
    try { const out = await aiJsonFromText(estimatePrompt(textIn)); return res.json({ items: Array.isArray(out.items) ? out.items : [], _src: 'text' }); }
    catch (e) { console.log('[견적붙여넣기] AI 오류:', e.message); return res.status(502).json({ error: 'AI 분석 실패: ' + e.message }); }
  }
  const image = req.body && req.body.image;
  if (!image) return res.status(400).json({ error: '이미지 또는 텍스트가 없습니다' });
  const key = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return res.status(503).json({ error: 'OCR 키(GOOGLE_VISION_API_KEY)가 없습니다.' });
  const m = String(image).match(/^data:(image\/[^;]+);base64,(.*)$/s);
  const b64 = m ? m[2] : String(image);
  try {
    const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: 'OCR 실패: ' + ((data.error && data.error.message) || resp.status) });
    const r = data.responses && data.responses[0];
    const ocrText = (r && r.fullTextAnnotation && r.fullTextAnnotation.text) || '';
    let out = { items: [] };
    try { out = await aiJsonFromText(estimatePrompt(ocrText)); }
    catch (e) { console.log('[견적스캔] AI 오류:', e.message); return res.status(502).json({ error: 'AI 분석 실패: ' + e.message }); }
    const items = Array.isArray(out.items) ? out.items : [];
    res.json({ items, _ocr: ocrText.slice(0, 2000) });
  } catch (e) {
    console.log('[견적스캔] 오류:', e.message);
    res.status(500).json({ error: '스캔 중 오류: ' + e.message });
  }
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
function maskEngineer(e) { if (!e) return e; const { password, ...rest } = e; return { ...rest, has_password: !!(password && String(password).length) }; }

app.get('/api/engineers', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM engineers ORDER BY id')).rows.map(maskEngineer));
}));

app.get('/api/engineers/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM engineers WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '기사 없음' });
  res.json(maskEngineer(rows[0]));
}));

app.post('/api/engineers', wrap(async (req, res) => {
  const b = req.body;
  if (b.password) b.password = hashPassword(b.password);
  const { rows } = await pool.query(
    `INSERT INTO engineers (name, phone, status, is_admin, password, total_jobs, total_revenue)
     VALUES ($1,$2,'idle',$3,$4,0,0) RETURNING *`,
    [b.name, b.phone, b.is_admin || false, b.password || null]
  );
  res.json(maskEngineer(rows[0]));
}));

app.put('/api/engineers/:id', wrap(async (req, res) => {
  const b = req.body; const sets = [], vals = []; let i = 1;
  if (b.password) b.password = hashPassword(b.password);
  if (b.name !== undefined)     { sets.push(`name=$${i++}`); vals.push(b.name); }
  if (b.phone !== undefined)    { sets.push(`phone=$${i++}`); vals.push(b.phone); }
  if (b.is_admin !== undefined) { sets.push(`is_admin=$${i++}`); vals.push(!!b.is_admin); }
  if (b.clear_password)         { sets.push(`password=NULL`); }
  else if (b.password)          { sets.push(`password=$${i++}`); vals.push(b.password); }  // 값 있을 때만 변경
  if (b.unlock)                 { sets.push(`locked=FALSE`, `login_fail_count=0`); }
  if (!sets.length) { const { rows } = await pool.query('SELECT * FROM engineers WHERE id=$1', [req.params.id]); return res.json(maskEngineer(rows[0])); }
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE engineers SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
  res.json(maskEngineer(rows[0]));
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
  broadcastReception('reception_new', rows[0]);
  res.json(rows[0]);
}));

app.put('/api/receptions/:id/assign', wrap(async (req, res) => {
  const engineerId = req.query.engineer_id || req.body.engineer_id;
  const { rows } = await pool.query(
    `UPDATE receptions SET assigned_engineer_id=$1, status='assigned', assigned_at=NOW() WHERE id=$2 RETURNING *`,
    [engineerId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  // jobs 생성 (이미 있으면 기사만 갱신 — 재배정 시 중복 방지)
  const existJob = await pool.query('SELECT id FROM jobs WHERE reception_id=$1', [req.params.id]);
  if (existJob.rows[0]) await pool.query('UPDATE jobs SET engineer_id=$1 WHERE reception_id=$2', [engineerId, req.params.id]);
  else await pool.query('INSERT INTO jobs (reception_id, engineer_id, status) VALUES ($1,$2,$3)', [req.params.id, engineerId, 'assigned']);
  const cust = await pool.query('SELECT name FROM customers WHERE id=$1', [rows[0].customer_id]);
  // 배정된 기사에게 FCM 푸시
  await sendPushToEngineer(engineerId, '새 작업 배정', `${cust.rows[0]?.name || '고객'} - ${rows[0].symptom || ''}`);
  // 모든 기사 앱에 new_assignment (소리+팝업), PC에도 동기화
  broadcastEngineers('new_assignment', rows[0]);
  broadcastAdmin('reception_update', rows[0]);
  res.json(rows[0]);
}));

app.put('/api/receptions/:id/status', wrap(async (req, res) => {
  const status = req.query.status || req.body.status;
  const extra = status === 'completed' ? ', completed_at=NOW()' : '';
  const { rows } = await pool.query(`UPDATE receptions SET status=$1${extra} WHERE id=$2 RETURNING *`, [status, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 일정(예약일) 변경 — 관리자 PC
app.put('/api/receptions/:id/reserve', wrap(async (req, res) => {
  const date = req.query.date || req.body.reserved_date || null;
  const { rows } = await pool.query('UPDATE receptions SET reserved_date=$1 WHERE id=$2 RETURNING *', [date || null, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 콜 취소 — 삭제하지 않고 '취소됨' 상태로 기록 보존
app.put('/api/receptions/:id/cancel', wrap(async (req, res) => {
  const reason = req.body.reason || '';
  const { rows } = await pool.query(
    `UPDATE receptions SET status='cancelled', outcome='cancelled', solution=CASE WHEN $2<>'' THEN $2 ELSE solution END WHERE id=$1 RETURNING *`,
    [req.params.id, reason ? ('[콜취소] ' + reason) : '[콜취소]']
  );
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 처리 내용 기록 (+선택적 완료) — 관리자 PC
app.put('/api/receptions/:id/solution', wrap(async (req, res) => {
  const b = req.body;
  const extra = b.complete ? ", status='completed', completed_at=NOW()" : '';
  const { rows } = await pool.query(`UPDATE receptions SET solution=$1${extra} WHERE id=$2 RETURNING *`, [b.solution || null, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 결제/정산 저장 (기사앱·PC 공용) — 공임/부품/결제수단/계산서, 선택적 완료
app.put('/api/receptions/:id/payment', wrap(async (req, res) => {
  const b = req.body;
  const fields = ['labor_fee','parts_fee','payment_method','tax_invoice','solution','estimate_amount','visit_fee','outcome','estimate_id'];
  const sets = [], vals = [];
  fields.forEach(f => { if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f}=$${vals.length}`); } });
  if (b.complete) sets.push("status='completed'", 'completed_at=NOW()');
  if (!sets.length) { const { rows } = await pool.query('SELECT * FROM receptions WHERE id=$1',[req.params.id]); return res.json(rows[0]); }
  vals.push(req.params.id);
  const { rows } = await pool.query(`UPDATE receptions SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  if (rows[0].status === 'completed') await syncEstimateFromReception(rows[0]);   // 견적 납품 완료 → 견적서에 현장할인·납품완료 기록
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));
// 완료된 접수가 견적 납품(estimate_id)이면 그 견적서에 납품완료·현장할인·실납품액 기록
async function syncEstimateFromReception(rec) {
  try {
    if (!rec || !rec.estimate_id) return;
    const actual = (Number(rec.labor_fee) || 0) + (Number(rec.parts_fee) || 0) + (Number(rec.visit_fee) || 0);
    const estAmt = Number(rec.estimate_amount) || 0;
    const discount = (estAmt > 0 && actual > 0 && actual < estAmt) ? (estAmt - actual) : 0;
    await pool.query('UPDATE estimates SET delivered=TRUE, delivered_at=NOW(), field_discount=$2, final_amount=$3 WHERE id=$1',
      [rec.estimate_id, discount, actual || estAmt]);
  } catch (e) { console.log('[견적납품 동기화] 오류:', e.message); }
}

// 수거·견적대기중 + 진행중 (지도 실행 시 자동 호출) — 미처리(new/assigned)면 진행중으로
app.put('/api/receptions/:id/pickup', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE receptions SET picked_up=TRUE, status=CASE WHEN status IN ('new','assigned') THEN 'in_progress' ELSE status END WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  await pool.query(`UPDATE jobs SET status='in_progress', started_at=COALESCE(started_at, NOW()) WHERE reception_id=$1 AND status <> 'completed'`, [req.params.id]);
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 장비수거 → 사무실 수거·점검 상태 전환
app.put('/api/receptions/:id/collect', express.json(), wrap(async (req, res) => {
  const desc = req.body.work_description || '장비 수거';
  const { rows } = await pool.query(
    `UPDATE receptions SET status='repairing', picked_up=TRUE, collected_at=NOW(), solution=$2 WHERE id=$1 RETURNING *`,
    [req.params.id, desc]
  );
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  await pool.query(`UPDATE jobs SET status='in_progress', started_at=COALESCE(started_at, NOW()), work_description=$2 WHERE reception_id=$1 AND status <> 'completed'`, [req.params.id, desc]);
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 우리사무기 정산 받음 처리 (토글)
app.put('/api/receptions/:id/woori-settle', wrap(async (req, res) => {
  const val = req.body.settled !== undefined ? !!req.body.settled : true;
  const { rows } = await pool.query('UPDATE receptions SET woori_settled=$1 WHERE id=$2 RETURNING *', [val, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '접수 없음' });
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 설정 (출장비 기본금액 등)
app.get('/api/settings', wrap(async (req, res) => {
  const rows = (await pool.query('SELECT key, value FROM settings')).rows;
  const o = {}; rows.forEach(r => o[r.key] = r.value); res.json(o);
}));
app.put('/api/settings/:key', wrap(async (req, res) => {
  await pool.query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2', [req.params.key, req.body.value ?? '']);
  res.json({ ok: true });
}));

app.put('/api/admin-password', express.json(), wrap(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const dbRow = (await pool.query("SELECT value FROM settings WHERE key='admin_password'")).rows[0];
  const currentPw = dbRow ? dbRow.value : (process.env.ADMIN_PASSWORD || 'csep2026!');
  if (currentPw && currentPw.length > 0 && oldPassword !== currentPw) return res.status(403).json({ error: '현재 비밀번호가 올바르지 않습니다' });
  await pool.query("INSERT INTO settings (key, value) VALUES ('admin_password', $1) ON CONFLICT (key) DO UPDATE SET value=$1", [newPassword ?? '']);
  res.json({ ok: true });
}));

app.delete('/api/receptions/:id', wrap(async (req, res) => {
  // 삭제 전 담당 기사·고객명 조회 → 배정된 기사에게 알림
  const info = await pool.query(
    'SELECT r.assigned_engineer_id, c.name FROM receptions r LEFT JOIN customers c ON c.id=r.customer_id WHERE r.id=$1',
    [req.params.id]
  );
  const engId = info.rows[0] && info.rows[0].assigned_engineer_id;
  const custName = (info.rows[0] && info.rows[0].name) || '고객';
  await pool.query('DELETE FROM receptions WHERE id=$1', [req.params.id]);
  // PC·기사앱 모두 목록 갱신
  broadcastReception('reception_deleted', { reception_id: Number(req.params.id) });
  if (engId) sendPushToEngineer(engId, '접수 취소', `${custName} 접수가 삭제되었습니다`);
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
    `INSERT INTO sales (customer_id, engineer_id, item_type, item_name, quantity, unit_price, total_price, sale_date, payment_method, paid, tax_invoice)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [b.customer_id || null, b.engineer_id || null, b.item_type || null, b.item_name, b.quantity, b.unit_price, b.total_price, b.sale_date, b.payment_method, b.paid === true, b.tax_invoice === true]
  );
  res.json(rows[0]);
}));
app.put('/api/sales/:id/woori-settle', wrap(async (req, res) => {
  const val = req.body.settled !== undefined ? !!req.body.settled : true;
  const { rows } = await pool.query('UPDATE sales SET woori_settled=$1 WHERE id=$2 RETURNING *', [val, req.params.id]);
  res.json(rows[0] || {});
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
  // 회계 표시용: 어떤 작업(고객·작업내용)으로 입금됐는지 조인
  const base = `
    SELECT p.*, j.reception_id, j.work_description, j.completed_at,
           r.customer_id, c.name AS customer_name, c.company_name, c.phone AS customer_phone
    FROM payments p
    LEFT JOIN jobs j ON p.job_id = j.id
    LEFT JOIN receptions r ON j.reception_id = r.id
    LEFT JOIN customers c ON r.customer_id = c.id`;
  if (status) return res.json((await pool.query(`${base} WHERE p.payment_status=$1 ORDER BY p.id DESC`, [status])).rows);
  res.json((await pool.query(`${base} ORDER BY p.id DESC`)).rows);
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
    assigned_pending: receptions.filter(r => r.status === 'new' || r.status === 'assigned').length,
    in_progress: receptions.filter(r => r.status === 'in_progress' || r.status === 'repairing').length,
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

// 주소 → 좌표 (카카오 로컬 API). 키 없으면 null 반환 → 앱은 검색 스킴으로 폴백 (필드서비스 동일)
app.get('/api/geocode', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) return res.json({ lon: null, lat: null });
  const cleanAddress = String(address).replace(/번지/g, '').replace(/\s+/g, ' ').trim();
  const queries = address === cleanAddress ? [address] : [address, cleanAddress];
  for (const q of queries) {
    try {
      const resp = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}`,
        { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } });
      const data = await resp.json();
      if (data.documents && data.documents.length > 0) {
        const { x, y } = data.documents[0];
        return res.json({ lon: parseFloat(x), lat: parseFloat(y) });
      }
    } catch (e) { console.log('[지오코딩 주소] 오류:', e.message); }
    try {
      const resp = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}`,
        { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } });
      const data = await resp.json();
      if (data.documents && data.documents.length > 0) {
        const { x, y } = data.documents[0];
        return res.json({ lon: parseFloat(x), lat: parseFloat(y) });
      }
    } catch (e) { console.log('[지오코딩 키워드] 오류:', e.message); }
  }
  res.json({ lon: null, lat: null });
});

// 실제 도로 경로 (카카오모빌리티 다중경유지 길찾기). 실패 시 {ok:false} → 앱은 직선거리로 폴백
// body: { origin:{lat,lng}, destinations:[{lat,lng}, ... 방문순서] }
app.post('/api/route', wrap(async (req, res) => {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return res.json({ ok: false, reason: 'no_key' });
  const { origin, destinations } = req.body || {};
  if (!origin || !Array.isArray(destinations) || !destinations.length) {
    return res.status(400).json({ error: 'origin/destinations 필요' });
  }
  const toXY = p => ({ x: Number(p.lng), y: Number(p.lat) });
  const dest = destinations[destinations.length - 1];
  const waypoints = destinations.slice(0, -1).map(toXY);
  const body = {
    origin: toXY(origin),
    destination: toXY(dest),
    waypoints,
    priority: 'RECOMMEND',
    car_fuel: 'GASOLINE', car_hipass: false, alternatives: false, road_details: false,
  };
  let resp;
  try {
    resp = await fetch('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
      method: 'POST',
      headers: { 'Authorization': `KakaoAK ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) { return res.json({ ok: false, reason: 'fetch_error', detail: e.message }); }
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.log('[route] 카카오모빌리티 오류', resp.status, t.slice(0, 200));
    return res.json({ ok: false, reason: 'api_error', status: resp.status });
  }
  const data = await resp.json();
  const route = data.routes && data.routes[0];
  if (!route || route.result_code !== 0) {
    return res.json({ ok: false, reason: 'no_route', msg: route && route.result_msg });
  }
  // 구간별(origin→wp1→...→dest) 거리/시간 + 도로별 교통상태·좌표
  // traffic_state: 0 정보없음, 1 원활, 2 서행, 3 지체, 4 정체
  const sections = (route.sections || []).map(sec => ({
    distance: sec.distance,
    duration: sec.duration,
    roads: (sec.roads || []).map(road => {
      const v = road.vertexes || [];
      const p = [];
      for (let i = 0; i + 1 < v.length; i += 2) p.push({ lng: v[i], lat: v[i + 1] });
      return { state: (typeof road.traffic_state === 'number' ? road.traffic_state : -1), speed: road.traffic_speed, path: p };
    }),
  }));
  const legs = sections.map(s => ({ distance: s.distance, duration: s.duration }));
  res.json({ ok: true, distance: route.summary.distance, duration: route.summary.duration, legs, sections });
}));

// 실제 도로거리 기준 방문순서 최적화 (지도선은 앱에서 직선으로 그림, 순서·거리만 도로 기준)
// body: { origin:{lat,lng}, stops:[{id,lat,lng}, ...] } → { ok, road, order:[{id,lat,lng,distance,duration}] }
app.post('/api/route-order', wrap(async (req, res) => {
  const key = process.env.KAKAO_REST_API_KEY;
  const { origin, stops } = req.body || {};
  if (!origin || !Array.isArray(stops) || !stops.length) return res.status(400).json({ error: 'origin/stops 필요' });
  const haversine = (a, b) => {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  // 지점이 너무 많으면 도로 API 호출량(N^2) 과다 → 직선 폴백 지시
  if (!key || stops.length > 9) return res.json({ ok: false, reason: key ? 'too_many' : 'no_key' });
  const cache = new Map();
  const roadDist = async (a, b) => {
    const k = `${a.lat},${a.lng}>${b.lat},${b.lng}`;
    if (cache.has(k)) return cache.get(k);
    let d = { distance: haversine(a, b), duration: Math.round(haversine(a, b) / 1000 / 30 * 3600), fallback: true };
    try {
      const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${a.lng},${a.lat}&destination=${b.lng},${b.lat}&priority=RECOMMEND&summary=true`;
      const resp = await fetch(url, { headers: { 'Authorization': `KakaoAK ${key}` } });
      if (resp.ok) {
        const data = await resp.json();
        const r = data.routes && data.routes[0];
        if (r && r.result_code === 0) d = { distance: r.summary.distance, duration: r.summary.duration };
      }
    } catch (e) { /* 폴백 유지 */ }
    cache.set(k, d);
    return d;
  };
  // 최근접이웃 (실제 도로거리 기준)
  const remaining = stops.slice();
  const order = [];
  let cur = origin, anyReal = false;
  while (remaining.length) {
    let bi = 0, bd = Infinity, bres = null;
    for (let i = 0; i < remaining.length; i++) {
      const d = await roadDist(cur, remaining[i]);
      if (!d.fallback) anyReal = true;
      if (d.distance < bd) { bd = d.distance; bi = i; bres = d; }
    }
    const next = remaining.splice(bi, 1)[0];
    order.push({ id: next.id, lat: next.lat, lng: next.lng, distance: bres.distance, duration: bres.duration });
    cur = next;
  }
  res.json({ ok: true, road: anyReal, order });
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
  // 같은 폰(토큰)을 다른 계정에서 쓰던 기록 제거 → 토큰은 현재 로그인한 1명에게만 귀속
  // (기사로 로그인 시 대표 계정에 남은 토큰 제거 → 수신 테스트는 대표 로그인 때만 울림)
  await pool.query('DELETE FROM fcm_tokens WHERE fcm_token=$1 AND engineer_id<>$2', [fcm_token, engineer_id]);
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
app.put('/api/result-presets/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('UPDATE result_presets SET text=$1 WHERE id=$2 RETURNING *', [req.body.text || '', req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: '프리셋 없음' });
  res.json(rows[0]);
}));
app.delete('/api/result-presets/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM result_presets WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ============================================================
//  기사앱 전용 API
// ============================================================
// (기사 로그인은 인증 미들웨어보다 먼저 등록되어야 하므로 파일 상단으로 이동함)

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
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 작업 완료 (결과 입력) → 접수+작업+기사실적 갱신, 관리자 실시간 알림
app.put('/api/engineer/receptions/:id/complete', wrap(async (req, res) => {
  const b = req.body;
  const total = (Number(b.cost_parts) || 0) + (Number(b.cost_labor) || 0);
  const { rows } = await pool.query(`UPDATE receptions SET status='completed', completed_at=NOW(), solution=$2, customer_request=$3, labor_fee=$4, parts_fee=$5, payment_method=$6, tax_invoice=$7, reserved_date=NULL WHERE id=$1 RETURNING *`, [req.params.id, b.work_description || '', b.customer_request || null, Number(b.cost_labor) || 0, Number(b.cost_parts) || 0, b.payment_method || null, !!b.tax_invoice]);
  const jobRes = await pool.query(
    `UPDATE jobs SET status='completed', completed_at=NOW(), work_description=$2, parts_used=$3, cost_parts=$4, cost_labor=$5, total_cost=$6, next_visit_parts=$7 WHERE reception_id=$1 RETURNING id`,
    [req.params.id, b.work_description || '', b.parts_used || '', Number(b.cost_parts) || 0, Number(b.cost_labor) || 0, total, b.next_visit_parts || null]
  );
  const eng = rows[0].assigned_engineer_id;
  if (eng) await pool.query('UPDATE engineers SET total_jobs=total_jobs+1, total_revenue=total_revenue+$2 WHERE id=$1', [eng, total]);

  // 비용이 있으면 회계(payments)에 기록 (재완료 시 중복 방지)
  //  결제수단이 현금/카드/이체 → 입금완료(completed), '미수'/미입력 → 미수(pending)+고객 미수금 증가
  if (total > 0) {
    const jobId = jobRes.rows[0] && jobRes.rows[0].id;
    const exists = jobId ? (await pool.query('SELECT id FROM payments WHERE job_id=$1', [jobId])).rows[0] : null;
    if (!exists) {
      const method = b.payment_method || 'unpaid';
      const paid = method !== 'unpaid';
      await pool.query(
        `INSERT INTO payments (job_id, amount, payment_method, payment_status, paid_at) VALUES ($1, $2, $3, $4, $5)`,
        [jobId || null, total, method, paid ? 'completed' : 'pending', paid ? new Date() : null]
      );
      // 미수(나중에 받음)일 때만 고객 미수금 증가
      if (!paid && rows[0].customer_id) await pool.query('UPDATE customers SET outstanding_amount = COALESCE(outstanding_amount,0) + $2 WHERE id=$1', [rows[0].customer_id, total]);
    }
  }

  await syncEstimateFromReception(rows[0]);   // 견적 납품 완료 → 견적서에 현장할인·납품완료 기록
  broadcastAdmin('job_update', { reception_id: req.params.id, total_cost: total });
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// 미처리(예약) — 예약일 지정, 작업 유지
app.put('/api/engineer/receptions/:id/reserve', wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(`UPDATE receptions SET reserved_date=$2, status='assigned', customer_request=$3 WHERE id=$1 RETURNING *`, [req.params.id, b.reserved_date || null, b.customer_request || null]);
  await pool.query(`UPDATE jobs SET work_description=$2, parts_used=$3, next_visit_parts=$4 WHERE reception_id=$1`, [req.params.id, b.work_description || '', b.parts_used || '', b.next_visit_parts || null]);
  broadcastReception('reception_update', rows[0]);
  res.json(rows[0]);
}));

// ============================================================
//  SPA 폴백 + 서버 시작
// ============================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../admin/index.html')));

// 만료된 로그인 세션 주기적 정리
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expires < now) sessions.delete(token);
  }
}, 60 * 60 * 1000);

initDB()
  .then(() => { cleanupOldPhotos(); setInterval(cleanupOldPhotos, 24 * 60 * 60 * 1000); })
  .then(() => app.listen(PORT, () => console.log(`CSEP 서버 실행: http://localhost:${PORT}`)))
  .catch(e => { console.error('DB 초기화 실패:', e.message); app.listen(PORT, () => console.log(`CSEP 서버 실행(DB오류): http://localhost:${PORT}`)); });
