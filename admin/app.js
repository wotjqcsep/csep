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
function fmtRecDay(t){ const d=recDate(t); return d? `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : (t? String(t).slice(5,10) : ''); }
function recCard(r){
  const c = custObj(r.customer_id) || {};
  const st = REC_ST[r.status] || { l:r.status, c:'var(--gray-500)' };
  const phone = r.reception_phone || c.phone || '';
  const addr = [c.address, c.address_detail].filter(Boolean).join(' ');
  const ch = ({phone:'📞',sms:'💬',kakao:'💭',direct:'📋'})[r.reception_channel] || '📋';
  return `<div class="ws-card ${r.status}">
    <div class="ws-head">
      <div class="ws-name">${esc(custName(r.customer_id))} <span style="font-size:13px;font-weight:400;color:var(--gray-400)">${ch}</span></div>
      <div style="text-align:right;flex-shrink:0">
        <div style="display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap">
          ${(r.picked_up && r.status!=='completed')?`<span class="ws-pill" style="background:#7048e8">수거·견적</span>`:''}
          ${r.reserved_date?`<span class="ws-pill" style="background:var(--warning)">예약</span>`:''}
          <span class="ws-pill" style="background:${st.c}">${st.l}</span>
        </div>
        ${r.reserved_date?`<div style="font-size:11px;color:var(--gray-500);margin-top:4px">접수 ${fmtRecDay(r.received_at)} · 처리예정 <strong style="color:var(--warning)">${esc(r.reserved_date)}</strong></div>`:''}
      </div>
    </div>
    <div class="ws-row"><span class="ic">👤</span><span>담당: ${r.assigned_engineer_id?esc(engName(r.assigned_engineer_id)):'<span style="color:var(--gray-400)">미지정</span>'}</span></div>
    ${r.symptom?`<div class="ws-row"><span class="ic">🔧</span><span>${esc(r.symptom)}</span></div>`:''}
    ${phone?`<div class="ws-row"><span class="ic">📞</span><span>${esc(phone)}</span></div>`:''}
    ${addr?`<div class="ws-row"><span class="ic">📍</span><span>${esc(addr)}</span></div>`:''}
    ${(r.solution||r.initial_memo)?`<div class="ws-memo">${esc(r.solution||r.initial_memo)}</div>`:''}
    <div class="ws-actions">
      <button class="btn btn-sm" style="background:#1971c2" onclick="openReceptionDetail(${r.id})">🔍 상세보기</button>
      ${r.status!=='completed'?`<button class="btn btn-sm" onclick="openEngineerChange(${r.id})">👤 기사 변경</button>
      <button class="btn btn-sm" style="background:#7048e8" onclick="openScheduleChange(${r.id})">📅 일정 변경</button>`:''}
      <button class="btn btn-sm btn-secondary" onclick="openAdminChat(${r.id})">💬 대화${adminChatUnread[r.id]?` (${adminChatUnread[r.id]})`:''}</button>
      <button class="btn btn-sm btn-danger" onclick="cancelReception(${r.id})">✕ 취소</button>
    </div>
    <div class="ws-time">${fmtRecTime(r.received_at)}</div>
  </div>`;
}
// 구간 분류: 완료 → 완료칸 / 예약일 있고 미완료 → 예약칸 / 그 외 미완료 → 미처리칸
function recSection(r){
  if(r.status==='cancelled') return 'cancelled';
  if(r.status==='completed') return 'completed';
  if(r.reserved_date) return 'reserved';
  return 'pending';
}
function renderReceptions(){
  const rs = state.receptions;
  const byDesc = (a,b)=>(b.received_at||'').localeCompare(a.received_at||'');  // 처리(접수) 날짜순, 최신 위
  // 완료 후 24시간 지난 건은 작업현황에서 숨김(일정표에서 확인)
  const within24h = r => { const d=recDate(r.completed_at||r.received_at); return !d || (Date.now()-d.getTime()) <= 24*60*60*1000; };
  // 진행중(기사가 네비 실행 등)은 미처리에서 분리해 맨 위로
  const inProgress= rs.filter(r=>recSection(r)==='pending' && r.status==='in_progress').sort(byDesc);
  const pending   = rs.filter(r=>recSection(r)==='pending' && r.status!=='in_progress').sort(byDesc);
  const reserved  = rs.filter(r=>recSection(r)==='reserved').sort(byDesc);
  const completed = rs.filter(r=>recSection(r)==='completed' && within24h(r)).sort(byDesc);
  // 구간 헤더(구분선) + 2열 카드
  const section = (title, color, list) => list.length
    ? `<div class="ws-sec" style="--sec:${color}"><span style="background:${color}">${title} ${list.length}</span></div><div class="ws-grid">${list.map(recCard).join('')}</div>`
    : '';
  const body = [
    section('🔵 진행중', '#1971c2',        inProgress),  // 맨 위
    section('🔴 미처리', 'var(--danger)',  pending),
    section('🟡 예약',   'var(--warning)', reserved),
    section('🟢 완료',   'var(--success)', completed),   // 맨 아래
  ].join('');
  return `
  <div class="page-header"><h2>📋 전체 작업현황 (${rs.length}건)</h2><button class="btn" onclick="openReceptionModal()">+ 접수 등록</button></div>
  <div class="ws-wrap">
    ${rs.length ? body : '<div class="empty-state">접수가 없습니다</div>'}
  </div>`;
}
async function setRecStatus(id,status){ await api('PUT',`/receptions/${id}/status?status=${status}`); await loadAll(); }
// 콜 취소 — 삭제 아님, '취소됨'으로 기록 보존
async function cancelReception(id){
  const reason = prompt('취소 사유 (선택):', '');
  if(reason===null) return;  // 취소 눌림
  try{ await api('PUT',`/receptions/${id}/cancel`, { reason }); }
  catch(e){ alert('취소 실패: '+(e&&e.message?e.message:e)); return; }
  await loadAll();
}
// 기사 변경 (재배정)
function openEngineerChange(recId){
  const r=state.receptions.find(x=>x.id==recId); if(!r) return;
  const body=`
    <div style="margin-bottom:12px;font-size:13px;color:var(--gray-600)">고객: <strong>${esc(custName(r.customer_id))}</strong></div>
    <div class="form-group"><label>담당 기사</label><select id="ec_eng">
      <option value="">선택하세요</option>
      ${state.engineers.map(e=>`<option value="${e.id}" ${r.assigned_engineer_id==e.id?'selected':''}>${esc(e.name)}${e.is_admin?' (대표)':''}</option>`).join('')}
    </select></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="doEngineerChange(${recId})">변경</button></div>`;
  modal(`👤 기사 변경 - ${esc(custName(r.customer_id))}`, body);
}
async function doEngineerChange(recId){
  const eng=v('ec_eng'); if(!eng){ alert('기사를 선택하세요'); return; }
  await api('PUT',`/receptions/${recId}/assign?engineer_id=${eng}`);
  closeModal(); await loadAll();
}
// 일정(예약일) 변경
function openScheduleChange(recId){
  const r=state.receptions.find(x=>x.id==recId); if(!r) return;
  const body=`
    <div style="margin-bottom:12px;font-size:13px;color:var(--gray-600)">고객: <strong>${esc(custName(r.customer_id))}</strong></div>
    <div class="form-group"><label>처리 예정일 (예약일)</label><input type="date" id="sc_date" value="${esc(r.reserved_date)||''}"></div>
    <div class="form-actions" style="justify-content:space-between">
      <button class="btn btn-secondary" onclick="doScheduleChange(${recId},true)">예약 해제</button>
      <div style="display:flex;gap:8px"><button class="btn btn-secondary" onclick="closeModal()">닫기</button><button class="btn" onclick="doScheduleChange(${recId},false)">저장</button></div>
    </div>`;
  modal(`📅 일정 변경 - ${esc(custName(r.customer_id))}`, body);
}
async function doScheduleChange(recId, clear){
  const date = clear? '' : v('sc_date');
  await api('PUT',`/receptions/${recId}/reserve`, { reserved_date: date||null });
  closeModal(); await loadAll();
}
// 상세보기 (내용 전체) + 처리하기
async function openReceptionDetail(recId){
  const r=state.receptions.find(x=>x.id==recId); if(!r) return;
  const c=custObj(r.customer_id)||{}; const st=REC_ST[r.status]||{l:r.status,c:'var(--gray-500)'};
  const CH={phone:'전화',sms:'SMS',kakao:'카카오톡',direct:'직접등록'};
  modal(`📋 상세보기 - ${esc(custName(r.customer_id))}`, '<div class="loading">불러오는 중...</div>', true);
  let photos=[]; try{ photos=await api('GET','/receptions/'+recId+'/photos'); }catch(e){}
  const rows=[
    ['고객', custName(r.customer_id)],
    ['전화', r.reception_phone||c.phone||''],
    ['주소', [c.address,c.address_detail].filter(Boolean).join(' ')],
    ['채널', CH[r.reception_channel]||r.reception_channel||''],
    ['담당 기사', r.assigned_engineer_id?engName(r.assigned_engineer_id):'미지정'],
    ['접수일시', fmtRecTime(r.received_at)],
    ['처리 예정일', r.reserved_date||''],
    ['완료일시', r.completed_at?fmtRecTime(r.completed_at):''],
  ].filter(([,val])=>val);
  const body=`
    <div style="margin-bottom:12px">
      <span class="ws-pill" style="background:${st.c}">${st.l}</span>
      ${r.reserved_date?'<span class="ws-pill" style="background:var(--warning);margin-left:6px">예약</span>':''}
    </div>
    ${rows.map(([k,val])=>`<div class="detail-row"><span class="detail-label">${k}</span><span class="detail-value">${esc(val)}</span></div>`).join('')}
    <div class="form-section">증상 / 요청</div>
    <div style="background:var(--gray-50);border-radius:8px;padding:10px;font-size:13px;white-space:pre-wrap">${esc(r.symptom)||'-'}${r.customer_request?'\n\n[고객요청] '+esc(r.customer_request):''}${r.initial_memo?'\n\n[메모] '+esc(r.initial_memo):''}</div>
    ${photos.length?`<div class="form-section">현장 사진 (${photos.length})</div><div style="display:flex;flex-wrap:wrap;gap:6px">${photos.map(p=>`<img src="${p.photo}" style="width:92px;height:92px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--gray-200)" onclick="window.open(this.src,'_blank')">`).join('')}</div>`:''}
    <div class="form-section">처리 · 결제 (처리하기)</div>
    <textarea id="rd_sol" style="width:100%;min-height:60px" placeholder="처리한 내용을 입력하세요">${esc(r.solution||'')}</textarea>
    <div class="form-row" style="margin-top:8px">
      <div class="form-group"><label>공임비</label><input id="rd_labor" type="number" min="0" value="${r.labor_fee||''}" oninput="calcPay()"></div>
      <div class="form-group"><label>부품비</label><input id="rd_parts" type="number" min="0" value="${r.parts_fee||''}" oninput="calcPay()"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>결제수단</label><select id="rd_pm" onchange="calcPay()">
        <option value="">선택</option>
        ${['card','cash','transfer','unpaid'].map(k=>`<option value="${k}" ${r.payment_method===k?'selected':''}>${PM_LABEL[k]}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>세금계산서</label><label style="display:flex;align-items:center;gap:6px;padding-top:9px;font-size:14px"><input type="checkbox" id="rd_tax" ${r.tax_invoice?'checked':''} onchange="calcPay()"> 발급</label></div>
    </div>
    <div id="rd_calc" style="background:var(--gray-50);border-radius:8px;padding:10px;font-size:13px;margin-bottom:8px"></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" onclick="savePayment(${r.id},false)">💾 저장</button>
      ${r.status!=='completed'?`<button class="btn btn-sm btn-success" onclick="savePayment(${r.id},true)">✔ 완료 처리</button>`:''}
    </div>
    <div class="form-section"></div>
    <div class="form-actions" style="flex-wrap:wrap;gap:6px">
      ${r.status!=='completed'?`<button class="btn btn-sm" onclick="openEngineerChange(${r.id})">👤 기사 변경</button><button class="btn btn-sm" style="background:#7048e8" onclick="openScheduleChange(${r.id})">📅 일정 변경</button>`:''}
      <button class="btn btn-sm btn-secondary" onclick="openAdminChat(${r.id})">💬 대화</button>
      <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
    </div>`;
  modal(`📋 상세보기 - ${esc(custName(r.customer_id))}`, body, true);
  calcPay();
}
function calcPay(){
  const labor=Number(v('rd_labor'))||0, parts=Number(v('rd_parts'))||0, pm=v('rd_pm');
  const tax=document.getElementById('rd_tax') && document.getElementById('rd_tax').checked;
  const rev=labor+parts, woori=(pm==='card'||tax)?Math.round(rev*0.15):0, mine=rev-woori;
  const el=document.getElementById('rd_calc'); if(!el) return;
  el.innerHTML = `매출 <strong>${won(rev)}</strong>`
    + (woori?` · <span style="color:var(--warning)">우리사무기 15% ${won(woori)}</span>`:'')
    + ` · <span style="color:var(--success)">정산액 <strong>${won(mine)}</strong></span>`
    + ((pm==='card'||tax)&&rev?`<div style="font-size:11px;color:var(--gray-400);margin-top:4px">※ 카드/계산서 → 매출은 우리사무기 경유, 나중에 ${won(mine)} 현금 정산 받음</div>`:'');
}
async function savePayment(recId, complete){
  const tax = !!(document.getElementById('rd_tax') && document.getElementById('rd_tax').checked);
  const data={ labor_fee:Number(v('rd_labor'))||0, parts_fee:Number(v('rd_parts'))||0, payment_method:v('rd_pm')||null, tax_invoice:tax, solution:v('rd_sol'), complete: !!complete };
  if(complete && !data.payment_method){ if(!confirm('결제수단이 없습니다. 그래도 완료할까요?')) return; }
  else if(complete && !confirm('완료 처리하시겠습니까?')) return;
  try{ await api('PUT',`/receptions/${recId}/payment`, data); }
  catch(e){ alert('저장 실패: '+(e&&e.message?e.message:e)); return; }
  closeModal(); await loadAll();
}
async function saveSolution(recId, complete){
  const solution=v('rd_sol');
  if(complete && !confirm('완료 처리하시겠습니까?')) return;
  try{ await api('PUT',`/receptions/${recId}/solution`, { solution, complete: !!complete }); }
  catch(e){ alert('저장 실패: '+(e&&e.message?e.message:e)); return; }
  closeModal(); await loadAll();
}

// ============================================================
//  거래처 (customers 재사용) + 현장(sites)
// ============================================================
let vendorState = { search:'' };
function sitesOf(cid){ return (state.sites||[]).filter(s=>s.customer_id==cid); }
function vdName(c){ return c.company_name || c.name || c.phone || ('거래처'+c.id); }
function siteStatusBadge(s){ const off=s.status==='inactive'; return `<span class="vd-sbadge" style="background:${off?'var(--gray-200)':'#e7f5ff'};color:${off?'var(--gray-600)':'#1971c2'}">${off?'해지':'사용'}</span>`; }
function siteCard(s){
  const addr=[s.address,s.address_detail].filter(Boolean).join(' ');
  return `<div class="vd-site">
    <div class="vd-head">
      <div class="vd-title"><span class="vd-badge">현장</span> ${esc(s.name)} ${siteStatusBadge(s)}</div>
      <div class="vd-btns">
        <button class="btn btn-sm" style="background:var(--warning)" onclick="openVendorHistory(${s.customer_id})">📋 이력</button>
        <button class="btn btn-sm" onclick="openSiteModal(${s.customer_id},${s.id})">✏ 수정</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSite(${s.id})">🗑 삭제</button>
      </div>
    </div>
    <div class="vd-row"><span class="ic">📞</span>${esc(s.phone)||'-'}<span class="ic" style="margin-left:8px">👤</span>${esc(s.contact_person)||'-'}</div>
    ${addr?`<div class="vd-row"><span class="ic">📍</span>${esc(addr)}</div>`:''}
  </div>`;
}
function vendorCard(c){
  const sites=sitesOf(c.id);
  const addr=[c.address,c.address_detail].filter(Boolean).join(' ');
  return `<div class="vd-card">
    <div class="vd-head">
      <div class="vd-title">${esc(vdName(c))}${sites.length?`<span class="vd-sub">· 현장 ${sites.length}곳</span>`:''}</div>
      <div class="vd-btns">
        <button class="btn btn-sm" style="background:var(--warning)" onclick="openVendorHistory(${c.id})">📋 이력</button>
        <button class="btn btn-sm" style="background:#0ca678" onclick="openVendorDevices(${c.id})">🖥 장치정보</button>
        <button class="btn btn-sm" style="background:#7048e8" onclick="openSiteModal(${c.id})">🏢 현장추가</button>
        <button class="btn btn-sm" onclick="openCustomerModal(${c.id})">✏ 수정</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVendor(${c.id})">🗑 삭제</button>
      </div>
    </div>
    <div class="vd-row"><span class="ic">📞</span>${esc(c.phone)||'-'}<span class="ic" style="margin-left:8px">👤</span>${esc(c.contact_person)||'-'}</div>
    ${addr?`<div class="vd-row"><span class="ic">📍</span>${esc(addr)}</div>`:''}
    ${sites.map(siteCard).join('')}
  </div>`;
}
function vendorResultsHtml(){
  const q=vendorState.search.trim().toLowerCase();
  let list=state.customers;
  if(q) list=list.filter(c=>vdName(c).toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.name||'').toLowerCase().includes(q)||(c.address||'').toLowerCase().includes(q));
  const shown=list.slice(0,80);
  return list.length
    ? shown.map(vendorCard).join('') + (list.length>80?`<div class="empty-state" style="padding:14px">외 ${list.length-80}건 — 검색어를 입력해 좁히세요</div>`:'')
    : '<div class="empty-state">거래처가 없습니다</div>';
}
function renderVendors(){
  return `
  <div class="page-header"><h2>🏢 거래처 검색 (${state.customers.length})</h2><button class="btn" onclick="openCustomerModal()">+ 거래처 등록</button></div>
  <div class="vd-wrap">
    <input class="vd-search" placeholder="거래처명 입력..." value="${esc(vendorState.search)}" oninput="vendorState.search=this.value;document.getElementById('vd_results').innerHTML=vendorResultsHtml()">
    <div id="vd_results">${vendorResultsHtml()}</div>
  </div>`;
}
function openSiteModal(customerId, siteId){
  const s = siteId? (state.sites.find(x=>x.id==siteId)||{}) : { customer_id:customerId };
  const cust = state.customers.find(x=>x.id==customerId)||{};
  const body=`
    <div style="margin-bottom:10px;font-size:13px;color:var(--gray-500)">거래처: <strong>${esc(vdName(cust))}</strong></div>
    ${field('s_name','현장명 *',s.name)}
    <div class="form-row">${field('s_contact','담당자',s.contact_person)}${field('s_phone','전화번호',s.phone)}</div>
    ${field('s_addr','주소',s.address)}
    ${field('s_addr2','상세주소',s.address_detail)}
    <div class="form-group"><label>상태</label><select id="s_status"><option value="active" ${s.status!=='inactive'?'selected':''}>사용</option><option value="inactive" ${s.status==='inactive'?'selected':''}>해지</option></select></div>
    ${area('s_memo','메모',s.memo)}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveSite(${customerId},${siteId||'null'})">저장</button></div>`;
  modal(siteId?'현장 수정':'현장 추가', body);
}
async function saveSite(customerId, siteId){
  const data={ customer_id:customerId, name:v('s_name'), contact_person:v('s_contact'), phone:v('s_phone'), address:v('s_addr'), address_detail:v('s_addr2'), status:v('s_status'), memo:v('s_memo') };
  if(!data.name){ alert('현장명은 필수입니다'); return; }
  if(siteId) await api('PUT','/sites/'+siteId, data); else await api('POST','/sites', data);
  closeModal(); await loadAll();
}
async function deleteSite(id){ if(!confirm('이 현장을 삭제하시겠습니까?'))return; await api('DELETE','/sites/'+id); await loadAll(); }
async function deleteVendor(id){ if(!confirm('이 거래처를 삭제하시겠습니까? (현장도 함께 삭제됩니다)'))return; await api('DELETE','/customers/'+id); await loadAll(); }
async function openVendorHistory(customerId){
  const cust=state.customers.find(x=>x.id==customerId)||{};
  modal(`📋 이력 - ${esc(vdName(cust))}`, '<div class="loading">불러오는 중...</div>', true);
  let rows=[];
  try{ rows=await api('GET','/customers/'+customerId+'/receptions'); }catch(e){}
  const body=`${rows.length? `<div class="table-container"><table class="table"><thead><tr><th>일시</th><th>증상</th><th>상태</th><th>담당</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td style="font-size:12px">${fmtRecTime(r.received_at)}</td><td>${esc(r.symptom)||'-'}</td><td>${statusLabel(r.status)}</td><td>${r.assigned_engineer_id?esc(engName(r.assigned_engineer_id)):'-'}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty-state">이력이 없습니다</div>'}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">닫기</button></div>`;
  modal(`📋 이력 - ${esc(vdName(cust))}`, body, true);
}
// 거래처 장치정보 (컴퓨터/NAS/공유기/프린터 등 = computers 재사용)
async function openVendorDevices(customerId){
  const cust=state.customers.find(c=>c.id==customerId)||{};
  modal(`🖥 장치정보 - ${esc(vdName(cust))}`, '<div class="loading">불러오는 중...</div>', true);
  let comps=[];
  try{ comps=await api('GET','/customers/'+customerId+'/computers'); }catch(e){}
  const row = cp => {
    const printers=parsePrinters(cp.printer).map(p=>`${p.name}${p.ip?' ('+p.ip+')':''}`).filter(Boolean).join(', ');
    const specs=[['CPU',cp.cpu],['RAM',specSummary('ram',cp.ram)],['SSD',specSummary('ssd',cp.ssd)],['HDD',specSummary('hdd',cp.hdd)],['메인보드',mbSummary(cp.motherboard)],['VGA',cp.gpu],['모니터',cp.monitor],['OS',cp.os],['Office',cp.office_version],['CAD',cp.cad],['Adobe',cp.adobe],['기타1',cp.etc_program1],['기타2',cp.etc_program2],['IP',cp.ip_address],['MAC',cp.mac_address],['프린터',printers],['NAS',cp.nas_name?`${cp.nas_name}${cp.nas_ip?' ('+cp.nas_ip+')':''}${cp.nas_partition_info?' · 파티션 '+cp.nas_partition_info:''}`:''],['공유기',cp.router_name?`${cp.router_name}${cp.router_ip?' ('+cp.router_ip+')':''}${cp.router_hub_count?' · 허브 '+cp.router_hub_count:''}`:''],['시리얼',cp.serial_number],['보증만료',cp.warranty_expiry],['메모',cp.notes]].filter(([,val])=>val);
    return `<div style="border:1px solid var(--gray-200);border-radius:9px;padding:11px 13px;margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;${specs.length?'margin-bottom:8px':''}">
        <div><span class="badge new" style="margin-right:6px">${DEVICE_TYPES[cp.device_type]||cp.device_type}</span><strong>${esc(cp.name)||'(이름없음)'}</strong></div>
        <div style="display:flex;gap:5px;flex-shrink:0"><button class="btn btn-sm btn-secondary" onclick="openComputerModal(${cp.id},${customerId})">수정</button><button class="btn btn-sm btn-danger" onclick="deleteComputer(${cp.id})">삭제</button></div>
      </div>
      ${specs.length?`<div style="font-size:12px;color:var(--gray-600);display:grid;grid-template-columns:1fr 1fr;gap:3px 14px">${specs.map(([k,val])=>`<div><span style="color:var(--gray-400)">${k}</span> ${esc(val)}</div>`).join('')}</div>`:''}
    </div>`;
  };
  const body=`
    ${comps.length? comps.map(row).join('') : '<div class="empty-state" style="padding:24px">등록된 장치가 없습니다</div>'}
    <div class="form-actions" style="justify-content:space-between">
      <button class="btn" onclick="openComputerModal(null,${customerId})">+ 장치 추가</button>
      <button class="btn btn-secondary" onclick="closeModal()">닫기</button>
    </div>`;
  modal(`🖥 장치정보 - ${esc(vdName(cust))}`, body, true);
}

// ============================================================
//  작업지시 보내기 (거래처 선택 → 작업지시 전송/배당)
// ============================================================
let woListState = { search:'' };
function woVendorCard(c){
  const sites=sitesOf(c.id);
  const addr=[c.address,c.address_detail].filter(Boolean).join(' ');
  return `<div class="vd-card" style="cursor:pointer" onclick="openWorkorderModal(${c.id})">
    <div class="vd-title">${esc(vdName(c))}</div>
    <div class="vd-row"><span class="ic">📞</span>${esc(c.phone)||'-'}${addr?`<span class="ic" style="margin-left:8px">📍</span>${esc(addr)}`:''}</div>
    ${sites.map(s=>`<div class="vd-site" style="cursor:pointer" onclick="event.stopPropagation();openWorkorderModal(${c.id},${s.id})">
      <div class="vd-title"><span class="vd-badge">현장</span> ${esc(s.name)}</div>
      <div class="vd-row"><span class="ic">📞</span>${esc(s.phone)||'-'}${[s.address,s.address_detail].filter(Boolean).join(' ')?`<span class="ic" style="margin-left:8px">📍</span>${esc([s.address,s.address_detail].filter(Boolean).join(' '))}`:''}</div>
    </div>`).join('')}
  </div>`;
}
function woResultsHtml(){
  const q=woListState.search.trim().toLowerCase();
  // 거래처가 많을 수 있으므로 검색어가 있을 때만 목록 렌더 (필드서비스 방식)
  if(!q) return `<div class="empty-state" style="padding:50px 20px">🔎 거래처명·전화번호·주소를 입력하면<br>작업지시할 거래처가 표시됩니다</div>`;
  const list=state.customers.filter(c=>vdName(c).toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.name||'').toLowerCase().includes(q)||(c.address||'').toLowerCase().includes(q));
  const shown=list.slice(0,50);
  return list.length
    ? shown.map(woVendorCard).join('') + (list.length>50?`<div class="empty-state" style="padding:14px">외 ${list.length-50}건 — 검색어를 더 입력하세요</div>`:'')
    : `<div class="empty-state">"${esc(woListState.search)}" 검색 결과가 없습니다</div>`;
}
function renderWorkorders(){
  return `
  <div class="page-header"><h2>➕ 작업지시 보내기</h2></div>
  <div class="vd-wrap">
    <input class="vd-search" placeholder="거래처명 입력..." value="${esc(woListState.search)}" oninput="woListState.search=this.value;document.getElementById('wo_results').innerHTML=woResultsHtml()">
    <div id="wo_results">${woResultsHtml()}</div>
  </div>`;
}
async function openWorkorderModal(customerId, siteId){
  const cust=state.customers.find(c=>c.id==customerId)||{};
  const site=siteId? state.sites.find(s=>s.id==siteId):null;
  const title=site? `${vdName(cust)} · ${site.name}` : vdName(cust);
  modal(`📋 ${esc(title)}`, '<div class="loading">불러오는 중...</div>', true);
  let comps=[], hist=[];
  try{ comps=await api('GET','/customers/'+customerId+'/computers'); }catch(e){}
  try{ hist=await api('GET','/customers/'+customerId+'/receptions'); }catch(e){}
  const body=`
    <div style="color:var(--warning);font-weight:700;margin-bottom:8px">📁 수리/점검 이력 (${hist.length}건)</div>
    ${hist.length
      ? `<div style="max-height:150px;overflow-y:auto;margin-bottom:14px;border:1px solid var(--gray-200);border-radius:8px;padding:8px 10px">${hist.map(r=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--gray-100)"><span class="badge ${r.status}" style="font-size:10px">${statusLabel(r.status)}</span> ${esc(r.symptom)||'-'} <span style="color:var(--gray-400);float:right">${(r.received_at||'').slice(0,10)}</span></div>`).join('')}</div>`
      : '<div style="text-align:center;color:var(--gray-400);padding:14px 0;margin-bottom:8px">이전 이력이 없습니다</div>'}
    <div style="color:#7048e8;font-weight:700;margin:6px 0 10px">➕ 작업지시 작성</div>
    <div class="form-group"><label>장비 선택 (선택사항)</label><select id="wo_comp"><option value="">선택 안함</option>${comps.map(c=>`<option value="${c.id}">${esc(c.name)||'장비'} · ${DEVICE_TYPES[c.device_type]||c.device_type}</option>`).join('')}</select></div>
    <div class="form-group"><label>작업 구분 (선택사항)</label><select id="wo_type"><option value="일반">일반</option><option value="점검">점검</option><option value="수리">수리</option><option value="설치">설치</option><option value="기타">기타</option></select></div>
    <div class="form-group"><label>담당 기사 *</label><select id="wo_eng"><option value="">선택하세요</option>${state.engineers.map(e=>`<option value="${e.id}">${esc(e.name)}${e.is_admin?' (대표)':''}</option>`).join('')}</select></div>
    ${area('wo_symptom','증상 또는 작업 내용 *','')}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn btn-success" onclick="submitWorkorder(${customerId},${siteId||'null'})">📤 작업지시 전송</button></div>`;
  modal(`📋 ${esc(title)}`, body, true);
}
async function submitWorkorder(customerId, siteId){
  const symptom=v('wo_symptom'); if(!symptom){ alert('증상 또는 작업 내용을 입력하세요'); return; }
  const eng=v('wo_eng'); if(!eng){ alert('담당 기사를 선택하세요'); return; }
  const comp=v('wo_comp'); const type=v('wo_type');
  const site=siteId? state.sites.find(s=>s.id==siteId):null;
  const memo=[type&&type!=='일반'?`[${type}]`:'', site?`현장:${site.name}`:''].filter(Boolean).join(' ');
  const rec=await api('POST','/receptions',{ customer_id:customerId, computer_id:comp?Number(comp):null, reception_channel:'direct', symptom, initial_memo:memo });
  await api('PUT',`/receptions/${rec.id}/assign?engineer_id=${eng}`);
  closeModal(); alert('작업지시를 전송했습니다.'); await loadAll();
}

// ============================================================
//  부품 데이터 (수동 추가 → 드롭다운 반영)
// ============================================================
let partForm = { kind:'cpu' };
const PART_KINDS = {
  cpu: { label:'CPU', g1:{label:'플랫폼',opts:['Intel','AMD']}, g2:'세대/소켓 (예: 15세대, AM6)', val:'모델명 (예: Core i5-15400)' },
  vga: { label:'VGA (그래픽)', g1:{label:'제조사',opts:['NVIDIA','AMD','Intel Arc','내장 그래픽']}, g2:'시리즈 (예: RTX 50)', val:'모델명 (예: RTX 5060)' },
  mbmaker: { label:'메인보드 제조사', simple:true, val:'제조사 (예: ASUS)' },
  ram: { label:'RAM 제조사', simple:true, val:'제조사 (예: 삼성)' },
  ssd: { label:'SSD 제조사/모델', simple:true, val:'제조사/모델 (예: 삼성 990 PRO)' },
  hdd: { label:'HDD 제조사', simple:true, val:'제조사 (예: WD)' },
  os: { label:'OS', simple:true, val:'예: Windows 11 Pro' },
  office: { label:'Office', simple:true, val:'예: Office 2021' },
};
function renderPartsdata(){   // ⚠️ 이름은 renderPartsdata(소문자 d) — menu.js pageRenderer가 'partsdata'→'renderPartsdata'로 찾음
  const k=partForm.kind; const cfg=PART_KINDS[k];
  const list=(state.partOptions||[]).filter(o=>o.kind===k);
  return `
  <div class="page-header"><h2>🧩 부품 데이터 · 설정</h2></div>
  <div class="vd-wrap">
    <div class="vd-card">
      <div style="font-weight:800;margin-bottom:10px">🚗 출장비 기본금액</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="pd_visitfee" type="number" min="0" value="${esc((state.settings||{}).visit_fee||'')}" placeholder="예: 30000" style="flex:1;padding:9px 12px;border:1px solid var(--gray-300);border-radius:8px">
        <button class="btn" onclick="saveVisitFee()">저장</button>
      </div>
      <div style="font-size:12px;color:var(--gray-400);margin-top:6px">거절·비용청구 콜취소 시 기본으로 청구되는 금액 (현장에서 변경 가능)</div>
    </div>
    <div class="vd-card">
      <div style="font-weight:800;margin-bottom:12px">새 부품 추가 <span style="font-weight:400;color:var(--gray-500);font-size:12px">— 추가하면 장치정보 드롭다운에 바로 나타납니다</span></div>
      <div class="form-group"><label>종류</label><select id="pd_kind" onchange="partForm.kind=this.value;renderInto()">
        ${Object.entries(PART_KINDS).map(([kk,c])=>`<option value="${kk}" ${k===kk?'selected':''}>${c.label}</option>`).join('')}
      </select></div>
      ${cfg.simple?'':`<div class="form-row">
        <div class="form-group"><label>${cfg.g1.label}</label><select id="pd_g1">${cfg.g1.opts.map(o=>`<option>${o}</option>`).join('')}</select></div>
        <div class="form-group"><label>${cfg.g2}</label><input id="pd_g2" placeholder="${cfg.g2}"></div>
      </div>`}
      <div class="form-group"><label>${cfg.val}</label><input id="pd_val" placeholder="${cfg.val}" onkeydown="if(event.key==='Enter')addPartOption()"></div>
      <button class="btn" onclick="addPartOption()">+ 추가</button>
    </div>
    <div class="vd-card">
      <div style="font-weight:800;margin-bottom:10px">추가된 ${cfg.label} 목록 (${list.length})</div>
      ${list.length? list.map(o=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:13px">
        <span>${o.grp?`<span class="chip">${esc((o.grp||'').replace('||',' · '))}</span> `:''}${esc(o.value)}</span>
        <button class="btn btn-sm btn-danger" onclick="deletePartOption(${o.id})">삭제</button></div>`).join('') : '<div class="empty-state">추가된 항목이 없습니다</div>'}
    </div>
    <div class="vd-card">
      <div style="font-weight:800;margin-bottom:4px">📝 처리 결과 프리셋 (${(state.resultPresets||[]).length})</div>
      <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px">기사앱 작업처리 화면에서 클릭 한 번으로 입력되는 문구입니다. (예: ✓ 재부팅/정상화)</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="pd_preset" placeholder="예: 랜선 교체" style="flex:1;padding:9px 12px;border:1px solid var(--gray-300);border-radius:8px" onkeydown="if(event.key==='Enter')addResultPreset()">
        <button class="btn" onclick="addResultPreset()">+ 추가</button>
      </div>
      ${(state.resultPresets||[]).length? state.resultPresets.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:13px">
        <span>✓ ${esc(p.text)}</span>
        <span style="display:flex;gap:6px"><button class="btn btn-sm btn-secondary" onclick="editResultPreset(${p.id})">수정</button><button class="btn btn-sm btn-danger" onclick="deleteResultPreset(${p.id})">삭제</button></span>
      </div>`).join('') : '<div class="empty-state">등록된 프리셋이 없습니다</div>'}
    </div>
  </div>`;
}
async function addResultPreset(){
  const t=(v('pd_preset')||'').trim(); if(!t){ alert('문구를 입력하세요'); return; }
  try{ await api('POST','/result-presets',{text:t}); }catch(e){ alert('추가 실패: '+(e&&e.message?e.message:e)); return; }
  await loadAll();
}
async function editResultPreset(id){
  const p=(state.resultPresets||[]).find(x=>x.id==id); if(!p) return;
  const t=prompt('문구 수정:', p.text||''); if(t===null) return;
  if(!t.trim()){ alert('빈 문구는 저장할 수 없습니다'); return; }
  try{ await api('PUT','/result-presets/'+id,{text:t.trim()}); }catch(e){ alert('수정 실패: '+(e&&e.message?e.message:e)); return; }
  await loadAll();
}
async function deleteResultPreset(id){
  if(!confirm('이 프리셋을 삭제하시겠습니까?')) return;
  try{ await api('DELETE','/result-presets/'+id); }catch(e){ alert('삭제 실패'); return; }
  await loadAll();
}
async function addPartOption(){
  const k=partForm.kind, cfg=PART_KINDS[k], val=v('pd_val');
  if(!val){ alert('값을 입력하세요'); return; }
  const grp = cfg.simple ? '' : [v('pd_g1'),v('pd_g2')].filter(Boolean).join('||');
  try{ await api('POST','/part-options',{kind:k, grp, value:val}); }catch(e){ alert('추가 실패: '+(e&&e.message?e.message:e)); return; }
  const el=document.getElementById('pd_val'); if(el)el.value='';
  await loadAll();
}
async function deletePartOption(id){ if(!confirm('삭제하시겠습니까?'))return; await api('DELETE','/part-options/'+id); await loadAll(); }
async function saveVisitFee(){ await api('PUT','/settings/visit_fee',{value:v('pd_visitfee')||'0'}); await loadAll(); alert('출장비 기본금액이 저장되었습니다.'); }

// ============================================================
//  일정표 (달력)
// ============================================================
let scheduleState = { y:null, m:null, sel:null };
const CAL_COLOR = { pending:'var(--danger)', reserved:'var(--warning)', completed:'var(--success)', cancelled:'var(--gray-400)' };
const CAL_LABEL = { pending:'미처리', reserved:'예약', completed:'완료', cancelled:'취소' };
function recCalInfo(r){
  if(r.status==='cancelled') return { date: localDateKey(r.completed_at||r.received_at), sec:'cancelled' };
  if(r.status==='completed') return { date: localDateKey(r.completed_at||r.received_at), sec:'completed' };
  if(r.reserved_date) return { date: String(r.reserved_date).slice(0,10), sec:'reserved' };
  return { date: localDateKey(r.received_at), sec:'pending' };
}
function schedMove(delta){ let m=scheduleState.m+delta, y=scheduleState.y; if(m<0){m=11;y--;} if(m>11){m=0;y++;} scheduleState.m=m; scheduleState.y=y; renderInto(); }
function renderSchedule(){
  const now=new Date();
  if(scheduleState.y==null){ scheduleState.y=now.getFullYear(); scheduleState.m=now.getMonth(); }
  const y=scheduleState.y, m=scheduleState.m, pad=n=>String(n).padStart(2,'0');
  const key=d=>`${y}-${pad(m+1)}-${pad(d)}`;
  const byDate={};
  (state.receptions||[]).forEach(r=>{ const ci=recCalInfo(r); if(!ci.date||ci.date==='-')return; (byDate[ci.date]=byDate[ci.date]||[]).push({r,sec:ci.sec}); });
  const startDow=new Date(y,m,1).getDay(), daysInMonth=new Date(y,m+1,0).getDate();
  const todayKey=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const cells=[]; for(let i=0;i<startDow;i++) cells.push(0); for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const dow=['일','월','화','수','목','금','토'];
  const legend=Object.keys(CAL_LABEL).map(s=>`<span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${CAL_COLOR[s]};margin-right:5px"></span>${CAL_LABEL[s]}</span>`).join('');
  const grid=cells.map(d=>{
    if(!d) return `<div class="cal-day empty"></div>`;
    const k=key(d), items=byDate[k]||[];
    const dots=['pending','reserved','completed','cancelled'].filter(s=>items.some(x=>x.sec===s))
      .map(s=>`<span style="width:8px;height:8px;border-radius:50%;background:${CAL_COLOR[s]};display:inline-block;margin:1px"></span>`).join('');
    const dowIdx=(startDow+d-1)%7, nc=dowIdx===0?'color:var(--danger)':dowIdx===6?'color:#1971c2':'';
    return `<div class="cal-day ${scheduleState.sel===k?'sel':''} ${k===todayKey?'today':''}" onclick="scheduleState.sel='${k}';renderInto()">
      <span class="cal-num" style="${nc}">${d}</span>
      <div class="cal-dots">${dots}${items.length?`<span style="font-size:10px;color:var(--gray-400);margin-left:3px">${items.length}</span>`:''}</div>
    </div>`;
  }).join('');
  const sel=scheduleState.sel, selItems=sel?(byDate[sel]||[]):[];
  const detail = sel
    ? `<div style="margin-top:16px"><div class="ws-sec" style="--sec:var(--primary)"><span style="background:var(--primary)">${esc(fmtRecDate(sel))} · ${selItems.length}건</span></div>
        ${selItems.length? `<div class="ws-grid">${selItems.map(x=>recCard(x.r)).join('')}</div>` : '<div class="empty-state">이 날짜의 내역이 없습니다</div>'}</div>`
    : '<div class="empty-state" style="margin-top:14px">날짜를 누르면 해당 내역이 표시됩니다</div>';
  return `
  <div class="page-header"><h2>📅 일정표</h2></div>
  <div class="cal-wrap">
    <div class="cal-head">
      <button class="btn btn-sm btn-secondary" onclick="schedMove(-1)">◀ 이전달</button>
      <strong style="font-size:17px">${y}년 ${m+1}월</strong>
      <button class="btn btn-sm btn-secondary" onclick="schedMove(1)">다음달 ▶</button>
    </div>
    <div class="cal-legend">${legend}</div>
    <div class="cal-grid">${dow.map((w,i)=>`<div class="cal-dow" style="${i===0?'color:var(--danger)':i===6?'color:#1971c2':''}">${w}</div>`).join('')}${grid}</div>
    ${detail}
  </div>`;
}

// ── 기사 관리 ──
function renderEngineers(){
  const es = state.engineers;
  return `
  <div class="page-header"><h2>👷 기사 관리 (${es.length}명)</h2><div style="display:flex;gap:8px"><button class="btn btn-secondary" onclick="go('workorders')">← 작업지시</button><button class="btn" onclick="openEngineerModal()">+ 기사 추가</button></div></div>
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
// ── 결산 (컴플러스) ──
const PM_LABEL = { card:'카드', cash:'현금', transfer:'계좌이체', unpaid:'미수금' };
function isWoori(r){ return r.payment_method==='card' || r.tax_invoice; }   // 우리사무기 경유(15%)
function recRevenue(r){ return (Number(r.labor_fee)||0)+(Number(r.parts_fee)||0)+(Number(r.visit_fee)||0); }
function wooriCut(r){ return isWoori(r)? Math.round(recRevenue(r)*0.15):0; }
function mySettle(r){ return recRevenue(r)-wooriCut(r); }
let settleState = { y:null, m:null };
function settleMove(d){ let m=settleState.m+d, y=settleState.y; if(m<0){m=11;y--;} if(m>11){m=0;y++;} settleState.m=m; settleState.y=y; renderInto(); }
async function doWooriSettle(id){ await api('PUT',`/receptions/${id}/woori-settle`,{settled:true}); await loadAll(); }
function renderPayments(){
  const now=new Date();
  if(settleState.y==null){ settleState.y=now.getFullYear(); settleState.m=now.getMonth(); }
  const y=settleState.y, m=settleState.m;
  const inMonth=r=>{ const d=recDate(r.completed_at); return d && d.getFullYear()===y && d.getMonth()===m; };
  const done=(state.receptions||[]).filter(r=>r.status==='completed' && recRevenue(r)>0);
  const md=done.filter(inMonth);
  const rev=md.reduce((s,r)=>s+recRevenue(r),0);
  const myTotal=md.reduce((s,r)=>s+mySettle(r),0);
  const wooriMonth=md.reduce((s,r)=>s+wooriCut(r),0);
  const wooriPending=done.filter(r=>isWoori(r) && !r.woori_settled);
  const wooriPendingAmt=wooriPending.reduce((s,r)=>s+mySettle(r),0);
  const unpaid=done.filter(r=>r.payment_method==='unpaid');
  const unpaidAmt=unpaid.reduce((s,r)=>s+recRevenue(r),0);
  const byPM={card:0,cash:0,transfer:0,unpaid:0}; md.forEach(r=>{ if(byPM[r.payment_method]!==undefined) byPM[r.payment_method]+=recRevenue(r); });
  const byCust={}; md.forEach(r=>{ const k=r.customer_id; const o=(byCust[k]=byCust[k]||{labor:0,parts:0,rev:0,woori:0,mine:0}); o.labor+=Number(r.labor_fee)||0; o.parts+=Number(r.parts_fee)||0; o.rev+=recRevenue(r); o.woori+=wooriCut(r); o.mine+=mySettle(r); });
  const custRows=Object.entries(byCust).sort((a,b)=>b[1].rev-a[1].rev);
  return `
  <div class="page-header"><h2>💳 결산 <span style="font-size:13px;color:var(--gray-500)">— 컴플러스</span></h2>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-sm btn-secondary" onclick="settleMove(-1)">◀</button>
      <strong>${y}년 ${m+1}월</strong>
      <button class="btn btn-sm btn-secondary" onclick="settleMove(1)">▶</button>
    </div>
  </div>
  <div class="stat-grid">
    ${statCard('이달 매출', won(rev), '', 20)}
    ${statCard('이달 정산액', won(myTotal), 'var(--success)', 20)}
    ${statCard('우리사무기 받을 정산액', won(wooriPendingAmt), wooriPendingAmt>0?'var(--warning)':'', 18)}
    ${statCard('고객 미수금', won(unpaidAmt), unpaidAmt>0?'var(--danger)':'', 18)}
  </div>
  <div class="split" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
    <div class="detail-panel" style="position:static">
      <h3>이달 결제수단별</h3>
      ${['card','cash','transfer','unpaid'].map(k=>`<div class="detail-row"><span class="detail-value">${PM_LABEL[k]}</span><span class="detail-value" style="text-align:right"><strong>${won(byPM[k])}</strong></span></div>`).join('')}
      <div class="detail-row" style="border:none;margin-top:6px"><span class="detail-value" style="color:var(--warning)">우리사무기 15%(이달)</span><span class="detail-value" style="text-align:right;color:var(--warning)"><strong>${won(wooriMonth)}</strong></span></div>
    </div>
    <div class="detail-panel" style="position:static">
      <h3>우리사무기 받을 정산액 (미정산 ${wooriPending.length}건)</h3>
      ${wooriPending.length? wooriPending.slice(0,8).map(r=>`<div class="detail-row"><span class="detail-value">${esc(custName(r.customer_id))} · ${PM_LABEL[r.payment_method]||''}${r.tax_invoice?'/계산서':''}</span><span style="display:flex;gap:6px;align-items:center"><strong>${won(mySettle(r))}</strong><button class="btn btn-sm btn-success" onclick="doWooriSettle(${r.id})">정산받음</button></span></div>`).join('') : '<div class="empty-state">받을 정산액 없음</div>'}
      ${wooriPending.length>8?`<div style="font-size:12px;color:var(--gray-400);margin-top:6px">외 ${wooriPending.length-8}건</div>`:''}
    </div>
  </div>
  <div class="table-container"><table class="table">
    <thead><tr><th>거래처</th><th style="text-align:right">공임</th><th style="text-align:right">부품</th><th style="text-align:right">매출</th><th style="text-align:right">우리사무기15%</th><th style="text-align:right">정산액</th></tr></thead>
    <tbody>${custRows.length? custRows.map(([cid,o])=>`<tr>
      <td><strong>${esc(custName(cid))}</strong></td>
      <td style="text-align:right">${won(o.labor)}</td>
      <td style="text-align:right">${won(o.parts)}</td>
      <td style="text-align:right"><strong>${won(o.rev)}</strong></td>
      <td style="text-align:right;color:var(--warning)">${o.woori?won(o.woori):'-'}</td>
      <td style="text-align:right;color:var(--success)"><strong>${won(o.mine)}</strong></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">이달 완료·결제 내역이 없습니다</td></tr>'}
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
