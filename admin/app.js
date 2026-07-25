// ============================================================
//  CSEP 관리자 — 페이지 렌더러 + 모달 + SSE
// ============================================================

// ── 고객 관리 ──
let custState = { selected:null, tab:'info', search:'', filter:'all', selComp:null };
function renderCustomers(){
  const cs = state.customers, q = custState.search;
  const filtered = cs.filter(c=>{
    const ms = !q || (c.name||'').includes(q) || (c.phone||'').includes(q) || (c.company_name||'').includes(q);
    const mt = custState.filter==='all' || c.customer_type===custState.filter;
    return ms && mt;
  });
  const sel = custState.selected ? cs.find(c=>c.id==custState.selected.id) : null;
  const comps = sel ? state.computers.filter(c=>c.customer_id==sel.id) : [];
  return `
  <div class="page-header"><h2>고객 · 장비 (${cs.length}명)</h2><button class="btn" onclick="openCustomerModal()">+ 고객 추가</button></div>
  <div class="filter-bar">
    <input class="search-input" placeholder="이름, 회사명, 전화번호 검색..." value="${esc(q)}" oninput="custState.search=this.value;renderInto()">
    ${['all:전체','personal:개인','business:기업'].map(x=>{const[v,l]=x.split(':');return `<button class="filter-btn ${custState.filter===v?'active':''}" onclick="custState.filter='${v}';renderInto()">${l} (${v==='all'?cs.length:cs.filter(c=>c.customer_type===v).length})</button>`}).join('')}
  </div>
  <div class="${sel?'split':''}">
    <div class="table-container">
      <table class="table"><thead><tr><th>구분</th><th>명칭</th><th>회사명</th><th>전화</th><th>주소</th><th>미수금</th></tr></thead><tbody>
      ${filtered.length? filtered.map(c=>`<tr onclick="selectCustomer(${c.id})" style="cursor:pointer;${sel&&sel.id==c.id?'background:var(--primary-light)':''}">
        <td><span class="badge ${c.customer_type==='business'?'assigned':'new'}">${c.customer_type==='business'?'기업':'개인'}</span></td>
        <td><strong>${esc(c.name)||`<span style="color:var(--gray-400)">이름없음</span>`}</strong></td><td>${esc(c.company_name)||'-'}</td><td>${esc(c.phone)||'-'}</td><td>${esc(c.address)||'-'}</td>
        <td>${c.outstanding_amount>0?`<span class="outstanding">${won(c.outstanding_amount)}</span>`:'없음'}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">고객이 없습니다</td></tr>'}
      </tbody></table>
    </div>
    ${sel? renderCustomerDetail(sel, comps) : ''}
  </div>`;
}
function renderCustomerDetail(c, comps){
  return `<div class="detail-panel">
    <h3>${esc(c.name)||esc(c.phone)||'고객'}<div style="display:flex;gap:6px"><button class="btn btn-sm btn-secondary" onclick="openCustomerModal(${c.id})">수정</button><button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">삭제</button></div></h3>
    <div class="tabs">
      <button class="tab ${custState.tab==='info'?'active':''}" onclick="custState.tab='info';renderInto()">기본 정보</button>
      <button class="tab ${custState.tab==='equip'?'active':''}" onclick="custState.tab='equip';renderInto()">장비 (${comps.length})</button>
    </div>
    ${custState.tab==='info'? `
      ${row('구분', c.customer_type==='business'?'기업':'개인')}
      ${c.company_name?row('회사명',esc(c.company_name)):''}
      ${c.contact_person?row('담당자',esc(c.contact_person)):''}
      ${row('전화',esc(c.phone)||'-')}
      ${c.phone2?row('보조전화',esc(c.phone2)):''}
      ${c.email?row('이메일',esc(c.email)):''}
      ${row('주소',(esc(c.address)||'-')+' '+(esc(c.address_detail)||''))}
      ${row('미수금', c.outstanding_amount>0?won(c.outstanding_amount):'없음')}
      ${c.memo?row('메모',esc(c.memo)):''}
    ` : `
      <div style="text-align:right;margin-bottom:8px"><button class="btn btn-sm" onclick="openComputerModal(null,${c.id})">+ 장비 추가</button></div>
      ${comps.length? comps.map(cp=>renderCompCard(cp)).join('') : '<div class="empty-state">등록된 장비가 없습니다</div>'}
    `}
  </div>`;
}
function renderCompCard(cp){
  const open = custState.selComp==cp.id;
  const detail = open? `<div style="margin-top:8px;font-size:12px;color:var(--gray-600)">${[
    ['CPU',cp.cpu],['RAM',cp.ram],['SSD',cp.ssd],['HDD',cp.hdd],['OS',cp.os],['IP',cp.ip_address],
    ['NAS',cp.nas_name?`${cp.nas_name} (${cp.nas_ip||'-'})`:''],['공유기',cp.router_name?`${cp.router_name} (${cp.router_ip||'-'})`:''],
    ['보증만료',cp.warranty_expiry],['메모',cp.notes]
  ].filter(([,v])=>v).map(([k,v])=>`<div style="display:flex;gap:8px;margin-bottom:2px"><span style="color:var(--gray-400);min-width:56px">${k}</span><span>${esc(v)}</span></div>`).join('')}</div>` : '';
  return `<div style="padding:10px 12px;margin-bottom:6px;border-radius:8px;border:1px solid var(--gray-200);cursor:pointer;${open?'background:var(--primary-light)':''}" onclick="custState.selComp=${open?'null':cp.id};renderInto()">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><span class="badge new" style="margin-right:6px">${DEVICE_TYPES[cp.device_type]||cp.device_type}</span><strong>${esc(cp.name)||'(이름없음)'}</strong></div>
      <div style="display:flex;gap:4px" onclick="event.stopPropagation()"><button class="btn btn-sm btn-secondary" onclick="openComputerModal(${cp.id})">수정</button><button class="btn btn-sm btn-danger" onclick="deleteComputer(${cp.id})">삭제</button></div>
    </div>${detail}</div>`;
}
function selectCustomer(id){ custState.selected = custState.selected&&custState.selected.id==id?null:{id}; custState.tab='info'; custState.selComp=null; renderInto(); }
async function deleteCustomer(id){ if(!confirm('이 고객을 삭제하시겠습니까? (등록 장비도 함께 삭제)'))return; await api('DELETE','/customers/'+id); custState.selected=null; await loadAll(); }

// ── 접수 관리 ──
let recState = { filter:'all' };
const REC_ST = {
  new:        { l:'미처리', c:'var(--danger)' },
  assigned:   { l:'미처리', c:'var(--danger)' },   // 배정 개념 없음 — 콜 오면 자동 배당, 미처리로 표시
  in_progress:{ l:'진행중', c:'#1971c2' },
  completed:  { l:'완료',   c:'var(--success)' },
};
function custObj(id){ return state.customers.find(c=>c.id==id); }
// received_at("2026-07-25 08:06:28.552316+00") → Date (타임존 보정)
function recDate(t){
  if(!t) return null;
  let s = String(t).replace(' ','T').replace(/\.\d+/,'');
  if(/[+-]\d{2}$/.test(s)) s += ':00';                        // +00 → +00:00
  else if(!/([+-]\d{2}:\d{2}|Z)$/.test(s)) s += 'Z';          // 타임존 없으면 UTC 가정
  const d = new Date(s); return isNaN(d.getTime()) ? null : d;
}
function localDateKey(t){ const d=recDate(t); if(!d) return '-'; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtRecDate(key){
  if(!key || key==='-') return '날짜 미상';
  const dt=new Date(key+'T00:00:00'); const wk='일월화수목금토'[dt.getDay()];
  return `${dt.getFullYear()}년 ${dt.getMonth()+1}월 ${dt.getDate()}일 ${wk}`;
}
function fmtRecTime(t){ const d=recDate(t); return d? d.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''; }
function recCard(r){
  const c = custObj(r.customer_id) || {};
  const st = REC_ST[r.status] || { l:r.status, c:'var(--gray-500)' };
  const phone = r.reception_phone || c.phone || '';
  const addr = [c.address, c.address_detail].filter(Boolean).join(' ');
  const ch = ({phone:'📞',sms:'💬',kakao:'💭',direct:'📋'})[r.reception_channel] || '📋';
  return `<div class="ws-card ${r.status}">
    <div class="ws-head">
      <div class="ws-name">${esc(custName(r.customer_id))} <span style="font-size:13px;font-weight:400;color:var(--gray-400)">${ch}</span></div>
      <span class="ws-pill" style="background:${st.c}">${st.l}</span>
    </div>
    <div class="ws-row"><span class="ic">👤</span><span>담당: ${r.assigned_engineer_id?esc(engName(r.assigned_engineer_id)):'<span style="color:var(--gray-400)">미지정</span>'}</span></div>
    ${r.symptom?`<div class="ws-row"><span class="ic">🔧</span><span>${esc(r.symptom)}</span></div>`:''}
    ${phone?`<div class="ws-row"><span class="ic">📞</span><span>${esc(phone)}</span></div>`:''}
    ${addr?`<div class="ws-row"><span class="ic">📍</span><span>${esc(addr)}</span></div>`:''}
    ${r.reserved_date?`<div class="ws-row"><span class="ic">📅</span><span>예약: ${esc(r.reserved_date)}</span></div>`:''}
    ${(r.solution||r.initial_memo)?`<div class="ws-memo">${esc(r.solution||r.initial_memo)}</div>`:''}
    <div class="ws-actions">
      ${(r.status==='new'||r.status==='assigned')?`<button class="btn btn-sm btn-success" onclick="setRecStatus(${r.id},'in_progress')">▶ 작업 시작</button>`:''}
      ${r.status==='in_progress'?`<button class="btn btn-sm btn-success" onclick="setRecStatus(${r.id},'completed')">✔ 완료 처리</button>`:''}
      ${r.status!=='new'?`<button class="btn btn-sm btn-secondary" onclick="openAdminChat(${r.id})">💬 대화${adminChatUnread[r.id]?` (${adminChatUnread[r.id]})`:''}</button>`:''}
      <button class="btn btn-sm btn-danger" onclick="deleteReception(${r.id})">✕ 삭제</button>
    </div>
    <div class="ws-time">${fmtRecTime(r.received_at)}</div>
  </div>`;
}
function renderReceptions(){
  const rs = state.receptions;
  // 배정 개념 없음: new·assigned 모두 '미처리'로 취급
  const isPending = r => r.status==='new' || r.status==='assigned';
  const match = r => recState.filter==='new' ? isPending(r) : r.status===recState.filter;
  const filtered = recState.filter==='all'? rs : rs.filter(match);
  const cnt = s => s==='new' ? rs.filter(isPending).length : rs.filter(r=>r.status===s).length;
  // 날짜별 그룹 (received_at 기준, 최신순)
  const byDate = {};
  filtered.forEach(r=>{ const d=localDateKey(r.received_at); (byDate[d]=byDate[d]||[]).push(r); });
  const dates = Object.keys(byDate).sort().reverse();
  const filters = [['all','전체'],['new','미처리'],['in_progress','진행중'],['completed','완료']];
  return `
  <div class="page-header"><h2>📋 전체 작업현황 (${rs.length}건)</h2><button class="btn" onclick="openReceptionModal()">+ 접수 등록</button></div>
  <div class="ws-wrap">
    <div class="ws-filter">
      ${filters.map(([s,l])=>{ const col=(REC_ST[s]||{}).c||'var(--gray-500)'; const on=recState.filter===s;
        return `<button class="ws-fbtn" style="background:${on?col:'var(--gray-200)'};color:${on?'#fff':'var(--gray-600)'}" onclick="recState.filter='${s}';renderInto()">${l} ${s==='all'?rs.length:cnt(s)}</button>`; }).join('')}
    </div>
    ${filtered.length
      ? dates.map(d=>`<div class="ws-date"><span>${fmtRecDate(d)}</span></div><div class="ws-grid">${byDate[d].sort((a,b)=>(b.received_at||'').localeCompare(a.received_at||'')).map(recCard).join('')}</div>`).join('')
      : '<div class="empty-state">해당 상태의 작업이 없습니다</div>'}
  </div>`;
}
async function setRecStatus(id,status){ await api('PUT',`/receptions/${id}/status?status=${status}`); await loadAll(); }
async function deleteReception(id){ if(!confirm('이 접수를 삭제하시겠습니까?'))return; await api('DELETE','/receptions/'+id); await loadAll(); }

// ── 기사 관리 ──
function renderEngineers(){
  const es = state.engineers;
  return `
  <div class="page-header"><h2>작업지시 · 기사 (${es.length}명)</h2><button class="btn" onclick="openEngineerModal()">+ 기사 추가</button></div>
  <div class="table-container"><table class="table">
    <thead><tr><th>이름</th><th>전화</th><th>상태</th><th>권한</th><th>액션</th></tr></thead>
    <tbody>${es.length? es.map(e=>`<tr>
      <td><strong>${esc(e.name)}</strong></td><td>${esc(e.phone)||'-'}</td>
      <td><span class="chip">${statusLabel(e.status)}</span></td>
      <td>${e.is_admin?'<span class="badge assigned">대표</span>':'기사'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteEngineer(${e.id})">삭제</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">기사가 없습니다</td></tr>'}
    </tbody></table></div>`;
}
async function deleteEngineer(id){ if(!confirm('이 기사를 삭제하시겠습니까?'))return; await api('DELETE','/engineers/'+id); await loadAll(); }

// ── 수리 이력 ──
function renderHistory(){
  const js = state.jobs;
  return `<div class="page-header"><h2>수리 이력 (${js.length}건)</h2></div>
  <div class="table-container"><table class="table">
    <thead><tr><th>#</th><th>기사</th><th>작업내용</th><th>부품</th><th>비용</th><th>상태</th></tr></thead>
    <tbody>${js.length? js.map(j=>`<tr>
      <td style="color:var(--gray-400)">${j.id}</td><td>${esc(engName(j.engineer_id))}</td>
      <td>${esc(j.work_description)||'-'}</td><td>${esc(j.parts_used)||'-'}</td>
      <td>${won(j.total_cost)}</td><td><span class="badge ${j.status}">${statusLabel(j.status)}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">이력이 없습니다</td></tr>'}
    </tbody></table></div>`;
}

// ── 판매 관리 ──
function renderSales(){
  const ss = state.sales;
  return `<div class="page-header"><h2>판매 관리 (${ss.length}건)</h2><button class="btn" onclick="openSaleModal()">+ 판매 등록</button></div>
  <div class="table-container"><table class="table">
    <thead><tr><th>고객</th><th>품목</th><th>수량</th><th>금액</th><th>결제</th><th>액션</th></tr></thead>
    <tbody>${ss.length? ss.map(s=>`<tr>
      <td>${esc(custName(s.customer_id))}</td><td>${esc(s.item_name)}</td><td>${s.quantity}</td><td>${won(s.total_price)}</td>
      <td>${s.paid?'<span class="badge completed">완료</span>':'<span class="badge assigned">미수</span>'}</td>
      <td><div style="display:flex;gap:4px">${!s.paid?`<button class="btn btn-sm btn-success" onclick="paySale(${s.id})">수금</button>`:''}<button class="btn btn-sm btn-danger" onclick="deleteSale(${s.id})">삭제</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">판매가 없습니다</td></tr>'}
    </tbody></table></div>`;
}
async function paySale(id){ await api('PUT',`/sales/${id}/pay`); await loadAll(); }
async function deleteSale(id){ if(!confirm('삭제하시겠습니까?'))return; await api('DELETE','/sales/'+id); await loadAll(); }

// ── 재고 관리 ──
function renderInventory(){
  const inv = state.inventory;
  return `<div class="page-header"><h2>재고 관리 (${inv.length}종)</h2><button class="btn" onclick="openInventoryModal()">+ 부품 추가</button></div>
  <div class="table-container"><table class="table">
    <thead><tr><th>부품명</th><th>분류</th><th>수량</th><th>단가</th><th>공급처</th><th>액션</th></tr></thead>
    <tbody>${inv.length? inv.map(i=>`<tr style="${i.quantity<=i.reorder_level?'background:#fff5f5':''}">
      <td><strong>${esc(i.part_name)}</strong></td><td>${esc(i.category)||'-'}</td>
      <td>${i.quantity}${i.quantity<=i.reorder_level?' <span class="badge assigned">부족</span>':''}</td>
      <td>${won(i.unit_price)}</td><td>${esc(i.supplier)||'-'}</td>
      <td><div style="display:flex;gap:4px"><button class="btn btn-sm btn-secondary" onclick="openInventoryModal(${i.id})">수정</button><button class="btn btn-sm btn-danger" onclick="deleteInventory(${i.id})">삭제</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">재고가 없습니다</td></tr>'}
    </tbody></table></div>`;
}
async function deleteInventory(id){ if(!confirm('삭제하시겠습니까?'))return; await api('DELETE','/inventory/'+id); await loadAll(); }

// ── 미수금 · 결제 (회계 장부: 어떤 작업으로 어떻게 입금됐는지) ──
const PAY_METHODS = { cash:'현금', card:'카드', transfer:'계좌이체', unpaid:'미수' };
function payMethodLabel(m){ return PAY_METHODS[m] || m || '-'; }
function renderPayments(){
  const ps = state.payments;
  const paid    = ps.filter(p=>p.payment_status==='completed');
  const unpaid  = ps.filter(p=>p.payment_status!=='completed');
  const sum = arr => arr.reduce((s,p)=>s+(Number(p.amount)||0),0);
  const payName = p => esc(p.customer_name) || esc(p.company_name) || esc(p.customer_phone) || (p.customer_id?`고객${p.customer_id}`:'-');
  return `<div class="page-header"><h2>미수금 · 결제 (${ps.length}건)</h2></div>
  <div class="stat-grid">
    ${statCard('총 입금완료', won(sum(paid)), 'var(--success)', 20)}
    ${statCard('총 미수금', won(sum(unpaid)), unpaid.length?'var(--danger)':'', 20)}
    ${statCard('총 매출', won(sum(ps)), '', 20)}
  </div>
  <div class="table-container"><table class="table">
    <thead><tr><th>완료일</th><th>고객</th><th>작업 내용</th><th>결제수단</th><th>금액</th><th>상태</th></tr></thead>
    <tbody>${ps.length? ps.map(p=>`<tr>
      <td style="font-size:12px;color:var(--gray-500)">${p.completed_at?(p.completed_at).slice(0,10):(esc(p.due_date)||'-')}</td>
      <td><strong>${payName(p)}</strong></td>
      <td>${esc(p.work_description)||'-'}</td>
      <td><span class="chip">${payMethodLabel(p.payment_method)}</span></td>
      <td><strong>${won(p.amount)}</strong></td>
      <td><span class="badge ${p.payment_status==='completed'?'completed':'assigned'}">${p.payment_status==='completed'?'입금완료':'미수'}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">회계 내역이 없습니다</td></tr>'}
    </tbody></table></div>`;
}

// ── 통계 ──
function renderStats(){
  const s = state.stats; if(!s) return '<div class="loading">불러오는 중...</div>';
  return `
  <div class="stat-grid">
    ${statCard('총 고객', s.total_customers)}
    ${statCard('총 접수', s.total_receptions)}
    ${statCard('완료 작업', s.completed_jobs)}
    ${statCard('수리 매출', won(s.repair_revenue), '', 20)}
    ${statCard('판매 매출', won(s.sales_revenue), '', 20)}
    ${statCard('총 매출', won(s.total_revenue), 'var(--success)', 20)}
    ${statCard('총 미수금', won(s.total_outstanding), 'var(--danger)', 20)}
  </div>
  <div class="split" style="grid-template-columns:1fr 1fr">
    <div class="detail-panel" style="position:static"><h3>기사별 실적</h3>
      ${(s.engineer_stats||[]).map(e=>`<div class="detail-row"><span class="detail-value"><strong>${esc(e.name)}</strong></span><span class="detail-value" style="text-align:right">완료 ${e.completed_jobs}건 · ${won(e.revenue)}</span></div>`).join('')||'<div class="empty-state">데이터 없음</div>'}
    </div>
    <div class="detail-panel" style="position:static"><h3>접수 채널</h3>
      ${Object.entries(s.channel_counts||{}).map(([k,v])=>`<div class="detail-row"><span class="detail-value">${({phone:'전화',sms:'SMS',kakao:'카카오톡',direct:'직접등록'})[k]||k}</span><span class="detail-value" style="text-align:right">${v}건</span></div>`).join('')||'<div class="empty-state">데이터 없음</div>'}
    </div>
  </div>`;
}

function row(label,value){ return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`; }

// 현재 페이지만 다시 그림 (모달 안 열렸을 때)
function renderInto(){ if(!document.querySelector('.modal-overlay')) render(); }
