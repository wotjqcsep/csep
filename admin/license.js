// ============================================================
//  CSEP 라이선스 검증 — PythonAnywhere auth_server /verify 사용
// ============================================================
const LICENSE_SERVER = 'https://wotjq2.pythonanywhere.com';
const LICENSE_STORAGE_KEY = 'csep_license_key';
const LICENSE_SESSION_KEY = 'csep_license_session';
const LICENSE_VERIFIED_KEY = 'csep_license_last_verified';
const LICENSE_GRACE_DAYS = 7;
const LICENSE_OFFLINE_MENUS = ['estimates', 'payments', 'stats'];

// 'full' = 온라인 인증 완료, 'limited' = 오프라인 유예(제한 메뉴), 'blocked' = 차단
let licenseMode = 'blocked';

let licenseSessionId = sessionStorage.getItem(LICENSE_SESSION_KEY);
if (!licenseSessionId) {
  licenseSessionId = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  sessionStorage.setItem(LICENSE_SESSION_KEY, licenseSessionId);
}

let licenseInfo = null;

async function _licenseVerify(key) {
  try {
    const r = await fetch(LICENSE_SERVER + '/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, session_id: licenseSessionId })
    });
    const data = await r.json();
    data._online = true;
    return data;
  } catch (e) {
    return { valid: false, _online: false, message: '라이선스 서버 연결 실패' };
  }
}

function _licSaveVerified() {
  localStorage.setItem(LICENSE_VERIFIED_KEY, Date.now().toString());
}

function _licGraceDaysLeft() {
  const ts = parseInt(localStorage.getItem(LICENSE_VERIFIED_KEY) || '0');
  if (!ts) return -1;
  const elapsed = Date.now() - ts;
  const daysLeft = LICENSE_GRACE_DAYS - Math.floor(elapsed / (24 * 60 * 60 * 1000));
  return daysLeft;
}

function isMenuAllowed(menuId) {
  if (licenseMode === 'full') return true;
  if (licenseMode === 'limited') return LICENSE_OFFLINE_MENUS.includes(menuId);
  return false;
}

async function checkLicense() {
  const key = localStorage.getItem(LICENSE_STORAGE_KEY);
  if (key) {
    document.getElementById('licenseScreen').querySelector('.lic-loading').style.display = 'block';
    document.getElementById('licenseScreen').querySelector('.lic-form').style.display = 'none';
    document.getElementById('licenseScreen').style.display = 'flex';
    const res = await _licenseVerify(key);
    document.getElementById('licenseScreen').querySelector('.lic-loading').style.display = 'none';

    if (res.valid) {
      licenseMode = 'full';
      licenseInfo = { ...res, key };
      _licSaveVerified();
      document.getElementById('licenseScreen').style.display = 'none';
      _updateLicBadge();
      checkAuth();
      return;
    }

    // 서버 연결 실패 (키 만료/파기가 아닌 네트워크 문제) → 오프라인 유예 확인
    if (!res._online) {
      const daysLeft = _licGraceDaysLeft();
      if (daysLeft > 0) {
        licenseMode = 'limited';
        licenseInfo = { key, role_kr: '오프라인', name: '', created: '', expires: '', _offline: true, _daysLeft: daysLeft };
        document.getElementById('licenseScreen').style.display = 'none';
        _updateLicBadge();
        checkAuth();
        return;
      }
    }

    // 키 만료/파기 또는 유예 기간 초과
    localStorage.removeItem(LICENSE_STORAGE_KEY);
    localStorage.removeItem(LICENSE_VERIFIED_KEY);
  }
  licenseMode = 'blocked';
  document.getElementById('licenseScreen').querySelector('.lic-form').style.display = 'block';
  document.getElementById('licenseScreen').style.display = 'flex';
}

async function doLicenseSubmit() {
  const input = document.getElementById('licKeyInput');
  const errEl = document.getElementById('licError');
  const key = input.value.trim();
  errEl.style.display = 'none';
  if (!key) { errEl.textContent = '라이선스 키를 입력해주세요.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('licSubmitBtn');
  btn.disabled = true; btn.textContent = '확인 중...';
  const res = await _licenseVerify(key);
  btn.disabled = false; btn.textContent = '인증';

  if (res.valid) {
    licenseMode = 'full';
    localStorage.setItem(LICENSE_STORAGE_KEY, key);
    _licSaveVerified();
    licenseInfo = { ...res, key };
    document.getElementById('licenseScreen').style.display = 'none';
    _updateLicBadge();
    checkAuth();
  } else {
    errEl.textContent = res.message || '유효하지 않은 라이선스 키입니다.';
    errEl.style.display = 'block';
  }
}

function _updateLicBadge() {
  const el = document.getElementById('licBadge');
  if (!el) return;
  if (licenseMode === 'limited') {
    el.textContent = '⚠️ 오프라인';
    el.style.color = '#f08c00';
  } else {
    el.textContent = '🔒 인증';
    el.style.color = '#c8cdd8';
  }
}

function _fmtLicDate(s) {
  if (!s || s === '-') return '-';
  if (s === 'unlimited') return '무제한';
  try {
    const d = s.length > 10 ? new Date(s) : new Date(s + 'T00:00:00');
    if (isNaN(d)) return s;
    return d.getFullYear() + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + String(d.getDate()).padStart(2, '0') + '.';
  } catch (e) { return s; }
}

async function showLicenseModal() {
  if (!licenseInfo) return;
  const li = licenseInfo;
  const isOffline = licenseMode === 'limited';
  const fromStr = _fmtLicDate(li.created);
  const toStr = li.expires === 'unlimited' ? '무제한' : _fmtLicDate(li.expires);

  const statusBadge = isOffline
    ? `<span style="background:var(--lic-warn-bg);color:var(--lic-warn-c);padding:3px 12px;border-radius:10px;font-size:12px;font-weight:700">⚠️ 오프라인 (${li._daysLeft}일 남음)</span>`
    : `<span style="background:var(--lic-ok-bg);color:var(--lic-ok-c);padding:3px 12px;border-radius:10px;font-size:12px;font-weight:700">✅ 유효</span>`;

  const offlineNotice = isOffline
    ? `<div style="background:var(--lic-notice-bg);border:1px solid var(--lic-notice-border);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--lic-notice-c)">
        ⚠️ 라이선스 서버에 연결할 수 없어 <strong>제한 모드</strong>로 동작 중입니다.<br>
        사용 가능 메뉴: <strong>견적·명세·계산서, 결산, 통계</strong><br>
        남은 유예 기간: <strong>${li._daysLeft}일</strong> (이후 전체 차단)
      </div>` : '';

  document.getElementById('modalRoot').innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)this.remove()">
    <div class="modal" style="max-width:420px">
      <div class="modal-head" style="background:${isOffline ? 'var(--lic-head-warn)' : 'var(--lic-head-ok)'}">
        <h3 style="font-size:16px">🔒 라이선스 정보</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;color:var(--gray-500);font-size:12px;margin-bottom:16px">CSEP — 컴퓨터 A/S ERP</div>
        ${offlineNotice}
        <table style="width:100%;border-collapse:collapse">
          <tr style="border-bottom:1px solid var(--gray-100)">
            <td style="padding:10px 0;color:var(--gray-500);width:80px;font-size:13px">등급:</td>
            <td style="padding:10px 0;font-weight:700">${esc(li.role_kr || li.role || '-')}</td>
          </tr>
          <tr style="border-bottom:1px solid var(--gray-100)">
            <td style="padding:10px 0;color:var(--gray-500);font-size:13px">상태:</td>
            <td style="padding:10px 0">${statusBadge}</td>
          </tr>
          ${isOffline ? '' : `<tr style="border-bottom:1px solid var(--gray-100)">
            <td style="padding:10px 0;color:var(--gray-500);font-size:13px">사용기간:</td>
            <td style="padding:10px 0">${fromStr} ~ ${toStr}</td>
          </tr>`}
          <tr style="border-bottom:1px solid var(--gray-100)">
            <td style="padding:10px 0;color:var(--gray-500);font-size:13px">이름:</td>
            <td style="padding:10px 0">${esc(li.name || '-')}</td>
          </tr>
        </table>

        <div style="border-top:2px solid var(--gray-200);margin-top:14px;padding-top:14px">
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:var(--gray-600)">
            <tr><td style="padding:6px 0;width:80px;vertical-align:top;color:var(--gray-400)">라이선스<br>유형</td><td style="padding:6px 0">지정 사용자</td></tr>
            <tr><td style="padding:6px 0;color:var(--gray-400)">유효 기간</td><td style="padding:6px 0">만료 후 갱신 필요</td></tr>
            <tr><td style="padding:6px 0;color:var(--gray-400)">갱신 방식</td><td style="padding:6px 0">저작권자 수동 승인</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top;color:var(--gray-400)">연장 조건</td><td style="padding:6px 0">저작권자의 특별한 사유 발생 시 갱신이 제한될 수 있습니다.</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top;color:var(--gray-400)">면책 조항</td><td style="padding:6px 0">본 프로그램은 무상 제공되며 사용 여부는 사용자의 자유로운 선택입니다. 사용으로 인한 모든 결과에 대해 저작권자는 책임을 지지 않습니다.</td></tr>
            <tr><td style="padding:6px 0;color:var(--gray-400)">저작권자</td><td style="padding:6px 0">wotjq2@mail.com</td></tr>
          </table>
        </div>

        <div style="text-align:center;margin-top:18px">
          <button class="btn btn-sm btn-secondary" onclick="_licChangeKey()" style="margin-bottom:10px">🔑 라이선스 키 변경</button>
        </div>
        <div id="licModalCheck" style="text-align:center;font-size:12px;color:var(--gray-400);margin-bottom:12px">${isOffline ? '⚠️ 서버 연결 불가' : '확인 중...'}</div>
        <div style="text-align:center">
          <button class="btn" onclick="this.closest('.modal-overlay').remove()" style="min-width:140px">닫기</button>
        </div>
      </div>
    </div>
  </div>`;

  if (!isOffline) {
    const chk = document.getElementById('licModalCheck');
    const res = await _licenseVerify(li.key);
    if (chk) chk.textContent = res.valid ? '✅ 인증 확인 완료' : '⚠️ ' + (res.message || '인증 실패');
    if (!res.valid && chk) chk.style.color = 'var(--danger)';
  }
}

function _licChangeKey() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  localStorage.removeItem(LICENSE_VERIFIED_KEY);
  licenseInfo = null;
  licenseMode = 'blocked';
  document.getElementById('modalRoot').innerHTML = '';
  document.getElementById('licenseScreen').querySelector('.lic-form').style.display = 'block';
  document.getElementById('licenseScreen').querySelector('.lic-loading').style.display = 'none';
  document.getElementById('licenseScreen').style.display = 'flex';
  sessionStorage.removeItem('authToken');
}
