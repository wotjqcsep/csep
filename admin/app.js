// ============================================================
//  CSEP 관리자 — 페이지 렌더러 + 모달 + SSE
// ============================================================

// ── Electron: alert()/confirm() 포커스 버그 수정 ──
if(navigator.userAgent.includes('Electron')){
  const _origConfirm=window.confirm;
  window.confirm=function(msg){const r=_origConfirm.call(window,msg);setTimeout(()=>{window.focus();const ae=document.activeElement;if(ae&&ae.blur){ae.blur();ae.focus();}},50);return r;};
  window.alert=function(msg){if(typeof showToast==='function'){const s=String(msg||'');showToast(s,s.includes('실패')||s.includes('오류')||s.includes('차단')?'#e03131':undefined);}};
}

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
  repairing:  { l:'수거·점검', c:'#7048e8' },
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
const WO_TYPE_COLOR={출장:'#1971c2',납품:'#e67700','견적서 납품':'#7048e8'};
function _memoDup(s,m){ if(!s||!m)return false; const n=t=>t.replace(/[\s—\-,]/g,'').substring(0,35); return n(s)===n(m); }
function woTypeBadge(memo){
  if(!memo) return '';
  const m=memo.match(/^\[([^\]]+)\]/);
  if(!m) return '';
  const t=m[1], c=WO_TYPE_COLOR[t]||'#868e96';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:#fff;background:${c}">${esc(t)}</span>`;
}
function recCard(r){
  const c = custObj(r.customer_id) || {};
  const st = REC_ST[r.status] || { l:r.status, c:'var(--gray-500)' };
  const phone = r.reception_phone || c.phone || '';
  const addr = [c.address, c.address_detail].filter(Boolean).join(' ');
  const ch = ({phone:'📞',sms:'💬',kakao:'💭',direct:'📋'})[r.reception_channel] || '📋';
  return `<div class="ws-card ${r.status}">
    <div class="ws-head">
      <div class="ws-name">${esc(custName(r.customer_id))} ${r.work_type?woTypeBadge('['+r.work_type+']'):woTypeBadge(r.initial_memo)} <span style="font-size:13px;font-weight:400;color:var(--gray-400)">${ch}</span></div>
      <div style="text-align:right;flex-shrink:0">
        <div style="display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap">
          ${r.status!=='repairing'&&r.picked_up&&r.status!=='completed'?`<span class="ws-pill" style="background:#7048e8">수거·견적</span>`:''}
          ${r.reserved_date?`<span class="ws-pill" style="background:var(--warning)">예약</span>`:''}
          <span class="ws-pill" style="background:${st.c}">${st.l}</span>
        </div>
        ${r.reserved_date?`<div style="font-size:11px;color:var(--gray-500);margin-top:4px">접수 ${fmtRecDay(r.received_at)} · 처리예정 <strong style="color:var(--warning)">${esc(r.reserved_date)}</strong></div>`:''}
      </div>
    </div>
    <div class="ws-row"><span class="ic">👤</span><span>담당: ${engBadge(r.assigned_engineer_id)}</span></div>
    ${r.symptom?`<div class="ws-row"><span class="ic">🔧</span><span>${esc(r.symptom)}</span></div>`:''}
    ${phone?`<div class="ws-row"><span class="ic">📞</span><span>${esc(phone)}</span></div>`:''}
    ${addr?`<div class="ws-row"><span class="ic">📍</span><span>${esc(addr)}</span></div>`:''}
    ${(r.solution||(r.initial_memo&&!_memoDup(r.symptom,r.initial_memo)))?`<div class="ws-memo">${esc(r.solution||r.initial_memo)}</div>`:''}
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
  const inProgress= rs.filter(r=>recSection(r)==='pending' && (r.status==='in_progress'||r.status==='repairing')).sort(byDesc);
  const pending   = rs.filter(r=>recSection(r)==='pending' && r.status!=='in_progress' && r.status!=='repairing').sort(byDesc);
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
      ${state.engineers.map(e=>`<option value="${e.id}" ${r.assigned_engineer_id==e.id?'selected':''} style="color:${engColor(e.id)};font-weight:600">${esc(e.name)}${e.is_admin?' (대표)':''}</option>`).join('')}
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
    ['담당 기사', engBadge(r.assigned_engineer_id), true],
    ['접수일시', fmtRecTime(r.received_at)],
    ['처리 예정일', r.reserved_date||''],
    ['완료일시', r.completed_at?fmtRecTime(r.completed_at):''],
  ].filter(([,val])=>val);
  const body=`
    <div style="margin-bottom:12px">
      <span class="ws-pill" style="background:${st.c}">${st.l}</span>
      ${r.reserved_date?'<span class="ws-pill" style="background:var(--warning);margin-left:6px">예약</span>':''}
    </div>
    ${rows.map(([k,val,raw])=>`<div class="detail-row"><span class="detail-label">${k}</span><span class="detail-value">${raw?val:esc(val)}</span></div>`).join('')}
    <div class="form-section">증상 / 요청</div>
    <div style="background:var(--gray-50);border-radius:8px;padding:10px;font-size:13px;white-space:pre-wrap">${esc(r.symptom)||'-'}${r.customer_request?'\n\n[고객요청] '+esc(r.customer_request):''}${(r.initial_memo&&!_memoDup(r.symptom,r.initial_memo))?'\n\n[메모] '+esc(r.initial_memo):''}</div>
    ${photos.length?`<div class="form-section">현장 사진 (${photos.length})</div><div style="display:flex;flex-wrap:wrap;gap:6px">${photos.map(p=>`<img src="${p.photo}" style="width:92px;height:92px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--gray-200)" onclick="window.open(this.src,'_blank')">`).join('')}</div>`:''}
    <div class="form-section">처리 · 결제 (처리하기)</div>
    <textarea id="rd_sol" style="width:100%;min-height:60px" placeholder="처리한 내용을 입력하세요">${esc(r.solution||'')}</textarea>
    <div class="form-row" style="margin-top:8px">
      <div class="form-group"><label>공임비</label><input id="rd_labor" type="text" inputmode="numeric" value="${Number(r.labor_fee)?Number(r.labor_fee).toLocaleString('ko-KR'):''}" oninput="estFmtCost(this);calcPay()" placeholder="0"></div>
      <div class="form-group"><label>부품비</label><input id="rd_parts" type="text" inputmode="numeric" value="${Number(r.parts_fee)?Number(r.parts_fee).toLocaleString('ko-KR'):''}" oninput="estFmtCost(this);calcPay()" placeholder="0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>결제수단</label><select id="rd_pm" onchange="calcPay()">
        <option value="">선택</option>
        ${['card','cash','transfer','cashreceipt','tax','unpaid'].map(k=>`<option value="${k}" ${r.payment_method===k?'selected':''}>${PM_LABEL[k]||k}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>세금계산서</label><label style="display:flex;align-items:center;gap:6px;padding-top:9px;font-size:14px"><input type="checkbox" id="rd_tax" ${r.tax_invoice?'checked':''} onchange="calcPay()"> 발급</label></div>
    </div>
    <input type="hidden" id="rd_vatrefund" value="${Number(r.vat_refund)||0}">
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
  const labor=Number((v('rd_labor')||'').replace(/[^\d]/g,''))||0, parts=Number((v('rd_parts')||'').replace(/[^\d]/g,''))||0, pm=v('rd_pm');
  const tax=document.getElementById('rd_tax') && document.getElementById('rd_tax').checked;
  const rev=labor+parts, wr=feeRateRec({payment_method:pm,tax_invoice:tax}), woori=Math.round(rev*wr), mine=rev-woori;
  const vatRefund=Number((document.getElementById('rd_vatrefund')||{}).value||0);
  const finalMine=mine+vatRefund;
  const el=document.getElementById('rd_calc'); if(!el) return;
  el.innerHTML = `매출 <strong>${won(rev)}</strong>`
    + (woori?` · <span style="color:var(--warning)">${esc(agencyName())} 수수료(${Math.round(wr*10000)/100}%) ${won(woori)}</span>`:'')
    + (vatRefund?` · <span style="color:#0ca678">환급 +${won(vatRefund)}</span>`:'')
    + ` · <span style="color:var(--success)">정산액 <strong>${won(finalMine)}</strong></span>`
    + (woori?`<div style="font-size:11px;color:var(--gray-400);margin-top:4px">※ 카드/계산서 → 매출은 ${esc(agencyName())} 경유, 나중에 ${won(finalMine)} 현금 정산 받음</div>`:'');
}
async function savePayment(recId, complete){
  const tax = !!(document.getElementById('rd_tax') && document.getElementById('rd_tax').checked);
  const data={ labor_fee:Number((v('rd_labor')||'').replace(/[^\d]/g,''))||0, parts_fee:Number((v('rd_parts')||'').replace(/[^\d]/g,''))||0, payment_method:v('rd_pm')||null, tax_invoice:tax, solution:v('rd_sol'), complete: !!complete };
  if(complete && !data.payment_method){ if(!confirm('결제수단이 없습니다. 그래도 완료할까요?')) return; }
  else if(complete && !confirm('완료 처리하시겠습니까?')) return;
  try{ await api('PUT',`/receptions/${recId}/payment`, data); }
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
        <button class="btn btn-sm" style="background:var(--btn-warn)" onclick="openVendorHistory(${c.id})">📋 이력</button>
        <button class="btn btn-sm" style="background:var(--btn-blue)" onclick="openVendorDocs(${c.id})">📄 문서</button>
        <button class="btn btn-sm" style="background:var(--btn-green)" onclick="openVendorDevices(${c.id})">🖥 장치정보</button>
        <button class="btn btn-sm" style="background:var(--btn-purple)" onclick="openSiteModal(${c.id})">🏢 현장추가</button>
        <button class="btn btn-sm" style="background:var(--btn-edit)" onclick="openCustomerModal(${c.id})">✏ 수정</button>
        <button class="btn btn-sm" style="background:var(--btn-del)" onclick="deleteVendor(${c.id})">🗑 삭제</button>
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
let _vhRows=[];
function vhFilteredHtml(filter){
  const rows=filter? _vhRows.filter(r=>(r.work_type||'')==filter) : _vhRows;
  if(!rows.length) return '<div class="empty-state" style="padding:18px">해당 분류의 이력이 없습니다</div>';
  return `<div class="table-container"><table class="table"><thead><tr><th style="width:90px">일시</th><th style="width:70px">구분</th><th>증상</th><th style="width:60px">상태</th><th style="white-space:nowrap;width:80px">담당</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td style="font-size:12px;white-space:nowrap">${fmtRecTime(r.received_at)}</td><td>${woTypeBadge(r.work_type?'['+r.work_type+']':'')}</td><td>${esc(r.symptom)||'-'}</td><td>${statusLabel(r.status)}</td><td style="white-space:nowrap">${r.assigned_engineer_id?engBadge(r.assigned_engineer_id):'-'}</td></tr>`).join('')}
    </tbody></table></div>`;
}
async function openVendorHistory(customerId){
  const cust=state.customers.find(x=>x.id==customerId)||{};
  modal(`📋 이력 - ${esc(vdName(cust))}`, '<div class="loading">불러오는 중...</div>', true);
  try{ _vhRows=await api('GET','/customers/'+customerId+'/receptions'); }catch(e){ _vhRows=[]; }
  const _validTypes=['출장','납품','견적서 납품'];
  const types=[...new Set(_vhRows.map(r=>r.work_type).filter(t=>t&&_validTypes.includes(t)))];
  const tabs=types.length? `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap"><button class="btn btn-sm" style="background:var(--gray-800);color:#fff" onclick="this.parentElement.querySelectorAll('.btn').forEach(b=>{b.style.background='var(--gray-100)';b.style.color='var(--gray-700)'});this.style.background='var(--gray-800)';this.style.color='#fff';document.getElementById('vh_body').innerHTML=vhFilteredHtml('')">전체</button>${types.map(t=>`<button class="btn btn-sm" style="background:var(--gray-100);color:var(--gray-700)" onclick="this.parentElement.querySelectorAll('.btn').forEach(b=>{b.style.background='var(--gray-100)';b.style.color='var(--gray-700)'});this.style.background='${WO_TYPE_COLOR[t]||'var(--gray-600)'}';this.style.color='#fff';document.getElementById('vh_body').innerHTML=vhFilteredHtml('${esc(t)}')">${esc(t)}</button>`).join('')}</div>` : '';
  const body=`${tabs}<div id="vh_body">${_vhRows.length? vhFilteredHtml('') : '<div class="empty-state">이력이 없습니다</div>'}</div>
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
    const specs=[['CPU',cp.cpu],['RAM',specSummary('ram',cp.ram)],['SSD',specSummary('ssd',cp.ssd)],['HDD',specSummary('hdd',cp.hdd)],['메인보드',mbSummary(cp.motherboard)],['BIOS',cp.bios_version],['VGA',cp.gpu],['모니터',monSummary(cp.monitor)],['OS',cp.os],['Office',cp.office_version],['CAD',cp.cad],['Adobe',cp.adobe],['기타1',cp.etc_program1],['기타2',cp.etc_program2],['IP',cp.ip_address],['MAC',cp.mac_address],['프린터',printers],['NAS',cp.nas_name?`${cp.nas_name}${cp.nas_ip?' ('+cp.nas_ip+')':''}${cp.nas_partition_info?' · 파티션 '+cp.nas_partition_info:''}`:''],['공유기',cp.router_name?`${cp.router_name}${cp.router_ip?' ('+cp.router_ip+')':''}${cp.router_hub_count?' · 허브 '+cp.router_hub_count:''}`:''],['시리얼',cp.serial_number],['보증만료',cp.warranty_expiry],['메모',cp.notes]].filter(([,val])=>val);
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
function woHistFilter(type){
  document.querySelectorAll('#wo_hist_body .wo-hist-row').forEach(el=>{
    el.style.display=(!type||el.dataset.type===type)?'':'none';
  });
}
async function openWorkorderModal(customerId, siteId){
  const cust=state.customers.find(c=>c.id==customerId)||{};
  const site=siteId? state.sites.find(s=>s.id==siteId):null;
  const title=site? `${vdName(cust)} · ${site.name}` : vdName(cust);
  modal(`📋 ${esc(title)}`, '<div class="loading">불러오는 중...</div>', true);
  let comps=[], hist=[], ests=[];
  try{ comps=await api('GET','/customers/'+customerId+'/computers'); }catch(e){}
  try{ hist=await api('GET','/customers/'+customerId+'/receptions'); }catch(e){}
  try{ ests=await api('GET','/customers/'+customerId+'/estimates'); }catch(e){}
  const body=`
    <div style="color:var(--warning);font-weight:700;margin-bottom:8px">📁 수리/점검 이력 (${hist.length}건${hist.length>20?' · 최근 20건':''})</div>
    ${hist.length
      ? `${(()=>{ const _vt=['출장','납품','견적서 납품']; const woTypes=[...new Set(hist.map(r=>r.work_type).filter(t=>t&&_vt.includes(t)))]; return woTypes.length?`<div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap"><button class="btn btn-sm" style="padding:2px 8px;font-size:11px;background:var(--gray-800);color:#fff" onclick="this.parentElement.querySelectorAll('.btn').forEach(b=>{b.style.background='var(--gray-100)';b.style.color='var(--gray-700)'});this.style.background='var(--gray-800)';this.style.color='#fff';woHistFilter('')">전체</button>${woTypes.map(t=>`<button class="btn btn-sm" style="padding:2px 8px;font-size:11px;background:var(--gray-100);color:var(--gray-700)" onclick="this.parentElement.querySelectorAll('.btn').forEach(b=>{b.style.background='var(--gray-100)';b.style.color='var(--gray-700)'});this.style.background='${WO_TYPE_COLOR[t]||'var(--gray-600)'}';this.style.color='#fff';woHistFilter('${esc(t)}')">${esc(t)}</button>`).join('')}</div>`:''; })()}<div id="wo_hist_body" style="max-height:150px;overflow-y:auto;margin-bottom:14px;border:1px solid var(--gray-200);border-radius:8px;padding:8px 10px">${hist.slice(0,20).map(r=>`<div class="wo-hist-row" data-type="${esc(r.work_type||'')}" style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--gray-100)">${woTypeBadge(r.work_type?'['+r.work_type+']':r.initial_memo)} <span class="badge ${r.status}" style="font-size:10px">${statusLabel(r.status)}</span> ${esc(r.symptom)||'-'} <span style="color:var(--gray-400);float:right">${(r.received_at||'').slice(0,10)}</span></div>`).join('')}</div>`
      : '<div style="text-align:center;color:var(--gray-400);padding:14px 0;margin-bottom:8px">이전 이력이 없습니다</div>'}
    <div style="color:#7048e8;font-weight:700;margin:6px 0 10px">➕ 작업지시 작성</div>
    <div class="form-group"><label>장비 선택 (선택사항)</label><select id="wo_comp"><option value="">선택 안함</option>${comps.map(c=>`<option value="${c.id}">${esc(c.name)||'장비'} · ${DEVICE_TYPES[c.device_type]||c.device_type}</option>`).join('')}</select></div>
    <div class="form-group"><label>작업 구분 (선택사항)</label><select id="wo_type" onchange="document.getElementById('wo_est_box').style.display=this.value==='견적서 납품'?'block':'none'"><option value="출장">출장</option><option value="납품">납품</option><option value="견적서 납품">📄 견적서 납품</option></select></div>
    <div class="form-group" id="wo_est_box" style="display:none"><label>납품할 견적서 선택 *</label>
      <select id="wo_est">${ests.length?('<option value="">선택하세요</option>'+ests.map(e=>`<option value="${e.id}">${esc(e.no)||('#'+e.id)} · ${won(e.total)} · ${esc(e.est_date)||''}</option>`).join('')):'<option value="">저장된 견적이 없습니다</option>'}</select>
      <label style="margin-top:10px;display:block">제품 결제날자 <span style="font-size:11px;color:var(--gray-400)">(컴퓨존 등 실제 매입 결제일 · 외주업체 정산서에 표시)</span></label>
      <input type="date" id="wo_purchasedate" value="${estPurchaseDefault()}" style="padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px">
      <div style="font-size:11px;color:var(--gray-400);margin-top:3px">※ 기본값은 오늘 -2일 · 나중에 견적서 상세에서도 수정할 수 있습니다</div></div>
    <div class="form-group"><label>담당 기사 *</label><select id="wo_eng"><option value="">선택하세요</option>${state.engineers.map(e=>`<option value="${e.id}" style="color:${engColor(e.id)};font-weight:600">${esc(e.name)}${e.is_admin?' (대표)':''}</option>`).join('')}</select></div>
    ${area('wo_symptom','증상 또는 작업 내용 *','')}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn btn-success" onclick="submitWorkorder(${customerId},${siteId||'null'})">📤 작업지시 전송</button></div>`;
  modal(`📋 ${esc(title)}`, body, true);
}
async function submitWorkorder(customerId, siteId){
  const eng=v('wo_eng'); if(!eng){ showToast('담당 기사를 선택하세요','#e03131'); return; }
  const comp=v('wo_comp'); const type=v('wo_type');
  const site=siteId? state.sites.find(s=>s.id==siteId):null;
  const isDeliver=(type==='견적서 납품');
  // 견적서 납품: 저장된 견적을 불러와 금액·결제수단까지 지정
  let est=null;
  if(isDeliver){ const estId=v('wo_est'); if(!estId){ showToast('납품할 견적서를 선택하세요','#e03131'); return; }
    try{ est=await api('GET','/estimates/'+estId); }catch(e){ showToast('견적 불러오기 실패','#e03131'); return; } }
  const symptom = isDeliver
    ? '[견적서 납품] '+(est.no||'견적')+' — '+((Array.isArray(est.items)?est.items:[]).slice(0,3).map(i=>i.name).join(', ')||'PC 납품')
    : v('wo_symptom');
  if(!symptom){ showToast('증상 또는 작업 내용을 입력하세요','#e03131'); return; }
  const memo=[type?`[${type}]`:'', site?`현장:${site.name}`:'', isDeliver?`합계 ${won(est.total)}`:''].filter(Boolean).join(' ');
  const rec=await api('POST','/receptions',{ customer_id:customerId, computer_id:comp?Number(comp):null, reception_channel:isDeliver?'estimate':'direct', symptom, initial_memo:memo, work_type:type||null });
  await api('PUT',`/receptions/${rec.id}/assign?engineer_id=${eng}`);
  if(isDeliver){ const pm=(est.opts&&est.opts.payMethod)||'cash';
    const purchaseDate=v('wo_purchasedate')||'';
    if(est.id) { try{ await api('PUT',`/estimates/${est.id}/purchase-date`,{ purchase_date:purchaseDate }); }catch(e){} }
    await api('PUT',`/receptions/${rec.id}/payment`,{ parts_fee:Number(est.total)||0, payment_method:pm, tax_invoice:(pm==='tax'), estimate_amount:Number(est.total)||0, estimate_id:est.id }); }
  closeModal(); showToast(isDeliver?'📤 견적서 납품 작업지시 전송 완료':'📤 작업지시를 전송했습니다'); await loadAll();
}

// ============================================================
//  부품 데이터 (수동 추가 → 드롭다운 반영)
// ============================================================
let partForm = { kind:'cpu' };
const PART_KINDS = {
  cpu: { label:'CPU', g1:{label:'플랫폼',opts:['Intel','AMD']}, g2:'세대/소켓 (예: 15세대, AM6)', val:'모델명 (예: Core i5-15400)' },
  vga: { label:'VGA (그래픽)', g1:{label:'제조사',opts:['NVIDIA','AMD','Intel Arc','내장 그래픽']}, g2:'시리즈 (예: RTX 50)', val:'모델명 (예: RTX 5060)' },
  mb:      { label:'메인보드', multi:[ {kind:'mbmaker',label:'제조사',ph:'예: ASUS'}, {kind:'mbchipset',label:'칩셋',ph:'예: B760, X670'} ] },
  power:   { label:'파워', multi:[ {kind:'pwtype',label:'종류',ph:'예: ATX, M-ATX, TFX'}, {kind:'pwwatt',label:'와트',ph:'예: 500W~550W'} ] },
  monport: { label:'모니터 연결포트', simple:true, val:'포트 (예: HDMI, DP, USB-C)' },
  ram:     { label:'RAM', multi:[ {kind:'ramsize',label:'용량(GB)',ph:'예: 16, 32'}, {kind:'ramspec',label:'규격',ph:'예: DDR5'}, {kind:'ram',label:'제조사',ph:'예: 삼성'} ] },
  ssd:     { label:'SSD', multi:[ {kind:'ssdtype',label:'방식',ph:'예: NVMe M.2'}, {kind:'ssd',label:'제조사/모델',ph:'예: 삼성 990 PRO'} ] },
  hdd:     { label:'HDD 제조사', simple:true, val:'제조사 (예: WD)' },
  os:      { label:'OS', simple:true, val:'예: Windows 11 Pro' },
  office:  { label:'Office', simple:true, val:'예: Office 2021' },
  cad:     { label:'캐드(CAD)', simple:true, val:'예: AutoCAD 2024' },
  adobe:   { label:'어도비(Adobe)', simple:true, val:'예: Photoshop 2024' },
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
        <input id="pd_visitfee" type="text" inputmode="numeric" value="${Number((state.settings||{}).visit_fee)?Number((state.settings||{}).visit_fee).toLocaleString('ko-KR'):''}" oninput="estFmtCost(this)" placeholder="예: 30,000" style="flex:1;padding:9px 12px;border:1px solid var(--gray-300);border-radius:8px">
        <button class="btn" onclick="saveVisitFee()">저장</button>
      </div>
      <div style="font-size:12px;color:var(--gray-400);margin-top:6px">거절·비용청구 콜취소 시 기본으로 청구되는 금액 (현장에서 변경 가능)</div>
    </div>
    <div class="vd-card">
      <div style="font-weight:800;margin-bottom:12px">새 부품 추가 <span style="font-weight:400;color:var(--gray-500);font-size:12px">— 추가하면 장치정보 드롭다운에 바로 나타납니다</span></div>
      <div class="form-group"><label>부품 종류</label><select id="pd_kind" onchange="partForm.kind=this.value;renderInto()">
        ${Object.entries(PART_KINDS).map(([kk,c])=>`<option value="${kk}" ${k===kk?'selected':''}>${c.label}</option>`).join('')}
      </select></div>
      ${cfg.multi
        ? cfg.multi.map(sf=>partSubEditor(sf.kind, sf.label, sf.ph)).join('')
        : `${cfg.simple?'':`<div class="form-row">
            <div class="form-group"><label>${cfg.g1.label}</label><select id="pd_g1">${cfg.g1.opts.map(o=>`<option>${o}</option>`).join('')}</select></div>
            <div class="form-group"><label>${cfg.g2}</label><input id="pd_g2" placeholder="${cfg.g2}"></div>
          </div>`}
          <div class="form-group"><label>${cfg.val}</label><input id="pd_val" placeholder="${cfg.val}" onkeydown="if(event.key==='Enter')addPartOption()"></div>
          <button class="btn" onclick="addPartOption()">+ 추가</button>
          <div style="margin-top:14px;border-top:1px solid var(--gray-100);padding-top:10px">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px">등록된 ${cfg.label} (${list.length})</div>
            ${partOptChips(k)}
          </div>`
      }
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
  const el=document.getElementById('pd_preset'); if(el){ el.value=''; el.blur(); }
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
// 부품 옵션: 종류별 등록값 칩 목록(삭제 가능)
function partOptChips(kind){
  const list=(state.partOptions||[]).filter(o=>o.kind===kind);
  return list.length? `<div style="display:flex;flex-wrap:wrap;gap:6px">${list.map(o=>`<span class="chip" style="display:inline-flex;align-items:center;gap:5px">${o.grp?esc((o.grp||'').replace('||',' · '))+' · ':''}${esc(o.value)}<b style="cursor:pointer;color:var(--danger);font-size:15px;line-height:1" onclick="deletePartOption(${o.id})">×</b></span>`).join('')}</div>` : '<div style="color:var(--gray-400);font-size:12px">아직 없음</div>';
}
// multi 부품의 세부항목 편집기(라벨+입력+추가+칩목록)
function partSubEditor(kind, label, ph){
  return `<div style="margin-bottom:14px;padding:11px;border:1px solid var(--gray-200);border-radius:9px">
    <div style="font-weight:700;font-size:13px;margin-bottom:7px">${label}</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input id="pd_${kind}" placeholder="${ph||''}" style="flex:1;padding:9px 12px;border:1px solid var(--gray-300);border-radius:8px" onkeydown="if(event.key==='Enter')addPartOptionSub('${kind}','pd_${kind}')">
      <button class="btn btn-sm" onclick="addPartOptionSub('${kind}','pd_${kind}')">+ 추가</button>
    </div>
    ${partOptChips(kind)}
  </div>`;
}
async function addPartOptionSub(kind, inputId){
  const val=(v(inputId)||'').trim(); if(!val){ alert('값을 입력하세요'); return; }
  try{ await api('POST','/part-options',{kind, grp:'', value:val}); }catch(e){ alert('추가 실패: '+(e&&e.message?e.message:e)); return; }
  const el=document.getElementById(inputId); if(el){ el.value=''; el.blur(); }
  await loadAll();
}
async function addPartOption(){
  const k=partForm.kind, cfg=PART_KINDS[k], val=v('pd_val');
  if(!val){ alert('값을 입력하세요'); return; }
  const grp = cfg.simple ? '' : [v('pd_g1'),v('pd_g2')].filter(Boolean).join('||');
  try{ await api('POST','/part-options',{kind:k, grp, value:val}); }catch(e){ alert('추가 실패: '+(e&&e.message?e.message:e)); return; }
  const el=document.getElementById('pd_val'); if(el){ el.value=''; el.blur(); }
  await loadAll();
}
async function deletePartOption(id){ if(!confirm('삭제하시겠습니까?'))return; await api('DELETE','/part-options/'+id); await loadAll(); }
async function saveVisitFee(){ await api('PUT','/settings/visit_fee',{value:(v('pd_visitfee')||'').replace(/[^\d]/g,'')||'0'}); await loadAll(); alert('출장비 기본금액이 저장되었습니다.'); }

// ============================================================
//  일정표 (달력 + 메모)
// ============================================================
let scheduleState = { y:null, m:null, sel:null };
const CAL_COLOR = { pending:'var(--danger)', reserved:'var(--warning)', completed:'var(--success)', cancelled:'var(--gray-400)', memo:'#7048e8' };
const CAL_LABEL = { pending:'미처리', reserved:'예약', completed:'완료', cancelled:'취소', memo:'메모' };
function recCalInfo(r){
  if(r.status==='cancelled') return { date: localDateKey(r.completed_at||r.received_at), sec:'cancelled' };
  if(r.status==='completed') return { date: localDateKey(r.completed_at||r.received_at), sec:'completed' };
  if(r.reserved_date) return { date: String(r.reserved_date).slice(0,10), sec:'reserved' };
  return { date: localDateKey(r.received_at), sec:'pending' };
}
function schedMove(delta){ let m=scheduleState.m+delta, y=scheduleState.y; if(m<0){m=11;y--;} if(m>11){m=0;y++;} scheduleState.m=m; scheduleState.y=y; renderInto(); }

async function addScheduleMemo(){
  const sel = scheduleState.sel;
  if(!sel){ alert('날짜를 먼저 선택하세요.'); return; }
  const memo = document.getElementById('sched_memo')?.value.trim();
  if(!memo){ alert('메모를 입력하세요.'); return; }
  await api('POST','/schedules',{ title: memo, memo: '', date: sel });
  await loadAll();
}
async function deleteScheduleMemo(id){
  if(!confirm('이 메모를 삭제하시겠습니까?')) return;
  await api('DELETE','/schedules/'+id);
  await loadAll();
}

function renderSchedule(){
  const now=new Date();
  if(scheduleState.y==null){ scheduleState.y=now.getFullYear(); scheduleState.m=now.getMonth(); }
  const y=scheduleState.y, m=scheduleState.m, pad=n=>String(n).padStart(2,'0');
  const key=d=>`${y}-${pad(m+1)}-${pad(d)}`;
  const byDate={};
  (state.receptions||[]).forEach(r=>{ const ci=recCalInfo(r); if(!ci.date||ci.date==='-')return; (byDate[ci.date]=byDate[ci.date]||[]).push({type:'rec',r,sec:ci.sec}); });
  (state.schedules||[]).forEach(s=>{ if(!s.date)return; (byDate[s.date]=byDate[s.date]||[]).push({type:'memo',s,sec:'memo'}); });
  const startDow=new Date(y,m,1).getDay(), daysInMonth=new Date(y,m+1,0).getDate();
  const todayKey=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const cells=[]; for(let i=0;i<startDow;i++) cells.push(0); for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const dow=['일','월','화','수','목','금','토'];
  const legend=Object.keys(CAL_LABEL).map(s=>`<span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${CAL_COLOR[s]};margin-right:5px"></span>${CAL_LABEL[s]}</span>`).join('');
  const grid=cells.map(d=>{
    if(!d) return `<div class="cal-day empty"></div>`;
    const k=key(d), items=byDate[k]||[];
    const secs=['pending','reserved','completed','cancelled','memo'];
    const dots=secs.filter(s=>items.some(x=>x.sec===s))
      .map(s=>`<span style="width:8px;height:8px;border-radius:50%;background:${CAL_COLOR[s]};display:inline-block;margin:1px"></span>`).join('');
    const dowIdx=(startDow+d-1)%7, nc=dowIdx===0?'color:var(--danger)':dowIdx===6?'color:#1971c2':'';
    return `<div class="cal-day ${scheduleState.sel===k?'sel':''} ${k===todayKey?'today':''}" onclick="scheduleState.sel='${k}';renderInto()">
      <span class="cal-num" style="${nc}">${d}</span>
      <div class="cal-dots">${dots}${items.length?`<span style="font-size:10px;color:var(--gray-400);margin-left:3px">${items.length}</span>`:''}</div>
    </div>`;
  }).join('');

  const sel=scheduleState.sel, selItems=sel?(byDate[sel]||[]):[];
  const selMemos = selItems.filter(x=>x.type==='memo');
  const selRecs  = selItems.filter(x=>x.type==='rec');

  const memoForm = sel ? `
    <div style="margin-top:16px;background:var(--memo-bg);border:1px solid var(--memo-border);border-radius:10px;padding:14px">
      <div style="font-weight:700;margin-bottom:8px;color:#7048e8">📝 메모 추가 — ${esc(fmtRecDate(sel))}</div>
      <div style="display:flex;gap:8px">
        <input id="sched_memo" placeholder="메모 입력" style="flex:1;padding:8px 10px;border:1px solid var(--gray-300);border-radius:8px;font-size:13px">
        <button class="btn" style="background:#7048e8" onclick="addScheduleMemo()">추가</button>
      </div>
    </div>` : '';

  const memoList = selMemos.length ? `
    <div style="margin-top:12px">
      <div style="font-weight:700;margin-bottom:8px;color:#7048e8">📌 메모 (${selMemos.length}건)</div>
      ${selMemos.map(x=>`<div style="background:var(--memo-item-bg);border:1px solid var(--memo-item-border);border-left:4px solid #7048e8;border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px">${esc(x.s.title)}</span>
        <button class="btn btn-sm btn-danger" onclick="deleteScheduleMemo(${x.s.id})" style="flex-shrink:0;margin-left:10px">삭제</button>
      </div>`).join('')}
    </div>` : '';

  const recList = selRecs.length ? `
    <div style="margin-top:12px"><div class="ws-sec" style="--sec:var(--primary)"><span style="background:var(--primary)">작업 ${selRecs.length}건</span></div>
      <div class="ws-grid">${selRecs.map(x=>recCard(x.r)).join('')}</div>
    </div>` : '';

  const detail = sel
    ? (memoForm + memoList + recList + (!selMemos.length && !selRecs.length ? '<div class="empty-state" style="margin-top:12px">이 날짜의 내역이 없습니다</div>' : ''))
    : '<div class="empty-state" style="margin-top:14px">날짜를 누르면 메모를 추가하거나 내역을 확인할 수 있습니다</div>';

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
  const es = state.engineers; const S = state.settings||{};
  return `
  <div class="page-header"><h2>👷 사업자 관리 (${es.length}명)</h2><div style="display:flex;gap:8px"><button class="btn btn-secondary" onclick="go('workorders')">← 작업지시</button><button class="btn" onclick="openEngineerModal()">+ 기사 추가</button></div></div>
  <div class="vd-card" style="margin-bottom:16px">
    <div style="font-weight:800;margin-bottom:8px">🔐 CSEP 관리자 비밀번호</div>
    <div class="form-row">
      <div class="form-group"><label>현재 비밀번호</label><input id="set_oldpw" type="password" placeholder="현재 비밀번호"></div>
      <div class="form-group"><label>새 비밀번호</label><input id="set_newpw" type="password" placeholder="새 비밀번호 (공란=비밀번호 없음)"></div>
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn" onclick="saveAdminPassword()">비밀번호 변경</button></div>
    </div>
    <div style="font-size:12px;color:var(--gray-400)">공란으로 저장하면 비밀번호 없이 바로 접속할 수 있습니다.</div>
  </div>
  <div class="vd-card" style="margin-bottom:16px">
    <div style="font-weight:800;margin-bottom:4px">⚙️ 결산 · 대행업체 설정</div>
    <div class="form-row">
      ${field('set_brand','상호/브랜드명 (결산 화면 표시)', S.brand_name||'')}
      ${field('set_agency','대행업체명 (카드/계산서 경유)', S.agency_name||'')}
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn" onclick="saveAgencySettings()">설정 저장</button>
      <span style="font-size:12px;color:var(--gray-400)">외주 수수료율은 아래 "결제수단별 외주업체 수수료율"에서 설정합니다.</span>
    </div>
  </div>
  <div class="vd-card" style="margin-bottom:16px">
    <div style="font-weight:800;margin-bottom:12px">🧾 사업자정보 (거래명세서·세금계산서·영수증 공급자란)</div>
    <div class="form-row">
      ${field('set_bizno','사업자등록번호', S.biz_no||'')}
      ${field('set_bizceo','대표자 성명', S.biz_ceo||'')}
    </div>
    <div class="form-row">
      ${field('set_biztype','업태', S.biz_type||'')}
      ${field('set_bizitem','종목', S.biz_item||'')}
    </div>
    <div class="form-row">
      ${field('set_bizaddr','사업장 주소', S.biz_addr||'')}
      ${field('set_biztel','전화번호', S.biz_tel||'')}
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn" onclick="saveBizSettings()">사업자정보 저장</button>
      <span style="font-size:12px;color:var(--gray-400)">상호는 위 "상호/브랜드명"을 사용합니다.</span>
    </div>
    <div style="margin-top:14px;border-top:1px dashed var(--gray-300);padding-top:12px">
      <div style="font-weight:700;margin-bottom:6px">🔴 도장 (문서 날인)</div>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <div style="width:96px;height:96px;border:1px solid var(--gray-300);border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff;background-image:linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%);background-size:14px 14px;background-position:0 0,7px 7px">
          ${S.stamp_img?`<img src="${S.stamp_img}" style="max-width:88px;max-height:88px">`:'<span style="font-size:12px;color:var(--gray-400)">없음</span>'}
        </div>
        <div>
          <label class="btn btn-sm" style="cursor:pointer">📤 도장 이미지 업로드<input type="file" accept="image/*" onchange="estStampUpload(this)" style="display:none"></label>
          ${S.stamp_img?`<button class="btn btn-sm btn-danger" onclick="estStampRemove()" style="margin-left:6px">삭제</button>`:''}
          <div style="font-size:11px;color:var(--gray-400);margin-top:6px;max-width:340px">흰 배경은 자동으로 투명 처리됩니다. 도장은 견적서·거래명세서·세금계산서·간이영수증의 공급자 성명 옆에 날인됩니다.</div>
        </div>
      </div>
    </div>
  </div>
  <div class="vd-card" style="margin-bottom:16px">
    <div style="font-weight:800;margin-bottom:4px">💳 결제수단별 외주업체 수수료율 (%) <span style="font-weight:400;font-size:12px;color:#0ca678">— 결산·견적·매장판매 등 돈 관련 전부에 적용</span></div>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px">외주업체를 통해 결제할 때 그 업체에 내는 수수료입니다. 보통 현금·계좌이체는 0, 현금영수증·세금계산서·카드는 요율 설정. 혼자 거래(외주 없음)면 전부 0.</div>
    <div class="form-row">
      ${field('fee_cash','현금', S.fee_cash||'')}
      ${field('fee_transfer','계좌이체', S.fee_transfer||'')}
      ${field('fee_cashreceipt','현금영수증', S.fee_cashreceipt||'')}
    </div>
    <div class="form-row">
      ${field('fee_card','카드', S.fee_card||'')}
      ${field('fee_tax','세금계산서', S.fee_tax||'')}
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn" onclick="saveFeeSettings()">수수료율 저장</button></div>
    </div>
    <div style="font-size:12px;color:var(--gray-400)">문서 작성 시 선택한 결제수단의 수수료율이 합계에 적용되어 실수령액이 계산됩니다. 예) 카드 15, 세금계산서 15, 나머지 0.</div>
  </div>
  <div class="table-container"><table class="table">
    <thead><tr><th>이름</th><th>전화</th><th>상태</th><th>권한</th><th>앱 로그인</th><th>액션</th></tr></thead>
    <tbody>${es.length? es.map(e=>`<tr>
      <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${engColor(e.id)};margin-right:7px;vertical-align:middle"></span><strong style="color:${engColor(e.id)}">${esc(e.name)}</strong></td><td>${esc(e.phone)||'-'}</td>
      <td><span class="chip">${statusLabel(e.status)}</span></td>
      <td>${e.is_admin?'<span class="badge assigned">대표</span>':'기사'}</td>
      <td>${e.locked?'<span style="color:var(--danger);font-weight:700">🔒 잠김</span>':(e.has_password?'🔑 비번 설정됨':'<span style="color:var(--gray-400)">비번 없음</span>')}</td>
      <td><span style="display:flex;gap:6px">${e.locked?`<button class="btn btn-sm btn-success" onclick="unlockEngineer(${e.id})">잠금해제</button>`:''}<button class="btn btn-sm btn-secondary" onclick="openEngineerModal(${e.id})">편집</button><button class="btn btn-sm btn-danger" onclick="deleteEngineer(${e.id})">삭제</button></span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">기사가 없습니다</td></tr>'}
    </tbody></table></div>
  <div class="vd-card" style="margin-top:24px">
    <div style="font-weight:800;margin-bottom:10px">🎨 화면 색상 농도</div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      ${[1,2,3,4,5].map(lv=>{
        const cur=Number(localStorage.getItem('csep_theme'))||1;
        const colors=['#f1f3f5','#1e2130','#151722','#0e1018','#08090e'];
        const labels=['밝게','다크','진하게','매우 진하게','최대 어둡게'];
        const sel=cur===lv;
        return `<button onclick="applyTheme(${lv});render()" style="flex:1;min-width:80px;padding:10px 6px;border-radius:10px;border:2px solid ${sel?'var(--primary)':'var(--gray-300)'};background:${colors[lv-1]};cursor:pointer;text-align:center;transition:border .15s">
          <div style="font-size:18px;font-weight:900;color:${lv===1?'#343a40':'#e5e7eb'}">${lv}</div>
          <div style="font-size:11px;color:${lv===1?'#868e96':'#9ca3af'};margin-top:2px">${labels[lv-1]}</div>
        </button>`;
      }).join('')}
    </div>
    <div style="font-size:12px;color:var(--gray-500);margin-top:8px">선택한 설정은 이 PC에 저장됩니다.</div>
  </div>
  <div class="vd-card" style="margin-top:24px;border:2px solid var(--danger)">
    <div style="font-weight:800;margin-bottom:8px;color:var(--danger)">🗑️ 데이터 초기화</div>
    <div style="font-size:13px;color:var(--gray-500);margin-bottom:12px">선택한 데이터를 모두 삭제합니다. 삭제 후 복구할 수 없습니다.<br>결산·통계는 남은 데이터 기준으로 자동 재계산됩니다.</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px 20px;margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="checkbox" id="rst_receptions"> 📋 작업현황·작업지시</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="checkbox" id="rst_customers"> 🏢 거래처</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="checkbox" id="rst_sales"> 🛒 매장판매</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="checkbox" id="rst_estimates"> 📄 견적·명세·계산서</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px"><input type="checkbox" id="rst_schedules"> 📅 일정</label>
    </div>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px;line-height:1.6">
      <strong>연관 데이터 안내:</strong><br>
      · 작업현황·작업지시 — 접수·작업·대화·사진·관련 결제 내역 삭제, 기사 실적 초기화<br>
      · 거래처 — 거래처·장비(PC)·현장 정보 삭제 (작업이력은 유지, 고객정보만 해제)<br>
      · 매장판매 — 매장 판매 내역·관련 결제 삭제<br>
    </div>
    <div class="form-row">
      <div class="form-group"><label>확인 문구 입력</label><input id="rst_confirm" type="text" placeholder="정말 초기화 하겠습니다" autocomplete="off"></div>
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-danger" onclick="resetSystem()">초기화 실행</button></div>
    </div>
    <div style="font-size:12px;color:var(--danger)">위 입력란에 <strong>"정말 초기화 하겠습니다"</strong>를 정확히 입력해야 초기화가 실행됩니다.</div>
  </div>`;
}
async function resetSystem(){
  const targets=[];
  if(document.getElementById('rst_receptions')?.checked) targets.push('receptions');
  if(document.getElementById('rst_customers')?.checked) targets.push('customers');
  if(document.getElementById('rst_sales')?.checked) targets.push('sales');
  if(document.getElementById('rst_estimates')?.checked) targets.push('estimates');
  if(document.getElementById('rst_schedules')?.checked) targets.push('schedules');
  if(!targets.length) return alert('초기화할 대상을 선택해주세요.');
  const ct=(document.getElementById('rst_confirm')?.value||'').trim();
  if(ct!=='정말 초기화 하겠습니다') return alert('"정말 초기화 하겠습니다"를 정확히 입력해주세요.');
  const labels={receptions:'작업현황·작업지시',customers:'거래처',sales:'매장판매',estimates:'견적·명세·계산서',schedules:'일정'};
  if(!confirm('⚠️ 다음 데이터를 초기화합니다:\n\n'+targets.map(t=>'  · '+labels[t]).join('\n')+'\n\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
  try{
    await api('POST','/admin/reset',{targets,confirmText:ct});
    alert('✅ 초기화가 완료되었습니다.');
    document.getElementById('rst_confirm').value='';
    document.querySelectorAll('[id^="rst_"]').forEach(el=>{if(el.type==='checkbox')el.checked=false;});
    await loadAll(); render();
  }catch(e){ alert('초기화 실패: '+(e.message||e)); }
}
async function saveAdminPassword(){
  const oldPw = v('set_oldpw') || '';
  const newPw = v('set_newpw') || '';
  try {
    const r = await api('PUT', '/admin-password', { oldPassword: oldPw, newPassword: newPw });
    if (r && r.error) { alert(r.error); return; }
    document.getElementById('set_oldpw').value = '';
    document.getElementById('set_newpw').value = '';
    if (!newPw) {
      alert('비밀번호가 제거되었습니다. 다음 접속부터 비밀번호 없이 바로 접속됩니다.');
    } else {
      alert('비밀번호가 변경되었습니다.');
    }
  } catch(e) { alert('비밀번호 변경 실패: ' + (e.message || e)); }
}
async function saveAgencySettings(){
  await api('PUT','/settings/brand_name',{value:v('set_brand')||''});
  await api('PUT','/settings/agency_name',{value:v('set_agency')||''});
  await loadAll(); alert('설정이 저장되었습니다.');
}
// 도장 이미지 업로드 — 흰/밝은 배경을 투명 처리 후 PNG로 settings에 저장
function estStampUpload(input){
  const f=input.files&&input.files[0]; input.value='';
  if(!f) return;
  const rd=new FileReader();
  rd.onload=e=>{ const img=new Image(); img.onload=async ()=>{
    let w=img.width,h=img.height; const max=300; if(w>max||h>max){ if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;} }
    const c=document.createElement('canvas'); c.width=w; c.height=h; const cx=c.getContext('2d'); cx.drawImage(img,0,0,w,h);
    try{ const d=cx.getImageData(0,0,w,h), a=d.data;
      for(let i=0;i<a.length;i+=4){ const r=a[i],g=a[i+1],b=a[i+2];
        if(r>225&&g>225&&b>225){ a[i+3]=0; }                                   // 밝은 배경 → 완전 투명
        else if(r>190&&g>190&&b>190){ a[i+3]=Math.round(a[i+3]*0.35); } }      // 옅은 배경 → 반투명
      cx.putImageData(d,0,0);
    }catch(err){ /* CORS 등 실패 시 원본 유지 */ }
    const url=c.toDataURL('image/png');
    try{ await api('PUT','/settings/stamp_img',{value:url}); await loadAll(); }
    catch(err){ alert('도장 저장 실패: '+(err&&err.message?err.message:err)); }
  }; img.onerror=()=>alert('이미지를 읽을 수 없습니다'); img.src=e.target.result; };
  rd.readAsDataURL(f);
}
async function estStampRemove(){ if(!confirm('도장을 삭제할까요?'))return; await api('PUT','/settings/stamp_img',{value:''}); await loadAll(); }
// 문서 날인용 도장 <img> (없으면 빈 문자열). 공급자 성명 옆 겹치기용.
function stampImg(size){ const s=size||46; const u=(state.settings||{}).stamp_img; return u?`<span style="position:relative;display:inline-block;width:${s}px;height:${s}px;vertical-align:middle"><img src="${u}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${s}px;height:${s}px;object-fit:contain;opacity:0.85"></span>`:''; }
async function saveBizSettings(){
  await api('PUT','/settings/biz_no',{value:v('set_bizno')||''});
  await api('PUT','/settings/biz_ceo',{value:v('set_bizceo')||''});
  await api('PUT','/settings/biz_type',{value:v('set_biztype')||''});
  await api('PUT','/settings/biz_item',{value:v('set_bizitem')||''});
  await api('PUT','/settings/biz_addr',{value:v('set_bizaddr')||''});
  await api('PUT','/settings/biz_tel',{value:v('set_biztel')||''});
  await loadAll(); alert('사업자정보가 저장되었습니다.');
}
async function saveFeeSettings(){
  for(const k of ['fee_cash','fee_transfer','fee_cashreceipt','fee_card','fee_tax']) await api('PUT','/settings/'+k,{value:(v(k)||'')});
  await loadAll(); alert('결제수단별 수수료율이 저장되었습니다.');
}
// 결제수단 라벨 + 결제수단별 외주 수수료율(사업자관리 설정, 0=없음)
const EST_PAY={cash:'현금',transfer:'계좌이체',cashreceipt:'현금영수증',card:'카드',tax:'세금계산서'};
function estPayLabel(m){ return EST_PAY[m]||m||'현금'; }
function feeRate(method){ const map={cash:'fee_cash',transfer:'fee_transfer',cashreceipt:'fee_cashreceipt',card:'fee_card',tax:'fee_tax'};
  const val=(state.settings||{})[map[method]]; return (val===''||val==null)?0:(Number(val)||0)/100; }
async function unlockEngineer(id){ if(!confirm('이 기사의 잠금을 해제하고 로그인 실패 횟수를 초기화할까요?'))return; await api('PUT','/engineers/'+id,{unlock:true}); await loadAll(); }
async function deleteEngineer(id){ if(!confirm('이 기사를 삭제하시겠습니까?'))return; await api('DELETE','/engineers/'+id); await loadAll(); }

// ── 수리 이력 ──
function renderHistory(){
  const js = state.jobs;
  return `<div class="page-header"><h2>수리 이력 (${js.length}건)</h2></div>
  <div class="table-container"><table class="table">
    <thead><tr><th>#</th><th>기사</th><th>작업내용</th><th>부품</th><th>비용</th><th>상태</th></tr></thead>
    <tbody>${js.length? js.map(j=>`<tr>
      <td style="color:var(--gray-400)">${j.id}</td><td>${engBadge(j.engineer_id)}</td>
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

// ── 🛒 매장 판매 (워크인 POS) — 고객정보 없이 즉시 판매, 결산 자동 반영 ──
function stMoney(el){ let x=(el.value||'').replace(/[^0-9]/g,'').replace(/^0+(?=\d)/,''); el.value=x?Number(x).toLocaleString('ko-KR'):''; }
function stCalc(){ const qty=Number(v('st_qty'))||0; const price=Number((v('st_price')||'').replace(/[^0-9]/g,''))||0; const t=qty*price; const el=document.getElementById('st_total'); if(el) el.value=t?Number(t).toLocaleString('ko-KR'):''; }
function renderStore(){
  const all=(state.sales||[]).filter(s=>!s.customer_id);   // 워크인(매장) 판매만
  const now=new Date();
  const todayStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const monthStr=todayStr.slice(0,7);
  const sum=arr=>arr.reduce((t,s)=>t+(Number(s.total_price)||0),0);
  const today=all.filter(s=>(s.sale_date||'').slice(0,10)===todayStr);
  const month=all.filter(s=>(s.sale_date||'').slice(0,7)===monthStr);
  const recent=[...today].sort((a,b)=>b.id-a.id);   // 오늘 판매만 (전체 내역은 결산 메뉴에서)
  return `
  <div class="page-header"><h2>🛒 매장 판매 <span style="font-size:13px;color:var(--gray-500)">— 워크인(고객정보 없이 즉시 판매). 결산에 자동 반영</span></h2></div>
  <div class="stat-grid">
    ${statCard('오늘 판매', won(sum(today)), 'var(--success)', 20)}
    ${statCard('이달 판매', won(sum(month)), '', 20)}
    ${statCard('오늘 건수', today.length+'건', '', 18)}
  </div>
  <div class="vd-card" style="margin-bottom:16px">
    <div style="font-weight:800;margin-bottom:12px">빠른 판매 등록</div>
    <div class="form-row">
      <div class="form-group" style="flex:2"><label>품목명 *</label><input id="st_item" placeholder="예: 중고 데스크탑 / SSD 512GB / HDMI 케이블"></div>
      <div class="form-group"><label>수량</label><input id="st_qty" type="number" min="1" value="1" oninput="stCalc()"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>단가</label><input id="st_price" type="text" inputmode="numeric" placeholder="0" oninput="stMoney(this);stCalc()"></div>
      <div class="form-group"><label>합계</label><input id="st_total" readonly style="background:var(--gray-100);font-weight:700"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>결제수단</label><select id="st_pm"><option value="cash">현금</option><option value="card">카드</option><option value="transfer">계좌이체</option><option value="cashreceipt">현금영수증</option><option value="tax">세금계산서</option></select></div>
      <div class="form-group"><label>메모 (선택)</label><input id="st_memo" placeholder="예: 신품 / 중고 / 고객 특이사항"></div>
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin:4px 0 12px;font-weight:600;cursor:pointer"><input type="checkbox" id="st_tax" style="width:18px;height:18px"> 🧾 세금계산서 발행</label>
    ${agencyOn()?`<div style="font-size:12px;color:var(--gray-400);margin-bottom:10px">※ 결제수단별 외주 수수료율(사업자관리)이 설정된 결제수단·세금계산서에 ${esc(agencyName())} 대행 수수료가 적용됩니다.</div>`:''}
    <button class="btn" onclick="submitStoreSale()">+ 판매 등록</button>
  </div>
  <div style="font-weight:700;margin:6px 2px 8px">오늘 판매 내역 <span style="font-size:12px;color:var(--gray-400)">(전체 내역·집계는 결산 메뉴)</span></div>
  <div class="table-container"><table class="table">
    <thead><tr><th>품목</th><th>수량</th><th>단가</th><th>금액</th><th>결제</th><th>액션</th></tr></thead>
    <tbody>${recent.length? recent.map(s=>`<tr>
      <td><strong>${esc(s.item_name)}</strong>${s.item_type&&s.item_type!=='매장'?`<div style="font-size:11px;color:var(--gray-400)">${esc(s.item_type)}</div>`:''}</td>
      <td>${s.quantity||1}</td><td>${won(s.unit_price)}</td><td><strong>${won(s.total_price)}</strong></td>
      <td><span class="chip">${payMethodLabel(s.payment_method)}</span></td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteSale(${s.id})">삭제</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">오늘 판매가 없습니다</td></tr>'}
    </tbody></table></div>`;
}
async function submitStoreSale(){
  const item=v('st_item').trim(); if(!item){ alert('품목명을 입력하세요'); return; }
  const qty=Number(v('st_qty'))||1;
  const price=Number((v('st_price')||'').replace(/[^0-9]/g,''))||0;
  if(!price){ alert('단가를 입력하세요'); return; }
  const memo=v('st_memo').trim();
  const now=new Date(); const saleDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const tax=(document.getElementById('st_tax')||{}).checked;
  try{ await api('POST','/sales',{ customer_id:null, item_type:memo||'매장', item_name:item, quantity:qty, unit_price:price, total_price:qty*price, sale_date:saleDate, payment_method:v('st_pm'), paid:true, tax_invoice:tax }); }
  catch(e){ alert('등록 실패: '+(e&&e.message?e.message:e)); return; }
  await loadAll();
}

// ── 견적서 (컴퓨존식 부품 분류, 상태보존 estState) ── 매입가·마진 내부용, 인쇄엔 판매가만.
const EST_CATS=['CPU','메인보드','메모리','그래픽카드','SSD','HDD','케이스','파워','쿨러/튜닝','모니터','소프트웨어','주변기기','조립비/AS'];
let estState=null;
function estToday(){ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
// 제품 결제날자 기본값 — 보통 납품 2일 전쯤 매입 결제하므로 오늘 -2일 제안 (수정 가능)
function estPurchaseDefault(){ const n=new Date(); n.setDate(n.getDate()-2); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
// 견적서 상세에서 매입확정일 변경 — 이미 저장된 견적이면 즉시 서버 반영(수정)
async function estPurchaseDateChange(val){
  estState.purchaseDate=val;
  const st=document.getElementById('est_pd_status');
  if(!estState.savedId){ if(st){st.style.color='var(--gray-400)';st.textContent='(저장 시 반영)';} return; }
  try{ await api('PUT',`/estimates/${estState.savedId}/purchase-date`,{ purchase_date:val }); if(st){st.style.color='#0ca678';st.textContent='✓ 수정됨';} }
  catch(e){ if(st){st.style.color='#e03131';st.textContent='수정 실패';} }
}
function estCompanyDefault(){ const st=state.settings||{}; return (st.brand_name&&st.brand_name.trim())||(st.company_name||'')||''; }
function estInit(){ if(estState) return; const n=new Date(), t=estToday();
  estState={ company:estCompanyDefault(), contact:'', customer:'', phone:'', customerId:null, date:t,
    buyerBizno:'', buyerCeo:'', buyerAddr:'', buyerType:'', buyerItem:'',   // 공급받는자 사업자정보(명세서·계산서용)
    no:'Q'+t.replace(/-/g,'')+'-'+String(n.getHours())+String(n.getMinutes()).padStart(2,'0'), memo:'', bulk:0,
    savedId:null, doctype:'estimate', payMethod:'cash', realCost:'', noVat:false, purchaseDate:'',   // 문서 종류 + 결제방법 + 실제 매입가(부가세 환급 계산용) + 부가세 제외 + 매입확정일
    pname:'short', pprice:'total', ptarget:'customer',   // 기본값: 고객용+간략화+총액만
    rows:EST_CATS.map(c=>({cat:c,name:'',qty:1,cost:'',margin:0})) }; }
function estRowHtml(x,i){ x=x||{};
  const cost=Number(x.cost)||0, margin=Number(x.margin!=null?x.margin:0)||0, qty=Number(x.qty)||1;
  const price=(x.price!=null&&x.price!=='')?(Number(String(x.price).replace(/[^\d]/g,''))||0):(cost?Math.round(cost*(1+margin/100)):0);
  const amt=price*qty, fc=n=>n?Number(n).toLocaleString('ko-KR'):'';
  return `<tr class="est-row" data-i="${i}">
    <td><input class="est-cat" value="${esc(x.cat)||''}" placeholder="분류" style="width:92px;font-weight:600;background:var(--gray-50)"></td>
    <td><input class="est-name" value="${esc(x.name)||''}" placeholder="품명 (예: [AMD] 라이젠5 라파엘 7500F (6코어/12스레드/3.7GHz) 쿨러포함)" style="width:100%;min-width:340px"></td>
    <td><input class="est-qty" type="number" min="1" value="${x.qty||1}" style="width:56px"></td>
    <td><input class="est-cost" type="text" inputmode="numeric" value="${(x.cost!=null&&x.cost!=='')?fc(Number(String(x.cost).replace(/[^\d]/g,''))||0):''}" oninput="estFmtCost(this);estRecalcPrice(this)" placeholder="매입가" style="width:96px;text-align:right"></td>
    <td style="white-space:nowrap"><input class="est-margin" type="number" min="0" value="${x.margin!=null?x.margin:0}" oninput="estRecalcPrice(this)" style="width:52px"> %</td>
    <td><input class="est-price" type="text" inputmode="numeric" value="${fc(price)}" oninput="estFmtCost(this)" placeholder="판매단가" style="width:100px;text-align:right;font-weight:700"></td>
    <td class="est-amt" style="text-align:right;font-weight:800">${won(amt)}</td>
    <td><button class="btn btn-sm btn-danger" onclick="estDelRow(this)">×</button></td>
  </tr>`;
}
// 매입가·마진 입력 시 판매단가 자동계산(직접 입력하면 그 값 유지)
function estRecalcPrice(el){ const tr=el.closest('tr'); if(!tr)return;
  const cost=Number(String(tr.querySelector('.est-cost').value||'').replace(/[^\d]/g,''))||0;
  const margin=Number(tr.querySelector('.est-margin').value)||0;
  const pe=tr.querySelector('.est-price'); if(pe) pe.value = cost? Number(Math.round(cost*(1+margin/100))).toLocaleString('ko-KR') : ''; }
function renderEstimates(){ estInit(); const s=estState;
  const sub=s.rows.reduce((t,r)=>{ const c=Number(r.cost)||0,m=Number(r.margin)||0,q=Number(r.qty)||0; const p=(r.price!=null&&r.price!=='')?(Number(String(r.price).replace(/[^\d]/g,''))||0):Math.round(c*(1+m/100)); return t+p*q; },0);
  const vat=s.noVat?0:Math.round(sub*0.1);
  return `
  <div oninput="estSyncLazy()">
  <div class="page-header"><h2>📄 문서 작성 <span style="font-size:13px;color:var(--gray-500)">— 문서 종류를 골라 작성·인쇄 (같은 내용으로 종류만 전환)</span></h2></div>
  ${s.delivered?`<div style="background:#e6fcf5;border:1px solid #63e6be;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px">✅ <b>납품완료</b>${(Number(s.fieldDiscount)||0)>0?` · <span style="color:#e8590c;font-weight:700">현장할인 ${won(s.fieldDiscount)}</span>`:''}${s.finalAmount!=null?` · 실납품액 <b>${won(s.finalAmount)}</b>`:''}</div>`:''}
  <div class="vd-card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;margin-bottom:6px">공급받는자 <span style="font-size:11px;color:var(--gray-400);font-weight:400">— 고객/거래처 정보</span></div>
    <div class="form-row">
      <div class="form-group" style="flex:2;position:relative"><label>상호명 <span style="font-size:11px;color:var(--gray-400)">— 기존 거래처 선택 또는 새로 입력</span></label>
        <input id="est_customer" value="${esc(s.customer)}" oninput="estCustSearch()" onfocus="estCustSearch()" autocomplete="off" placeholder="고객명·거래처명·연락처 검색">
        <div id="est_cust_drop" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:999;background:var(--est-drop-bg);border:1px solid var(--gray-300);border-radius:6px;max-height:200px;overflow:auto;box-shadow:0 4px 12px rgba(0,0,0,.15)"></div>
      </div>
      <div class="form-group"><label>대표자</label><input id="est_buyer_ceo" value="${esc(s.buyerCeo||'')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:2"><label>주소</label><input id="est_buyer_addr" value="${esc(s.buyerAddr||'')}"></div>
      <div class="form-group"><label>연락처</label><input id="est_phone" value="${esc(s.phone||'')}" placeholder="000-0000-0000" oninput="estFmtPhone(this)"></div>
    </div>
    <div class="form-row" style="margin-top:4px">
      <div class="form-group"><label>사업자번호</label><input id="est_buyer_bizno" value="${esc(s.buyerBizno||'')}" placeholder="000-00-00000" oninput="estFmtBizno(this)"></div>
      ${field('est_buyer_type','업태',s.buyerType||'')}${field('est_buyer_item','종목',s.buyerItem||'')}
    </div>
    <div class="form-row">
      <div class="form-group"><label>견적일자</label><input id="est_date" type="date" value="${esc(s.date)}"></div>
      <div class="form-group"><label>견적번호</label><input id="est_no" value="${esc(s.no)}"></div>
      <div class="form-group" style="flex:2;display:flex;align-items:flex-end;gap:6px">
        <button class="btn btn-sm" onclick="estSave(this)">💾 견적 저장</button>
        <button class="btn btn-sm btn-secondary" onclick="estToggle('est_saved_box');estLoadList()">📂 저장된 견적</button>
        <span id="est_save_status" style="font-size:12px;color:var(--gray-500)"></span>
      </div>
    </div>
    <div id="est_saved_box" style="display:${_estSavedOpen?'block':'none'};margin-top:8px;border-top:1px solid var(--gray-200);padding-top:10px">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="est_search" oninput="estLoadList()" placeholder="이름·연락처·견적번호로 검색" style="flex:1;padding:8px;border:1px solid var(--gray-300);border-radius:8px;font-size:13px">
      </div>
      <div id="est_saved_list" style="max-height:280px;overflow:auto"></div>
    </div>
  </div>
  <div class="vd-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:6px;align-items:center;font-weight:800;flex-wrap:wrap">품목
        <button class="btn btn-sm" style="background:var(--badge-progress-bg);color:var(--badge-progress-c);margin:0;font-weight:700" onclick="estToggle('est_url_box')">🔗 URL 공유 <span style="font-size:10px;background:var(--success);color:#fff;border-radius:8px;padding:1px 6px;margin-left:2px">권장</span></button>
        <button class="btn btn-sm" style="background:#e7f5ff;color:#1971c2;margin:0;font-weight:700" onclick="estToggle('est_paste_box')">📋 소스·텍스트</button>
        <label class="btn btn-sm" style="cursor:pointer;background:var(--badge-repair-bg);color:var(--badge-repair-c);margin:0;font-weight:700">📷 캡처하기<input type="file" accept="image/*" onchange="estAiImport(this)" style="display:none"></label></div>
      <div style="display:flex;gap:6px;align-items:center"><span style="font-size:12px;color:var(--gray-500)">일괄 마진</span>
        <input id="est_bulk" type="number" value="${s.bulk}" style="width:56px"> %
        <button class="btn btn-sm btn-secondary" onclick="estApplyBulk()">전체 적용</button></div>
    </div>
    <div id="est_url_box" style="display:none;margin-bottom:10px">
      <div style="display:flex;gap:6px"><input id="est_url" placeholder="컴퓨존 [URL 공유] 링크 붙여넣기" style="flex:1;padding:9px;border:1px solid var(--gray-300);border-radius:8px;font-size:13px">
        <button class="btn btn-sm" onclick="navigator.clipboard.readText().then(t=>{document.getElementById('est_url').value=t}).catch(()=>showToast('클립보드 권한을 허용해주세요','#e68900'))" title="클립보드에서 붙여넣기">📋 붙여넣기</button>
        <button class="btn btn-sm" onclick="estUrlImport(this)">가져오기</button></div>
      <div style="font-size:11px;color:#0ca678;margin-top:4px">✅ 페이지에 적힌 부품명·가격을 그대로 가져옵니다 (AI 미사용 — 이름 축약·OS 지어냄 없음). 가장 정확한 방식입니다.</div>
    </div>
    <div id="est_paste_box" style="display:none;margin-bottom:10px">
      <textarea id="est_paste" placeholder="컴퓨존 '소스코드 공유'의 내용을 붙여넣으세요 — 커스텀 조립 견적도 정확히 가져옵니다 (AI 미사용)" style="width:100%;height:110px;padding:10px;border:1px solid var(--gray-300);border-radius:8px;font-size:13px"></textarea>
      <div style="margin-top:6px"><button class="btn btn-sm" onclick="estPasteImport(this)">📋 이 내용 가져오기</button></div>
    </div>
    <div class="table-container"><table class="table">
      <thead><tr><th>분류</th><th>품명</th><th>수량</th><th>매입가</th><th>마진</th><th>판매단가</th><th>금액</th><th></th></tr></thead>
      <tbody id="est_body">${s.rows.map((r,i)=>estRowHtml(r,i)).join('')}</tbody>
    </table></div>
    <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="estAddRow()">+ 항목 추가</button>
    <div style="margin-top:14px;display:flex;justify-content:flex-end">
      <table style="min-width:300px">
        <tr><td style="padding:4px 14px;color:var(--gray-600)">공급가액 <span style="font-size:11px;color:var(--gray-400)">(수정 시 마진 역산)</span></td>
          <td style="text-align:right"><input id="est_sub_in" value="${nfmt(sub)}" oninput="estFmtCost(this)" onchange="estSetSupply(this.value)" style="text-align:right;font-weight:700;width:130px;border:1px solid var(--gray-300);border-radius:6px;padding:3px 6px"> 원</td></tr>
        <tr><td style="padding:4px 14px;color:var(--gray-600)">부가세 (10%) <label style="margin-left:8px;font-size:11px;cursor:pointer"><input type="checkbox" id="est_novat" ${s.noVat?'checked':''} onchange="estToggleVat(this.checked)" style="vertical-align:middle"> 부가세 제외</label></td><td id="est_vat" style="text-align:right;font-weight:700">${won(vat)}</td></tr>
        <tr><td style="padding:7px 14px;font-weight:800;border-top:2px solid var(--gray-300)">합계</td>
          <td style="text-align:right;border-top:2px solid var(--gray-300)"><input id="est_total_in" value="${nfmt(sub+vat)}" oninput="estFmtCost(this)" onchange="estSetTotal(this.value)" style="text-align:right;font-weight:900;font-size:17px;width:150px;border:1px solid var(--gray-300);border-radius:6px;padding:3px 6px"> 원</td></tr>
      </table>
    </div>
    <div class="form-group" style="margin-top:10px"><label>비고 / 메모</label><input id="est_memo" value="${esc(s.memo)}" placeholder="예: 견적 유효기간 7일 / 설치·배송 포함 등"></div>
    <div style="border:1px solid var(--gray-200);border-radius:8px;padding:10px 12px;margin-top:12px;background:var(--gray-50)">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px">🖨️ 견적서 출력 옵션 <span style="font-weight:400;color:var(--gray-500)">— 바꾸면 아래 미리보기에 실시간 반영</span></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px">
        <label>대상
          <select id="est_ptarget" style="margin-left:5px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px">
            <option value="customer" ${s.ptarget==='customer'?'selected':''}>고객용 (매입가·마진 숨김)</option>
            <option value="internal" ${s.ptarget==='internal'?'selected':''}>내부용 (매입가·마진·이익)</option>
          </select>
        </label>
        <label>품명 표시
          <select id="est_pname" style="margin-left:5px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px">
            <option value="full" ${s.pname==='full'?'selected':''}>전체 상세</option>
            <option value="short" ${s.pname==='short'?'selected':''}>간략화 (모델명만)</option>
            <option value="cat" ${s.pname==='cat'?'selected':''}>분류만 (품명 숨김)</option>
          </select>
        </label>
        <label>금액 표시
          <select id="est_pprice" style="margin-left:5px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px">
            <option value="each" ${s.pprice==='each'?'selected':''}>개별 단가+금액</option>
            <option value="total" ${s.pprice==='total'?'selected':''}>총액만 (개별가격 숨김)</option>
          </select>
        </label>
        <label>결제방법
          <select id="est_paymethod" style="margin-left:5px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px">
            <option value="cash" ${s.payMethod==='cash'?'selected':''}>현금</option>
            <option value="transfer" ${s.payMethod==='transfer'?'selected':''}>계좌이체</option>
            <option value="cashreceipt" ${s.payMethod==='cashreceipt'?'selected':''}>현금영수증</option>
            <option value="card" ${s.payMethod==='card'?'selected':''}>카드</option>
            <option value="tax" ${s.payMethod==='tax'?'selected':''}>세금계산서</option>
          </select>
        </label>
        <label>실제 매입가(수동)
          <input id="est_realcost" value="${(()=>{const v=Number(String(s.realCost||'').replace(/[^\d]/g,''))||0; return v?won(v):'';})()}" oninput="estFmtCost(this)" placeholder="예: 1,400,000" style="margin-left:5px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px;width:130px;text-align:right">
          <span style="font-size:11px;color:var(--gray-400)">부가세 포함 금액</span>
        </label>
        <label>매입 부가세 환급
          <input id="est_refund" value="${s.refundManual!=null?won(Number(String(s.refundManual).replace(/[^\d]/g,''))||0):''}" oninput="estFmtRefund(this)" placeholder="자동 계산" style="margin-left:5px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px;width:110px;text-align:right">
          <span style="font-size:11px;color:var(--gray-400)">비워두면 자동(중고/자체보유 시 0 입력)</span>
        </label>
      </div>
      <div id="est_fee" style="margin-top:8px;font-size:13px;padding:8px 10px;border-radius:8px;background:var(--card-bg);border:1px solid var(--gray-200)"></div>
      <div style="border-top:2px solid var(--gray-300);margin-top:14px;padding-top:10px">
        <div style="font-size:12px;font-weight:700;color:var(--gray-500);margin-bottom:6px">📄 문서 종류 선택</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${[['estimate','견적서'],['statement','거래명세서'],['tax','세금계산서'],['receipt','간이영수증']].map(([k,l])=>{
          const on=(estState.doctype||'estimate')===k;
          return `<button class="btn" onclick="estSetDoc('${k}')" style="${on?'background:#c2410c;color:#fff':'background:var(--gray-100);color:var(--gray-600)'};font-weight:${on?'800':'600'}">${on?'● ':''}${l}</button>`;
        }).join('')}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn" onclick="estPrint(estState.ptarget)">🖨️ 이 상태로 인쇄</button>
        <button class="btn btn-secondary" onclick="estReset()">초기화</button>
      </div>
      <div style="font-size:12px;color:var(--gray-400);margin-top:8px">※ 내부용은 품명·금액 옵션과 무관하게 항상 전체 표시. 옵션은 출력물에만 적용되고 위 표 데이터는 그대로입니다.</div>
      <div style="display:flex;align-items:center;gap:8px;margin:12px 0 6px">
        <span style="font-weight:600;font-size:12px;color:var(--gray-500)">👁️ 미리보기</span>
        <button class="btn btn-sm btn-secondary" onclick="estRenderPreview()" style="font-size:11px;padding:2px 10px">🔄 새로고침</button>
      </div>
      <div id="est_preview"></div>
    </div>
  </div></div>`;
}
let _estSavedOpen=false;
function estToggle(id){ const b=document.getElementById(id); if(b){ const show=b.style.display==='none'; b.style.display=show?'block':'none'; if(id==='est_saved_box') _estSavedOpen=show; } }
// 매입가 입력 실시간 천단위 콤마
function estFmtCost(el){ const d=String(el.value||'').replace(/[^\d]/g,''); el.value=d?Number(d).toLocaleString('ko-KR'):''; }
function estFmtRefund(el){ const d=String(el.value||'').replace(/[^\d]/g,''); el.value=d?Number(d).toLocaleString('ko-KR'):''; }
// 연락처 자동 포맷: 000-0000-0000
function estFmtPhone(el){ const d=String(el.value||'').replace(/[^\d]/g,''); let f=d; if(d.length<=3) f=d; else if(d.length<=7) f=d.slice(0,3)+'-'+d.slice(3); else f=d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7,11); el.value=f; }
// 사업자번호 자동 포맷: 000-00-00000
function estFmtBizno(el){ const d=String(el.value||'').replace(/[^\d]/g,''); let f=d; if(d.length<=3) f=d; else if(d.length<=5) f=d.slice(0,3)+'-'+d.slice(3); else f=d.slice(0,3)+'-'+d.slice(3,5)+'-'+d.slice(5,10); el.value=f; }
// 거래처 자동완성 드롭다운
function estCustSearch(){
  const el=document.getElementById('est_customer'); if(!el) return;
  const q=(el.value||'').trim().toLowerCase();
  const drop=document.getElementById('est_cust_drop'); if(!drop) return;
  if(!q){ drop.style.display='none'; estState.customerId=null; return; }
  const matches=(state.customers||[]).filter(c=>(vdName(c)||'').toLowerCase().includes(q)||(c.phone||'').includes(q)).slice(0,15);
  if(!matches.length){ drop.style.display='none'; return; }
  drop.innerHTML=matches.map(c=>`<div style="padding:8px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--gray-100)" onmousedown="estCustSelect(${c.id})">${esc(vdName(c))} <span style="color:var(--gray-400)">${esc(c.phone||'')}</span></div>`).join('');
  drop.style.display='block';
}
function estCustSelect(id){
  const c=(state.customers||[]).find(x=>x.id==id); if(!c) return;
  const drop=document.getElementById('est_cust_drop'); if(drop) drop.style.display='none';
  const s=(eid,val)=>{const e=document.getElementById(eid);if(e)e.value=val||'';};
  s('est_customer',vdName(c));
  s('est_phone',c.phone||'');
  s('est_buyer_ceo',c.ceo_name||c.contact_person||'');
  s('est_buyer_addr',[c.address,c.address_detail].filter(Boolean).join(' '));
  s('est_buyer_bizno',c.biz_no||'');
  s('est_buyer_type',c.biz_type||'');
  s('est_buyer_item',c.biz_item||'');
  estState.customerId=c.id; estState.customer=vdName(c); estState.phone=c.phone||'';
  estState.buyerCeo=c.ceo_name||c.contact_person||'';
  estState.buyerAddr=[c.address,c.address_detail].filter(Boolean).join(' ');
  estState.buyerBizno=c.biz_no||'';
  estState.buyerType=c.biz_type||'';
  estState.buyerItem=c.biz_item||'';
  const ph=document.getElementById('est_phone'); if(ph) estFmtPhone(ph);
  const bn=document.getElementById('est_buyer_bizno'); if(bn) estFmtBizno(bn);
  estRenderPreview();
}
// 드롭다운 바깥 클릭 시 닫기
document.addEventListener('click',e=>{ const d=document.getElementById('est_cust_drop'); if(d && !d.contains(e.target) && e.target.id!=='est_customer') d.style.display='none'; });
// 견적서 저장 (거래처 없으면 자동 등록)
async function estSave(btn){
  estSyncAll();
  const st=document.getElementById('est_save_status');
  const rows=estRows().filter(r=>r.name||r.amt);
  if(!rows.length){ if(st){st.style.color='#e03131';st.textContent='품목을 입력하세요';} return; }
  if(!(estState.customer||'').trim() && !(estState.phone||'').trim()){ if(st){st.style.color='#e03131';st.textContent='고객/거래처 또는 연락처를 입력하세요';} return; }
  const sub=rows.reduce((t,r)=>t+r.amt,0), vat=estState.noVat?0:Math.round(sub*0.1);
  const body={ no:estState.no, customer_id:estState.customerId||null, customer_name:estState.customer, phone:estState.phone,
    company:estState.company, contact:estState.contact, est_date:estState.date, memo:estState.memo,
    items:rows, opts:{doctype:estState.doctype,payMethod:estState.payMethod,realCost:estState.realCost,noVat:estState.noVat,pname:estState.pname,pprice:estState.pprice,ptarget:estState.ptarget,bulk:estState.bulk,
      refundManual:estState.refundManual!=null?estState.refundManual:null,
      buyerBizno:estState.buyerBizno,buyerCeo:estState.buyerCeo,buyerAddr:estState.buyerAddr,buyerType:estState.buyerType,buyerItem:estState.buyerItem},
    subtotal:sub, vat, total:sub+vat, no_vat:estState.noVat||false, purchase_date:estState.purchaseDate||'' };
  if(btn) btn.disabled=true; if(st){st.style.color='var(--gray-500)';st.textContent='저장 중…';}
  let r;
  try{
    if(estState.savedId) r=await api('PUT','/estimates/'+estState.savedId,body);
    else r=await api('POST','/estimates',body);
  }
  catch(e){ if(btn)btn.disabled=false; if(st){st.style.color='#e03131';st.textContent='저장 실패: '+(e&&e.message?e.message:e);} return; }
  if(btn)btn.disabled=false;
  estState.savedId=r.id;
  if(st){ st.style.color='#0ca678'; st.textContent=(body.customer_id?'수정':'저장')+'됨'+(r.customer_created?' (거래처 신규 등록됨)':'')+' · 견적 #'+r.id; }
  await loadAll();   // 거래처 목록 갱신(자동완성 반영)
}
// 저장된 견적 검색·목록
async function estLoadList(){
  const box=document.getElementById('est_saved_list'); if(!box) return;
  const q=(v('est_search')||'').trim();
  let list;
  try{ list=await api('GET','/estimates'+(q?('?q='+encodeURIComponent(q)):'')); }
  catch(e){ box.innerHTML='<div style="color:#e03131;font-size:13px">불러오기 실패: '+esc(e&&e.message?e.message:e)+'</div>'; return; }
  if(!list.length){ box.innerHTML='<div style="color:var(--gray-400);font-size:13px;padding:8px">저장된 견적이 없습니다</div>'; return; }
  box.innerHTML=`<table class="table" style="font-size:13px"><thead><tr><th>견적번호</th><th>고객/거래처</th><th>연락처</th><th style="text-align:right">합계</th><th>결제</th><th>일자</th><th></th></tr></thead><tbody>`
    + list.map(e=>{const pm=(e.opts&&e.opts.payMethod)||'cash'; return `<tr>
        <td>${esc(e.no)||('#'+e.id)}${e.delivered?' <span class="badge assigned" style="font-size:10px">납품완료</span>':''}${(Number(e.field_discount)||0)>0?` <span style="color:#e8590c;font-size:11px">현장할인 ${won(e.field_discount)}</span>`:''}</td><td>${esc(e.customer_name)||'-'}</td><td>${esc(e.phone)||'-'}</td>
        <td style="text-align:right;font-weight:600">${won(e.total)}</td><td>${estPayLabel(pm)}</td><td>${esc(e.est_date)||''}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm" onclick="estLoadOne(${e.id})">불러오기</button>
          <button class="btn btn-sm" style="background:#7048e8" onclick="estToWorkorder(${e.id})">📤 작업지시</button>
          <button class="btn btn-sm btn-danger" onclick="estDeleteSaved(${e.id})">×</button></td></tr>`}).join('')
    + '</tbody></table>';
}
async function estLoadOne(id){
  let e; try{ e=await api('GET','/estimates/'+id); }catch(err){ showToast('불러오기 실패: '+(err&&err.message?err.message:err),'#e03131'); return; }
  const o=e.opts||{};
  estState={ company:e.company||estCompanyDefault(), contact:e.contact||'', customer:e.customer_name||'', phone:e.phone||'',
    buyerBizno:o.buyerBizno||'', buyerCeo:o.buyerCeo||'', buyerAddr:o.buyerAddr||'', buyerType:o.buyerType||'', buyerItem:o.buyerItem||'',
    customerId:e.customer_id||null, date:e.est_date||estToday(), no:e.no||'', memo:e.memo||'', bulk:(o.bulk===''||o.bulk==null)?0:(Number(o.bulk)||0), savedId:e.id,
    delivered:e.delivered||false, fieldDiscount:Number(e.field_discount)||0, finalAmount:e.final_amount,
    doctype:o.doctype||'estimate', payMethod:o.payMethod||'cash', realCost:o.realCost||'', refundManual:o.refundManual!=null?o.refundManual:null, noVat:o.noVat||e.no_vat||false, purchaseDate:e.purchase_date||'', pname:o.pname||'short', pprice:o.pprice||'total', ptarget:o.ptarget||'customer',
    rows:(Array.isArray(e.items)&&e.items.length?e.items:EST_CATS.map(c=>({cat:c,name:'',qty:1,cost:'',margin:0})))
      .map(r=>({cat:r.cat||'',name:r.name||'',qty:Number(r.qty)||1,cost:(r.cost!=null?r.cost:''),margin:Number(r.margin)||0,price:(r.price!=null?r.price:'')})) };
  go('estimates');   // 견적서 화면으로 이동 + estState 반영
}
// 저장된 견적 → 작업지시로 납품 (기사 배정 → 완료 시 결산 등록)
async function estToWorkorder(id){
  let e; try{ e=await api('GET','/estimates/'+id); }catch(err){ showToast('견적 불러오기 실패','#e03131'); return; }
  window._estWO=e;
  const items=Array.isArray(e.items)?e.items:[];
  const summary=items.slice(0,3).map(i=>i.name).join(', ')+(items.length>3?` 외 ${items.length-3}건`:'');
  const body=`
    <div style="font-size:13px;margin-bottom:6px">거래처: <b>${esc(e.customer_name)||'-'}</b> · 합계 <b>${won(e.total)}</b> · 결제 ${estPayLabel((e.opts&&e.opts.payMethod)||'cash')}</div>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px">${esc(summary)||'품목'}</div>
    <div class="form-group"><label>담당 기사 *</label><select id="wo2_eng"><option value="">선택하세요</option>${state.engineers.map(g=>`<option value="${g.id}" style="color:${engColor(g.id)};font-weight:600">${esc(g.name)}${g.is_admin?' (대표)':''}</option>`).join('')}</select></div>
    <div class="form-group"><label>제품 결제날자 <span style="font-size:11px;color:var(--gray-400)">(컴퓨존 등 실제 매입 결제일 · 외주업체 정산서에 표시)</span></label>
      <input type="date" id="wo2_purchasedate" value="${e.purchase_date||estPurchaseDefault()}" style="padding:6px 8px;border:1px solid var(--gray-300);border-radius:6px">
      <div style="font-size:11px;color:var(--gray-400);margin-top:3px">※ 나중에 견적서 상세에서도 수정할 수 있습니다</div>
    </div>
    ${area('wo2_memo','작업/납품 메모 (선택)', '')}
    <div style="font-size:12px;color:var(--gray-400);margin-bottom:8px">전송하면 작업지시(접수)로 등록되고 금액(${won(e.total)})·결제수단이 함께 지정됩니다. 기사가 완료 처리하면 결산에 반영됩니다.</div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn btn-success" onclick="estToWorkorderSubmit(${id})">📤 작업지시 전송</button></div>`;
  modal('📤 작업지시로 납품', body, true);
}
async function estToWorkorderSubmit(id){
  const e=window._estWO||{}; const eng=v('wo2_eng'); if(!eng){ showToast('담당 기사를 선택하세요','#e68900'); return; }
  if(!e.customer_id){ showToast('이 견적에 연결된 거래처가 없습니다. 견적을 열어 고객/연락처를 넣고 다시 저장하세요.','#e68900'); return; }
  const items=Array.isArray(e.items)?e.items:[];
  const symptom='[견적서 납품] '+(e.no||'견적')+' — '+(items.slice(0,3).map(i=>i.name).join(', ')||'PC 납품');
  const memo=v('wo2_memo')||'';
  const pm=(e.opts&&e.opts.payMethod)||'cash';
  const purchaseDate=v('wo2_purchasedate')||'';
  try{
    if(e.id) await api('PUT',`/estimates/${e.id}/purchase-date`,{ purchase_date:purchaseDate });
    const rec=await api('POST','/receptions',{ customer_id:e.customer_id, reception_channel:'estimate', symptom, initial_memo:memo, work_type:'견적서 납품' });
    await api('PUT',`/receptions/${rec.id}/assign?engineer_id=${eng}`);
    await api('PUT',`/receptions/${rec.id}/payment`,{ parts_fee:Number(e.total)||0, payment_method:pm, tax_invoice:(pm==='tax'), estimate_amount:Number(e.total)||0, estimate_id:e.id });
  }catch(err){ showToast('작업지시 전송 실패: '+(err&&err.message?err.message:err),'#e03131'); return; }
  closeModal(); showToast('📤 작업지시 전송 완료 — 기사가 완료 처리하면 결산에 등록됩니다'); await loadAll();
}
// 새 문서 작성 — 빈 양식 + 문서 종류 지정
function estNew(dtype){
  estState=null; estInit(); estState.doctype=(dtype||'estimate');
  go('estimates');
}
// 문서 종류 전환(견적서 내부 버튼) — 내용 유지, 양식만 변경
function estSetDoc(dtype){ estSyncAll(); estState.doctype=dtype||'estimate'; _estForceRender=true; render(); }
// 거래처 카드 → 그 거래처의 저장된 문서
async function openVendorDocs(customerId){
  const cust=state.customers.find(c=>c.id==customerId)||{};
  modal(`📄 문서 - ${esc(vdName(cust))}`, '<div class="loading">불러오는 중...</div>', true);
  let rows=[]; try{ rows=await api('GET','/customers/'+customerId+'/estimates'); }catch(e){}
  const body=`${rows.length? `<div class="table-container"><table class="table"><thead><tr><th>문서번호</th><th style="text-align:right">합계</th><th>일자</th><th></th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${esc(r.no)||('#'+r.id)}</td><td style="text-align:right;font-weight:600">${won(r.total)}</td><td>${esc(r.est_date)||''}</td>
      <td style="white-space:nowrap"><button class="btn btn-sm" onclick="closeModal();estLoadOne(${r.id})">열기</button> <button class="btn btn-sm" style="background:#7048e8" onclick="closeModal();estToWorkorder(${r.id})">📤 작업지시</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty-state">저장된 문서가 없습니다</div>'}
    <div class="form-actions"><button class="btn" onclick="closeModal();go('estimates')">+ 새 문서 작성</button><button class="btn btn-secondary" onclick="closeModal()">닫기</button></div>`;
  modal(`📄 문서 - ${esc(vdName(cust))}`, body, true);
}
async function estDeleteSaved(id){
  if(!confirm('이 저장된 견적을 삭제할까요?')) return;
  try{ await api('DELETE','/estimates/'+id); }catch(e){ showToast('삭제 실패: '+(e&&e.message?e.message:e),'#e03131'); return; }
  estLoadList();
}
// DOM → estState (값 동기화만, 계산 없음)
function estSyncAll(){ if(!estState)return; const g=id=>{const e=document.getElementById(id);return e?e.value:'';};
  const S_=state.settings||{}; estState.company=S_.brand_name||estState.company||''; estState.contact=S_.biz_tel||estState.contact||'';
  estState.customer=g('est_customer'); estState.phone=g('est_phone');
  estState.buyerBizno=g('est_buyer_bizno'); estState.buyerCeo=g('est_buyer_ceo'); estState.buyerAddr=g('est_buyer_addr'); estState.buyerType=g('est_buyer_type'); estState.buyerItem=g('est_buyer_item');
  estState.date=g('est_date'); estState.no=g('est_no'); estState.memo=g('est_memo'); estState.bulk=(g('est_bulk')==='')?0:(Number(g('est_bulk'))||0);
  estState.pname=g('est_pname')||estState.pname||'short'; estState.pprice=g('est_pprice')||estState.pprice||'total';
  estState.ptarget=g('est_ptarget')||estState.ptarget||'customer'; estState.doctype=estState.doctype||'estimate';
  estState.payMethod=g('est_paymethod')||estState.payMethod||'cash';
  { const e=document.getElementById('est_realcost'); if(e) estState.realCost=String(e.value||'').replace(/[^\d]/g,''); }
  { const e=document.getElementById('est_refund'); if(e){ const v=String(e.value||'').replace(/[^\d]/g,''); estState.refundManual=(v==='')?null:Number(v); } }
  { const e=document.getElementById('est_novat'); if(e) estState.noVat=e.checked; }
  estState.rows=[...document.querySelectorAll('#est_body .est-row')].map(tr=>{ const q=c=>tr.querySelector(c);
    const cost=Number(String(q('.est-cost').value||'').replace(/[^\d]/g,''))||0, margin=Number(q('.est-margin').value)||0;
    const priceRaw=String(q('.est-price').value||'').replace(/[^\d]/g,''), auto=cost?Math.round(cost*(1+margin/100)):0;
    const price=(priceRaw===''||Number(priceRaw)===auto)?'':priceRaw;
    return { cat:q('.est-cat').value, name:q('.est-name').value, qty:Number(q('.est-qty').value)||1, cost:String(cost||''), margin, price }; });
}
// oninput 래퍼 디바운스 — 입력 즉시 반응, 계산·미리보기는 500ms 후 한 번만
let _estSyncTimer;
function estSyncLazy(){ clearTimeout(_estSyncTimer); _estSyncTimer=setTimeout(()=>{ estSyncAll(); estCalc(); estRenderPreview(); },500); }
function estBody(){ const b=document.getElementById('est_body'); if(b){ b.innerHTML=estState.rows.map((r,i)=>estRowHtml(r,i)).join(''); estCalc(); } }
function estCalc(){ let sub=0;
  document.querySelectorAll('#est_body .est-row').forEach(tr=>{
    const qty=Number(tr.querySelector('.est-qty').value)||0;
    const price=Number(String(tr.querySelector('.est-price').value||'').replace(/[^\d]/g,''))||0, amt=price*qty;
    tr.querySelector('.est-amt').textContent=won(amt); sub+=amt; });
  const vat=estState.noVat?0:Math.round(sub*0.1);
  const vEl=document.getElementById('est_vat'); if(vEl) vEl.textContent=estState.noVat?'—':won(vat);
  const setIn=(id,val)=>{ const e=document.getElementById(id); if(e && document.activeElement!==e) e.value=nfmt(val); };
  setIn('est_sub_in',sub); setIn('est_total_in',sub+vat);
  estUpdateFee();
}
// 공급가액 목표값 → 일괄 마진 역산 후 전 품목 적용
function estSetSupply(val){
  const target=Number(String(val||'').replace(/[^\d]/g,''))||0;
  estSyncAll();
  const cost=estState.rows.reduce((t,r)=>t+(Number(r.cost)||0)*(Number(r.qty)||0),0);
  if(cost<=0){ showToast('매입가가 입력되어야 공급가액으로 마진을 역산할 수 있습니다.','#e68900'); estBody(); return; }
  const margin=Math.round((target/cost-1)*1000)/10;   // 소수1자리 %
  estState.bulk=margin; estState.rows.forEach(r=>{ r.margin=margin; r.price=''; });
  _estForceRender=true; render();   // 일괄마진 입력·품목 판매단가·합계 모두 재반영
}
function estSetTotal(val){ const t=Number(String(val||'').replace(/[^\d]/g,''))||0; estSetSupply(estState.noVat?t:Math.round(t/1.1)); }
function estToggleVat(checked){ estSyncAll(); estState.noVat=checked; estBody(); }
// 결제수단별 수수료율(사업자관리) — 요율>0 이면 수수료 발생
function estFeeRate(){ return estState?feeRate(estState.payMethod):0; }
// 결제방법에 따른 금액(외주 수수료·실수령) 표시 — 렌더 직후에도 항상 채움
// 현금/계좌이체: 고객 직접 지급 → 수수료 없음, 환급 없음
// 카드/현금영수증/세금계산서: 외주업체 경유 → 수수료(부가세납부 포함) + 매입부가세 환급
function estUpdateFee(){
  const el=document.getElementById('est_fee'); if(!el||!estState) return;
  const rows=estRows(); const sub=rows.reduce((t,r)=>t+r.amt,0), vat=estState.noVat?0:Math.round(sub*0.1);
  const total=sub+vat;
  const totCost=rows.reduce((t,r)=>t+(Number(r.cost)||0)*(Number(r.qty)||0),0);
  const rate=estFeeRate(), pct=Math.round(rate*10000)/100, cut=Math.round(total*rate);
  const net=total-cut;               // 실수령액 = 합계 - 외주업체 결제 수수료
  const realCost=Number(String(estState.realCost||'').replace(/[^\d]/g,''))||0;
  const useOutsource=rate>0;         // 외주업체 경유 여부
  const autoRefund=realCost>0?(realCost-Math.round(realCost/1.1)):0;
  const refund=(estState.refundManual!=null)?estState.refundManual:autoRefund;
  const finalNet=net+refund;         // 최종 실수령 = 실수령액 + 매입환급
  const finalProfit=finalNet-realCost; // 최종 순이익 = 최종 실수령 - 매입비
  let html='';
  if(useOutsource){
    html+=`💳 <b>${estPayLabel(estState.payMethod)}</b> (외주업체 대행)`;
    html+=`<div style="margin-top:8px;border-top:1px dashed var(--gray-300);padding-top:8px;line-height:1.9">`;
    html+=`<div>· 실수령액 = 합계(<b>${won(total)}</b>) - 외주업체 결제 수수료 ${pct}%(<span style="color:#e03131">${won(cut)}</span>) = <b style="color:#1971c2">${won(net)}</b></div>`;
    if(refund>0) html+=`<div>· 매입 부가세 환급 = <b style="color:#0ca678">+${won(refund)}</b></div>`;
    html+=`</div>`;
    html+=`<div style="margin-top:8px;padding:8px 0;border-top:2px solid var(--gray-300)">`;
    html+=`<div style="font-weight:800;font-size:14px">· 최종 실수령 = <b style="color:#1971c2;font-size:16px">${won(finalNet)}</b></div>`;
    html+=`<div style="color:var(--gray-400);font-size:12px;margin:2px 0 0 12px">실수령액(${won(net)})${refund>0?` + 매입부가세환급(${won(refund)})`:''}</div>`;
    html+=`</div>`;
    html+=`<div style="margin-top:6px;padding:8px 0;border-top:2px solid var(--gray-300)">`;
    html+=`<div style="font-weight:800;font-size:14px">· 최종 순이익 = <b style="color:#2b8a3e;font-size:16px">${won(finalProfit)}</b></div>`;
    html+=`<div style="color:var(--gray-400);font-size:12px;margin:2px 0 0 12px">최종 실수령(${won(finalNet)}) - 매입비(${won(realCost)})</div>`;
    html+=`</div>`;
  } else {
    html+=`💵 <b>${estPayLabel(estState.payMethod)}</b> (고객 직접 지급)`;
    html+=`<div style="margin-top:8px;border-top:1px dashed var(--gray-300);padding-top:8px;line-height:1.9">`;
    html+=`<div>· 실수령액 = <b style="color:#1971c2">${won(total)}</b> <span style="color:var(--gray-400)">(수수료 없음)</span></div>`;
    if(refund>0) html+=`<div>· 매입 부가세 환급 = <b style="color:#0ca678">+${won(refund)}</b></div>`;
    html+=`</div>`;
    html+=`<div style="margin-top:6px;padding:8px 0;border-top:2px solid var(--gray-300)">`;
    html+=`<div style="font-weight:800;font-size:14px">· 최종 순이익 = <b style="color:#2b8a3e;font-size:16px">${won(finalProfit)}</b></div>`;
    html+=`<div style="color:var(--gray-400);font-size:12px;margin:2px 0 0 12px">실수령(${won(total)})${refund>0?` + 매입부가세환급(${won(refund)})`:''} - 매입비(${won(realCost)})</div>`;
    html+=`</div>`;
  }
  el.innerHTML=html;
}
function estAddRow(){ estSyncAll(); estState.rows.push({cat:'',name:'',qty:1,cost:'',margin:estState.bulk}); estBody(); }
function estDelRow(btn){ estSyncAll(); const i=Number(btn.closest('tr').getAttribute('data-i')); if(i>=0) estState.rows.splice(i,1); estBody(); }
function estApplyBulk(){ estSyncAll(); estState.rows.forEach(r=>r.margin=estState.bulk); estBody(); }
function estReset(){ if(!confirm('견적 항목을 초기화할까요? (품목·매입가·합계 입력이 모두 지워집니다)'))return;
  estSyncAll();
  estState.rows=EST_CATS.map(c=>({cat:c,name:'',qty:1,cost:'',margin:estState.bulk}));
  estState.realCost=''; estState.purchaseDate='';
  _estForceRender=true; render();   // 화면 전체 다시 그려 입력칸까지 초기화
}
// 가져오기: 누를 때마다 기존 부품표를 버리고 새로 받음(중복 누적 방지, 초기화 불필요).
// 헤더(회사·고객·일자 등)는 보존하고 표만 교체.
function estAddItems(items){ estSyncAll();
  estState.rows=EST_CATS.map(c=>({cat:c,name:'',qty:1,cost:'',margin:estState.bulk}));
  (items||[]).forEach(it=>{ const cat=(it.cat||'').trim(), name=(it.name||'').trim(), cost=(Number(it.price)||''), qty=(Number(it.qty)||1);
    const empty=estState.rows.find(r=>r.cat===cat && !String(r.name).trim());
    if(empty){ empty.name=name; empty.qty=qty; empty.cost=cost; empty.price=''; empty.margin=estState.bulk; }
    else estState.rows.push({cat,name,qty,cost,price:'',margin:estState.bulk}); });
  estBody();
}
function estRows(){ return estState? estState.rows.map(r=>{ const cost=Number(r.cost)||0, margin=Number(r.margin)||0, qty=Number(r.qty)||0;
  const price=(r.price!=null&&r.price!=='')?(Number(String(r.price).replace(/[^\d]/g,''))||0):Math.round(cost*(1+margin/100));
  return { cat:(r.cat||'').trim(), name:(r.name||'').trim(), qty, cost, margin, price, amt:price*qty }; }) : []; }
// 품명 간략화: [브랜드]·(스펙)·끝의 상품번호·벌크/포함미포함 등을 떼고 핵심 모델명만
function czShortName(name){
  let s=String(name||'');
  s=s.replace(/\[[^\]]*\]/g,' ');            // [INTEL] [벌크/쿨러 미포함] 등 제거
  s=s.replace(/\([^)]*\)/g,' ');             // (14세대/... ) 등 제거
  s=s.replace(/\s*-\s*\d{4,}\s*$/,' ');       // 끝의 " - 1108545" 상품번호 제거
  s=s.replace(/정품벌크|벌크|병행|정품|쿨러\s*미포함|쿨러\s*포함|미포함|멀티팩|대리점정품/g,' ');
  s=s.replace(/\s{2,}/g,' ').replace(/^[\s\-·/]+|[\s\-·/]+$/g,'').trim();
  return s || String(name||'').trim();
}
// 고객용 금지어 제거 — 매입처가 드러나는 '컴퓨존'·'아이웍스'는 고객에게 절대 노출 금지(실수 방지)
function custClean(s){
  let t=String(s||'');
  t=t.replace(/\[[^\]]*(컴퓨존|아이웍스)[^\]]*\]/g,' ');   // [컴퓨존] 등 태그 통째 제거
  t=t.replace(/아이웍스\s*[0-9]*(?:-[0-9A-Za-z]+)?/g,' ');  // 아이웍스 / 아이웍스3 / 아이웍스5-5207
  t=t.replace(/컴퓨존/g,' ');
  t=t.replace(/\s{2,}/g,' ').replace(/^[\s\-·/,]+|[\s\-·/,]+$/g,'').trim();
  return t;
}
// 견적서 본문(제목~비고) 생성 — 인쇄·미리보기 공용. target: 'customer' | 'internal'
function estDocInner(target, copyLabel, overrideRows, isLastPage){
  const internal = target==='internal';
  const rows=overrideRows||estRows().filter(r=>r.name||r.amt);
  const allRows=estRows().filter(r=>r.name||r.amt);
  let sub=allRows.reduce((t,r)=>t+r.amt,0), vat=estState.noVat?0:Math.round(sub*0.1), total=sub+vat;
  const totCost=rows.reduce((t,r)=>t+(Number(r.cost)||0)*(Number(r.qty)||0),0), profit=sub-totCost;
  const company=esc(estState.company)||'(회사명)', contact=esc(estState.contact), customer=esc(estState.customer)||'(고객)', date=esc(estState.date), no=esc(estState.no), memo=esc(estState.memo);
  // 옵션(내부용은 항상 전체 상세 + 개별 금액)
  const nameMode = internal ? 'full' : (estState.pname||'full');
  const priceMode = internal ? 'each' : (estState.pprice||'each');
  const showName = nameMode!=='cat', showEach = priceMode==='each';
  const clean = internal ? (x=>x) : custClean;   // 고객용만 금지어(컴퓨존·아이웍스) 제거
  const dispName = r => clean(nameMode==='short' ? czShortName(r.name) : r.name);
  // 표준 문서(거래명세서·세금계산서·간이영수증)는 전용 표준 양식으로 렌더
  const dtype = estState.doctype||'estimate';
  if(dtype!=='estimate') return stdDoc(dtype, { rows, date, no, memo, dispName, totalSub:sub, totalVat:vat, totalAmt:total }, copyLabel, isLastPage);
  const cols = ['No','분류'];
  if(showName) cols.push('품명 / 사양');
  cols.push('수량');
  if(internal){ cols.push('매입가','마진'); }
  if(showEach){ cols.push('단가','금액'); }
  const thW = { 'No':'36px','분류':'78px','수량':'46px','매입가':'86px','마진':'46px','단가':'96px','금액':'104px' };
  const thead = cols.map(c=>`<th${thW[c]?` style="width:${thW[c]}"`:''}>${c}</th>`).join('');
  const body = rows.map((r,i)=>{
    const cells = [`<td style="text-align:center">${i+1}</td>`, `<td style="text-align:center;color:#666">${esc(r.cat)||''}</td>`];
    if(showName) cells.push(`<td>${esc(dispName(r))}</td>`);
    cells.push(`<td style="text-align:center">${r.qty}</td>`);
    if(internal){ cells.push(`<td style="text-align:right;color:#888">${won(r.cost)}</td>`, `<td style="text-align:center;color:#888">${r.margin}%</td>`); }
    if(showEach){ cells.push(`<td style="text-align:right">${won(r.price)}</td>`, `<td style="text-align:right">${won(r.amt)}</td>`); }
    return `<tr>${cells.join('')}</tr>`;
  }).join('') || `<tr><td colspan="${cols.length}" style="text-align:center;color:#aaa;padding:20px">품목을 입력하세요</td></tr>`;
  const feeRt=estFeeRate(), feePct=Math.round(feeRt*10000)/100, feeCut=Math.round(total*feeRt);
  const sumRows = `<tr><td>공급가액</td><td style="text-align:right">${won(sub)}</td></tr>
      <tr><td>부가세(10%)</td><td style="text-align:right">${won(vat)}</td></tr>
      <tr class="tot"><td>합계금액</td><td style="text-align:right">${won(total)}</td></tr>
      <tr><td>결제방법</td><td style="text-align:right">${estPayLabel(estState.payMethod)}</td></tr>`
    + (internal ? (function(){
      const rc=Number(String(estState.realCost||'').replace(/[^\d]/g,''))||0;
      const useOut=feeRt>0;
      const autoRf=rc>0?(rc-Math.round(rc/1.1)):0;
      const rf=(estState.refundManual!=null)?estState.refundManual:autoRf;
      const net=total-feeCut;          // 실수령액
      const finalNet=net+rf;           // 최종 실수령 = 실수령액 + 매입환급
      const finalProfit=finalNet-rc;  // 최종 순이익 = 최종 실수령 - 매입비
      return `<tr style="color:#888"><td>${rc>0?'실제 매입가':'총매입가'}</td><td style="text-align:right">${won(rc>0?rc:totCost)}</td></tr>
      ${useOut?`<tr style="color:#e03131"><td>외주업체 결제 수수료(${feePct}%)</td><td style="text-align:right">-${won(feeCut)}</td></tr>
      <tr style="color:#1971c2"><td>실수령액</td><td style="text-align:right">${won(net)}</td></tr>`:''}
      ${rf>0?`<tr style="color:#0ca678"><td>매입 부가세 환급</td><td style="text-align:right">+${won(rf)}</td></tr>`:''}
      ${useOut?`<tr style="color:#1971c2;font-weight:700;border-top:1px dashed #ccc"><td>최종 실수령(실제 수금액)</td><td style="text-align:right">${won(finalNet)}</td></tr>`:''}
      <tr style="color:#2b8a3e;font-weight:800;border-top:2px solid #ccc"><td>최종 순이익</td><td style="text-align:right">${won(finalProfit)}</td></tr>`;
    })() : '');
  // 문서 종류별 제목·라벨·문구
  const dt = estState.doctype||'estimate';
  const DT = {
    estimate:  { t:'견 적 서',    dl:'견적일', receipt:false },
    statement: { t:'거 래 명 세 서', dl:'거래일', receipt:false },
    receipt:   { t:'영 수 증',    dl:'거래일', receipt:true },
    tax:       { t:'세 금 계 산 서', dl:'작성일', receipt:false, tax:true },
  }[dt] || { t:'견 적 서', dl:'견적일' };
  const title = internal ? esc(DT.t)+' <span style="font-size:14px;color:#c00;letter-spacing:0">(내부용)</span>' : esc(DT.t);
  const taxNote = DT.tax ? `<div style="font-size:11px;color:#c00;margin-top:6px">※ 세금계산서는 사업자정보·서명 등 정식 항목 추가 예정(현재 임시 양식)</div>` : '';
  const receiptNote = DT.receipt ? `<div style="margin-top:14px;text-align:center;font-size:15px;font-weight:700">위 금액을 정히 영수함</div>` : '';
  const S=state.settings||{};
  const supTel=esc(S.biz_tel||contact||'');
  const buyTel=esc(estState.phone||'');
  const dp=String(date||'').split('-'), fmtDate=dp.length===3?`${dp[0]}.${dp[1]}.${dp[2]}`:(date||'');
  const B='border:2px solid var(--print-border,#333);padding:4px 6px;font-size:12px';
  const L='border:2px solid var(--print-border,#333);padding:4px 6px;font-size:12px;background:var(--hover-bg,#f2f4f8)';
  const stampSpan=(state.settings||{}).stamp_img?'<span style="position:relative;display:inline-block"><span style="position:relative;z-index:0"> (인)</span><img src="'+((state.settings||{}).stamp_img)+'" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;object-fit:contain;z-index:1;opacity:0.85"></span>':' (인)';
  const sup={bizno:esc(S.biz_no||''),nm:esc(S.brand_name||company||''),ceo:esc(S.biz_ceo||''),addr:esc(S.biz_addr||''),bt:esc(S.biz_type||''),bi:esc(S.biz_item||''),tel:supTel};
  const buy={bizno:esc(estState.buyerBizno||''),nm:esc(estState.customer||''),ceo:esc(estState.buyerCeo||''),addr:esc(estState.buyerAddr||''),bt:esc(estState.buyerType||''),bi:esc(estState.buyerItem||''),tel:buyTel};
  const bizHeader=`<table class="est-biz-unified"><colgroup><col style="width:11%"><col style="width:14%"><col style="width:7%"><col style="width:7%"><col style="width:11%"><col style="width:11%"><col style="width:14%"><col style="width:7%"><col style="width:7%"><col style="width:11%"></colgroup>
    <tr><td colspan="5" style="text-align:center;font-weight:700;font-size:13px;background:var(--dday-today-bg,#e8f4f8);${B}">공급받는자</td><td colspan="5" style="text-align:center;font-weight:700;font-size:13px;background:var(--primary-light,#dbeafe);${B}">공급자</td></tr>
    <tr><td style="${L}">견적번호</td><td colspan="4" style="${B}">${no}</td><td style="${L}">견적번호</td><td colspan="4" style="${B}">${no}</td></tr>
    <tr><td style="${L}">견적일자</td><td style="${B}">${fmtDate}</td><td style="${L}">견적유효</td><td colspan="2" style="${B}">금일</td><td style="${L}">견적일자</td><td style="${B}">${fmtDate}</td><td style="${L}">견적유효</td><td colspan="2" style="${B}">금일</td></tr>
    <tr><td style="${L}">사업자번호</td><td colspan="4" style="${B}">${buy.bizno}</td><td style="${L}">사업자번호</td><td colspan="4" style="${B}">${sup.bizno}</td></tr>
    <tr><td style="${L}">상호명</td><td colspan="2" style="${B}">${buy.nm}</td><td style="${L}">대표</td><td style="${B}">${buy.ceo}</td><td style="${L}">상호명</td><td colspan="2" style="${B}">${sup.nm}</td><td style="${L}">대표</td><td style="${B}">${sup.ceo}${stampSpan}</td></tr>
    <tr><td style="${L}">주소</td><td colspan="4" style="${B}">${buy.addr}</td><td style="${L}">주소</td><td colspan="4" style="${B}">${sup.addr}</td></tr>
    <tr><td style="${L}">업태</td><td colspan="2" style="${B}">${buy.bt}</td><td style="${L}">종목</td><td style="${B}">${buy.bi}</td><td style="${L}">업태</td><td colspan="2" style="${B}">${sup.bt}</td><td style="${L}">종목</td><td style="${B}">${sup.bi}</td></tr>
    <tr><td style="${L}">대표전화</td><td colspan="4" style="${B}">${buy.tel}</td><td style="${L}">대표전화</td><td colspan="4" style="${B}">${sup.tel}</td></tr>
  </table>`;
  return `<h1>${title}</h1>
    ${bizHeader}
    <table class="items"><thead><tr>${thead}</tr></thead><tbody>${body}</tbody></table>
    <table class="sum">${sumRows}</table>
    ${receiptNote}${taxNote}
    ${(clean(memo))?`<div class="memo">비고: ${clean(memo)}</div>`:''}`;
}
const EST_DOC_CSS = `h1{text-align:center;letter-spacing:8px;border-bottom:3px solid var(--print-border,#333);padding-bottom:10px}
    .est-biz-unified{width:100%;border-collapse:collapse;table-layout:fixed;margin:12px 0 10px}.est-biz-unified td{border:2px solid var(--print-border,#333);padding:4px 6px;font-size:12px}
    table.items{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
    table.items th,table.items td{border:2px solid var(--print-border,#333);padding:7px 8px}
    table.items th{background:var(--hover-bg,#f2f4f8)}
    .sum{margin-top:12px;margin-left:auto;width:300px;font-size:14px}
    .sum td{border:none;padding:4px 8px}.sum .tot{border-top:2px solid var(--print-border,#333);font-weight:900;font-size:17px}
    .memo{margin-top:14px;font-size:12px;color:#555;white-space:pre-wrap}`;
// ── 대한민국 표준 문서 양식 (거래명세서·세금계산서·간이영수증) ──
function nfmt(n){ return Number(n||0).toLocaleString('ko-KR'); }
function bizInfoTable(label,x,color){
  const stamp = (label==='공급자') ? stampImg(42) : '';   // 공급자 성명 옆 날인
  const bc='border:2px solid var(--print-border,#333);padding:4px 6px';
  const lbg='background:var(--hover-bg,#f2f4f8)';
  return `<table style="width:100%;font-size:11px;table-layout:fixed;border-collapse:collapse">
    <tr><td rowspan="4" style="width:20px;text-align:center;background:${color};font-weight:700;padding:2px;${bc}">${label.split('').join('<br>')}</td>
        <td style="width:62px;${lbg};${bc}">등록번호</td><td colspan="3" style="${bc}">${x.bizno}</td></tr>
    <tr><td style="${lbg};${bc}">상호</td><td style="${bc}">${x.nm}</td><td style="width:44px;${lbg};${bc}">성명</td><td style="${bc}">${x.ceo}<span style="position:relative;display:inline-block"> (인)${stamp?'<img src="'+((state.settings||{}).stamp_img||'')+'" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:42px;height:42px;object-fit:contain;opacity:0.85">':''}</span></td></tr>
    <tr><td style="${lbg};${bc}">주소</td><td colspan="3" style="${bc}">${x.addr}</td></tr>
    <tr><td style="${lbg};${bc}">업태</td><td style="${bc}">${x.bt}</td><td style="${lbg};${bc}">종목</td><td style="${bc}">${x.bi}</td></tr>
  </table>`;
}
function stdDoc(dtype, ctx, copyLabel, isLastPage){
  const S=state.settings||{};
  const sup={ bizno:esc(S.biz_no||''), nm:esc((S.brand_name||estState.company||'(상호)')), ceo:esc(S.biz_ceo||''), addr:esc(S.biz_addr||''), bt:esc(S.biz_type||''), bi:esc(S.biz_item||''), tel:esc(S.biz_tel||estState.contact||'') };
  const buy={ bizno:esc(estState.buyerBizno||''), nm:esc(estState.customer||'(공급받는자)'), ceo:esc(estState.buyerCeo||''), addr:esc(estState.buyerAddr||''), bt:esc(estState.buyerType||''), bi:esc(estState.buyerItem||''), tel:esc(estState.phone||'') };
  const items=ctx.rows.filter(r=>r.name||r.amt);
  const sub=ctx.totalSub!=null?ctx.totalSub:items.reduce((t,r)=>t+r.amt,0);
  const vat=ctx.totalVat!=null?ctx.totalVat:((estState&&estState.noVat)?0:Math.round(sub*0.1));
  const total=ctx.totalAmt!=null?ctx.totalAmt:(sub+vat);
  const memo=custClean(ctx.memo||'');
  if(dtype==='receipt') return stdReceipt(sup,buy,items,sub,vat,total,ctx,memo,copyLabel);
  if(dtype==='statement') return stdStatement(sup,buy,items,sub,vat,total,ctx,memo,copyLabel);
  return stdTaxOrStmt(dtype,sup,buy,items,sub,vat,total,ctx,memo,copyLabel,isLastPage);
}
// 거래명세표 — 좌: 권/호·제목·년월일·귀하·"아래와 같이 계산합니다", 우: 공급자 그리드 (표준 통합 헤더)
function stdStatement(sup,buy,items,sub,vat,total,ctx,memo,copyLabel){
  const dp=String(ctx.date||'').split('-'), yy=dp[0]||'', mm=dp[1]||'', dd=dp[2]||'';
  const cust=esc(estState.customer||'');   // 비어있으면 손으로 쓸 수 있게 공란
  const left=`
    <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11px">
      <span>권 <span style="display:inline-block;min-width:34px;border-bottom:1px solid #333">&nbsp;</span>　호 <span style="display:inline-block;min-width:34px;border-bottom:1px solid #333">&nbsp;</span></span>
      <span>${yy} 년 ${mm} 월 ${dd} 일</span></div>
    <div style="text-align:center;font-size:20px;font-weight:800;letter-spacing:8px;margin:8px 0 2px">거 래 명 세 표</div>
    <div style="text-align:center;font-size:11px;color:#555">(공급받는자용)${copyLabel&&copyLabel!=='공급받는자용'?' · '+esc(copyLabel):''}</div>
    <div style="text-align:right;font-size:18px;font-weight:800;margin:16px 0 8px">${cust} 귀하</div>
    <div style="font-size:12px">아래와 같이 계산합니다.</div>`;
  const B='border:2px solid var(--print-border,#333);padding:4px 6px;font-size:11px';
  const L='border:2px solid var(--print-border,#333);padding:4px 6px;font-size:11px;background:var(--hover-bg,#f2f4f8);text-align:center';
  const header=`<table style="border-collapse:collapse;width:100%;table-layout:fixed;margin-top:4px"><tbody>
    <tr><td rowspan="4" style="width:48%;vertical-align:top;${B}">${left}</td>
        <td style="width:66px;${L}">등록번호</td><td colspan="3" style="${B}">${sup.bizno}</td></tr>
    <tr><td style="${L}">상　호</td><td style="${B}">${sup.nm}</td><td style="width:42px;${L}">성명</td><td style="${B}">${sup.ceo}<span style="position:relative;display:inline-block"> (인)<img src="${(state.settings||{}).stamp_img||''}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;object-fit:contain;opacity:0.85"></span></td></tr>
    <tr><td style="${L}">사업장<br>소재지</td><td colspan="3" style="${B}">${sup.addr}</td></tr>
    <tr><td style="${L}">업　태</td><td style="${B}">${sup.bt}</td><td style="${L}">종목</td><td style="${B}">${sup.bi}</td></tr>
  </tbody></table>`;
  const TB='border:2px solid var(--print-border,#333);padding:4px 5px;font-size:11px';
  const TH='border:2px solid var(--print-border,#333);padding:4px 5px;font-size:11px;background:var(--hover-bg,#f2f4f8);text-align:center';
  const body=items.map(r=>{ const amt=r.amt, tax=Math.round(amt*0.1);
    return `<tr><td style="text-align:center;${TB}">${mm}</td><td style="text-align:center;${TB}">${dd}</td>
      <td style="${TB}">${esc(ctx.dispName(r))}</td><td style="${TB}"></td><td style="text-align:center;${TB}">${r.qty}</td>
      <td style="text-align:right;${TB}">${nfmt(r.price)}</td><td style="text-align:right;${TB}">${nfmt(amt)}</td>
      <td style="text-align:right;${TB}">${nfmt(tax)}</td><td style="${TB}"></td></tr>`; }).join('');
  return `${header}
    <table style="border-collapse:collapse;width:100%;margin-top:6px"><thead><tr>
      <th style="width:26px;${TH}">월</th><th style="width:26px;${TH}">일</th><th style="${TH}">품목</th><th style="width:56px;${TH}">규격</th><th style="width:42px;${TH}">수량</th><th style="width:78px;${TH}">단가</th><th style="width:90px;${TH}">공급가액</th><th style="width:78px;${TH}">세액</th><th style="width:46px;${TH}">비고</th></tr></thead>
      <tbody>${body||`<tr><td colspan="9" style="text-align:center;color:#aaa;padding:16px;${TB}">품목 없음</td></tr>`}</tbody></table>
    <table style="border-collapse:collapse;width:100%;margin-top:6px"><tr>
      <td style="width:80px;font-weight:700;${TH}">합계금액</td>
      <td style="text-align:right;font-weight:800;${TB}">${nfmt(total)} 원</td>
      <td style="text-align:center;color:#555;width:180px;${TB}">공급가액 ${nfmt(sub)} · 세액 ${nfmt(vat)}</td></tr></table>
    ${memo?`<div class="memo">비고: ${memo}</div>`:''}`;
}
function stdTaxOrStmt(dtype,sup,buy,items,sub,vat,total,ctx,memo,copyLabel,isLastPage){
  const isTax=dtype==='tax';
  if(!isTax) return stdStatementFallback(sup,buy,items,sub,vat,total,ctx,memo,copyLabel);
  return stdTaxInvoice(sup,buy,items,sub,vat,total,ctx,memo,copyLabel,isLastPage);
}
function taxDC(num,count,b){
  const s=String(num||0).padStart(count,' ');
  return [...s].map(d=>`<td style="text-align:center;${b}">${d===' '?'':d}</td>`).join('');
}
function taxBN(bizno,b){
  const d=String(bizno||'').replace(/[^0-9]/g,'').padEnd(10,' ');
  const c=i=>`<td style="text-align:center;${b}">${d[i]===' '?'':d[i]}</td>`;
  return c(0)+c(1)+c(2)+`<td style="text-align:center;${b}">-</td>`+c(3)+c(4)+`<td style="text-align:center;${b}">-</td>`+c(5)+c(6)+c(7)+c(8)+c(9);
}
function stdTaxInvoice(sup,buy,items,sub,vat,total,ctx,memo,copyLabel,isLastPage){
  if(isLastPage===undefined) isLastPage=true;
  const dp=String(ctx.date||'').split('-'), yy=dp[0]||'', mm=dp[1]||'', dd=dp[2]||'';
  const b='border:1px solid #333;padding:1px 2px;font-size:9px';
  const lb=b+';text-align:center';
  const su=(state.settings||{}).stamp_img;
  const stp=su?'<span style="position:relative;display:inline-block">(인)<img src="'+su+'" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;object-fit:contain;opacity:0.85"></span>':'(인)';
  const isSupCopy=(copyLabel||'').includes('공급자 보관');
  const copyType=isSupCopy?'공 급 자':'공급받는자';
  const subDH=['백','십','억','천','백','십','만','천','백','십','일'].map(h=>`<td style="${lb};font-size:7px">${h}</td>`).join('');
  const vatDH=['십','억','천','백','십','만','천','백','십','일'].map(h=>`<td style="${lb};font-size:7px">${h}</td>`).join('');
  const itemRow=(r)=>{ const amt=r.amt, tax=Math.round(amt*0.1);
    const ov='white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0';
    return `<tr><td style="${lb}">${mm}</td><td style="${lb}">${dd}</td>
      <td colspan="6" style="${b};${ov}">${esc(ctx.dispName(r))}</td><td colspan="3" style="${b};${ov}"></td><td colspan="3" style="${lb}">${r.qty}</td>
      <td colspan="5" style="text-align:right;${b}">${nfmt(r.price)}</td><td colspan="6" style="text-align:right;${b}">${nfmt(amt)}</td>
      <td colspan="5" style="text-align:right;${b}">${nfmt(tax)}</td><td colspan="2" style="${b}"></td></tr>`; };
  const eR=`<tr><td style="${b}">&nbsp;</td><td style="${b}"></td><td colspan="6" style="${b}"></td><td colspan="3" style="${b}"></td><td colspan="3" style="${b}"></td><td colspan="5" style="${b}"></td><td colspan="6" style="${b}"></td><td colspan="5" style="${b}"></td><td colspan="2" style="${b}"></td></tr>`;
  const PER=8;
  const body=items.map(itemRow).join('');
  const blanks=Array(Math.max(0,PER-items.length)).fill(eR).join('');
  return `<div class="tax-copy" style="width:182mm;height:128mm;box-sizing:border-box;padding:2mm 3mm;overflow:hidden">
  <div style="font-size:7px;margin-bottom:1px">[별지 제11호 서식]</div>
  <table style="border-collapse:collapse;width:100%;table-layout:fixed;border:2px solid #333">
  <colgroup>${Array(32).fill('<col>').join('')}</colgroup>
  <tr><td colspan="15" rowspan="2" style="font-size:14px;font-weight:800;letter-spacing:10px;padding:4px;${lb}">세 금 계 산 서</td>
      <td rowspan="2" style="${lb}">(</td><td colspan="5" style="${lb};font-size:9px">${copyType}</td><td rowspan="2" style="${lb}">)</td>
      <td colspan="4" style="${lb};font-size:8px">책 번 호</td><td colspan="2" style="${lb}">권</td><td colspan="4" style="${lb}">호</td></tr>
  <tr><td colspan="5" style="${lb};font-size:8px">보 관 용</td>
      <td colspan="4" style="${lb};font-size:8px">일련번호</td><td colspan="6" style="${b}"></td></tr>
  <tr><td rowspan="4" style="${lb};writing-mode:vertical-lr;letter-spacing:4px;font-weight:700;font-size:10px">공급자</td>
      <td colspan="3" style="${lb}">등록번호</td>${taxBN(sup.bizno,b)}
      <td rowspan="4" style="${lb};writing-mode:vertical-lr;letter-spacing:2px;font-weight:700;font-size:8px">공급받는자</td>
      <td colspan="3" style="${lb}">등록번호</td>${taxBN(buy.bizno,b)}</tr>
  <tr><td colspan="3" style="${lb}">상 호<br>(법인명)</td><td colspan="6" style="${b}">${sup.nm}</td><td style="${lb}">성명</td><td colspan="4" style="${b}">${sup.ceo}</td><td style="${lb}">${stp}</td>
      <td colspan="3" style="${lb}">상 호<br>(법인명)</td><td colspan="6" style="${b}">${buy.nm}</td><td style="${lb}">성명</td><td colspan="4" style="${b}">${buy.ceo}</td><td style="${lb}">(인)</td></tr>
  <tr><td colspan="3" style="${lb}">사업장<br>주 소</td><td colspan="12" style="${b}">${sup.addr}</td>
      <td colspan="3" style="${lb}">사업장<br>주 소</td><td colspan="12" style="${b}">${buy.addr}</td></tr>
  <tr><td colspan="3" style="${lb}">업 태</td><td colspan="6" style="${b}">${sup.bt}</td><td style="${lb}">종목</td><td colspan="5" style="${b}">${sup.bi}</td>
      <td colspan="3" style="${lb}">업 태</td><td colspan="6" style="${b}">${buy.bt}</td><td style="${lb}">종목</td><td colspan="5" style="${b}">${buy.bi}</td></tr>
  <tr><td colspan="4" style="${lb};font-weight:700">작 성</td><td colspan="13" style="${lb};font-weight:700">공 급 가 액</td><td colspan="10" style="${lb};font-weight:700">세 액</td><td colspan="5" style="${lb}">비 고</td></tr>
  <tr><td colspan="2" style="${lb};font-size:7px">년</td><td style="${lb};font-size:7px">월</td><td style="${lb};font-size:7px">일</td><td colspan="2" style="${lb};font-size:7px">공란수</td>${subDH}${vatDH}<td colspan="5" style="${b}"></td></tr>
  <tr><td colspan="2" style="${lb}">${yy}</td><td style="${lb}">${mm}</td><td style="${lb}">${dd}</td><td colspan="2" style="${b}"></td>${taxDC(sub,11,b)}${taxDC(vat,10,b)}<td colspan="5" style="${b}"></td></tr>
  <tr><td style="${lb}">월</td><td style="${lb}">일</td><td colspan="6" style="${lb}">품 목</td><td colspan="3" style="${lb}">규격</td><td colspan="3" style="${lb}">수량</td><td colspan="5" style="${lb}">단 가</td><td colspan="6" style="${lb}">공 급 가 액</td><td colspan="5" style="${lb}">세 액</td><td colspan="2" style="${lb}">비고</td></tr>
  ${body}${blanks}
  <tr><td colspan="5" style="${lb};font-weight:700">합계금액</td><td colspan="5" style="${lb}">현 금</td><td colspan="5" style="${lb}">수 표</td><td colspan="5" style="${lb}">어 음</td><td colspan="5" style="${lb}">외상미수금</td><td colspan="4" rowspan="2" style="${lb};vertical-align:middle;font-size:8px">이 금액을</td><td colspan="2" rowspan="2" style="${lb};vertical-align:middle;font-size:9px;font-weight:700">영수<br>청구</td><td rowspan="2" style="${lb};vertical-align:middle;font-size:9px">함</td></tr>
  <tr><td colspan="5" style="text-align:center;font-weight:800;font-size:10px;${b}">${isLastPage?'₩'+nfmt(total):''}</td><td colspan="5" style="${b}"></td><td colspan="5" style="${b}"></td><td colspan="5" style="${b}"></td><td colspan="5" style="${b}">${isLastPage?'':'→ 다음장'}</td></tr>
  </table>
  <div style="display:flex;justify-content:space-between;margin-top:1px;font-size:7px;color:#333"><span>22226-28131일 '96.3.27승인</span><span>인쇄용지(특급)34g/m2 182mm×128mm</span></div>
  </div>`;
}
function stdStatementFallback(sup,buy,items,sub,vat,total,ctx,memo,copyLabel){
  const dp=String(ctx.date||'').split('-'), mm=dp[1]||'', dd=dp[2]||'';
  const body=items.map(r=>{ const amt=r.amt, tax=Math.round(amt*0.1);
    return `<tr><td style="text-align:center">${mm}</td><td style="text-align:center">${dd}</td>
      <td>${esc(ctx.dispName(r))}</td><td></td><td style="text-align:center">${r.qty}</td>
      <td style="text-align:right">${nfmt(r.price)}</td><td style="text-align:right">${nfmt(amt)}</td>
      <td style="text-align:right">${nfmt(tax)}</td><td></td></tr>`; }).join('');
  return `<h1 style="letter-spacing:12px">거 래 명 세 표</h1>
    <div style="text-align:center;font-size:12px;color:#555;margin-top:2px">(${esc(copyLabel||'공급받는자용')})</div>
    <table style="margin-top:10px"><tr>
      <td style="width:50%;vertical-align:middle;text-align:center">
         <div style="font-size:12px;color:#555">${esc(ctx.date)}</div>
         <div style="font-size:18px;font-weight:800;margin:8px 0">${buy.nm} 귀하</div>
         <div style="font-size:13px">아래와 같이 계산합니다.</div></td>
      <td style="width:50%;padding:0;vertical-align:top">${bizInfoTable('공급자',sup,'#eaf3ff')}</td></tr></table>
    <table style="margin-top:6px;font-size:12px;border-collapse:collapse"><tr>
      <td style="background:var(--hover-bg,#f2f4f8);width:70px;border:2px solid var(--print-border,#333);padding:4px 6px">작성일자</td><td style="border:2px solid var(--print-border,#333);padding:4px 6px">${esc(ctx.date)}</td>
      <td style="background:var(--hover-bg,#f2f4f8);width:70px;border:2px solid var(--print-border,#333);padding:4px 6px">공급가액</td><td style="text-align:right;border:2px solid var(--print-border,#333);padding:4px 6px">${nfmt(sub)}</td>
      <td style="background:var(--hover-bg,#f2f4f8);width:52px;border:2px solid var(--print-border,#333);padding:4px 6px">세액</td><td style="text-align:right;border:2px solid var(--print-border,#333);padding:4px 6px">${nfmt(vat)}</td></tr></table>
    <table style="margin-top:6px;font-size:12px;border-collapse:collapse"><thead><tr>
      <th style="width:26px;border:2px solid var(--print-border,#333);padding:4px 6px">월</th><th style="width:26px;border:2px solid var(--print-border,#333);padding:4px 6px">일</th><th style="border:2px solid var(--print-border,#333);padding:4px 6px">품목</th><th style="width:56px;border:2px solid var(--print-border,#333);padding:4px 6px">규격</th><th style="width:42px;border:2px solid var(--print-border,#333);padding:4px 6px">수량</th><th style="width:78px;border:2px solid var(--print-border,#333);padding:4px 6px">단가</th><th style="width:90px;border:2px solid var(--print-border,#333);padding:4px 6px">공급가액</th><th style="width:78px;border:2px solid var(--print-border,#333);padding:4px 6px">세액</th><th style="width:46px;border:2px solid var(--print-border,#333);padding:4px 6px">비고</th></tr></thead>
      <tbody>${body||`<tr><td colspan="9" style="text-align:center;color:#aaa;padding:16px;border:2px solid var(--print-border,#333)">품목 없음</td></tr>`}</tbody></table>
    <table style="margin-top:6px;font-size:13px;border-collapse:collapse"><tr>
      <td style="background:var(--hover-bg,#f2f4f8);width:80px;font-weight:700;border:2px solid var(--print-border,#333);padding:4px 6px">합계금액</td>
      <td style="text-align:right;font-weight:800;border:2px solid var(--print-border,#333);padding:4px 6px">${nfmt(total)} 원</td>
      <td style="text-align:center;color:#555;width:150px;border:2px solid var(--print-border,#333);padding:4px 6px">이 금액을 ( 청구 ) 함</td></tr></table>
    ${memo?`<div class="memo">비고: ${memo}</div>`:''}`;
}
function stdReceiptOne(sup,items,total,ctx,memo,copyLabel){
  const B='border:1px solid #333;padding:1px 2px;font-size:8px';
  const L=B+';text-align:center';
  const dp=String(ctx.date||'').split('-'), yy=dp[0]||'', mm=dp[1]||'', dd=dp[2]||'';
  const cust=esc(estState.customer||'');
  const ov='white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0';
  const itemRows=items.map(r=>`<tr>
    <td style="${L}">${mm}/${dd}</td>
    <td colspan="3" style="${B};${ov}">${esc(ctx.dispName(r))}</td>
    <td style="${L}">${r.qty}</td>
    <td style="text-align:right;${B}">${nfmt(r.price)}</td>
    <td colspan="2" style="text-align:right;${B}">${nfmt(r.amt)}</td></tr>`).join('');
  const BLANK=15;
  const blanks=Array(Math.max(0,BLANK-items.length)).fill(`<tr>
    <td style="${B}">&nbsp;</td><td colspan="3" style="${B}"></td>
    <td style="${B}"></td><td style="${B}"></td><td colspan="2" style="${B}"></td></tr>`).join('');
  return `<div style="text-align:center;font-size:13px;font-weight:800;letter-spacing:8px;padding:4px 0 1px">영 수 증</div>
    <div style="text-align:center;font-size:8px;color:#555;margin-bottom:2px">(${esc(copyLabel)})</div>
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:8px;border:2px solid #333">
    <colgroup><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:10%"><col style="width:8%"></colgroup>
    <tr><td colspan="2" style="${B}">NO. ${esc(ctx.no)}</td>
        <td colspan="7" style="text-align:right;font-size:10px;font-weight:700;padding:3px 4px;${B}">◎${cust}　귀하</td></tr>
    <tr><td rowspan="4" style="${L};font-weight:700;writing-mode:vertical-lr;letter-spacing:2px;font-size:9px">사업자</td>
        <td colspan="2" style="${L}">등록번호</td><td colspan="6" style="${B}">${sup.bizno}</td></tr>
    <tr><td colspan="2" style="${L}">상호</td><td colspan="3" style="${B}">${sup.nm}</td>
        <td style="${L}">대표자</td><td colspan="2" style="${B}">${sup.ceo}${stampImg(18)}</td></tr>
    <tr><td colspan="2" style="${L}">사업장<br>소재지</td><td colspan="6" style="${B}">${sup.addr}</td></tr>
    <tr><td colspan="2" style="${L}">업태</td><td colspan="2" style="${B}">${sup.bt}</td>
        <td colspan="2" style="${L}">종목</td><td colspan="2" style="${B}">${sup.bi}</td></tr>
    <tr><td colspan="2" style="${L}">작성일</td><td colspan="3" style="${L}">공급가 총액</td><td colspan="4" style="${L}">비고</td></tr>
    <tr><td colspan="2" style="text-align:center;padding:3px 2px;${B}">${yy}.${mm}.${dd}</td>
        <td colspan="3" style="text-align:center;font-weight:800;font-size:10px;padding:3px 2px;${B}">₩${nfmt(total)}</td>
        <td colspan="4" style="padding:3px 2px;${B}">${memo||''}</td></tr>
    <tr><td colspan="9" style="text-align:center;font-weight:700;font-size:9px;padding:2px 0;${B}">위 금액을 영수(청구)함.</td></tr>
    <tr><td style="${L}">월일</td><td colspan="3" style="${L}">품　목</td>
        <td style="${L}">수량</td><td style="${L}">단 가</td><td colspan="2" style="${L}">공급가액</td></tr>
    ${itemRows}${blanks}
    <tr><td colspan="3" style="text-align:center;font-weight:700;padding:3px 2px;${B}">합　계</td>
        <td style="${L}">₩</td><td colspan="5" style="text-align:right;font-weight:800;font-size:10px;padding:3px 2px;${B}">${nfmt(total)}</td></tr>
  </table>`;
}
function stdReceipt(sup,buy,items,sub,vat,total,ctx,memo,copyLabel){
  return stdReceiptOne(sup,items,total,ctx,custClean(ctx.memo||''),copyLabel||'공급받는자 보관용');
}
// 실시간 미리보기 — 옵션/입력이 바뀔 때마다 화면에 즉시 반영
function estRenderPreview(){
  const box=document.getElementById('est_preview'); if(!box||!estState) return;
  const target = (estState.ptarget==='internal') ? 'internal' : 'customer';
  box.innerHTML = `<div class="doc">${estDocInner(target)}</div>`;
}
// 견적서 인쇄. target: 'customer'(고객용) | 'internal'(내부용)
function estPrint(target){
  target = (target==='internal') ? 'internal' : 'customer';
  estSyncAll();
  if(!estRows().filter(r=>r.name||r.amt).length){ showToast('품목을 입력하세요','#e68900'); return; }
  const no=esc(estState.no), internal=target==='internal';
  const dt=estState.doctype||'estimate';
  // 문서별 용지·2부 출력
  let pageCss, bodyHtml;
  if(dt==='tax'){
    pageCss='@page{size:A4 portrait;margin:10mm}';
    const TAX_PER=8;
    const allItems=estRows().filter(r=>r.name||r.amt);
    const taxChunks=[];
    for(let i=0;i<Math.max(1,Math.ceil(allItems.length/TAX_PER));i++) taxChunks.push(allItems.slice(i*TAX_PER,(i+1)*TAX_PER));
    bodyHtml=taxChunks.map((chunk,ci)=>{
      const isLast=ci===taxChunks.length-1;
      const pgRows=chunk;
      const buyDoc=estDocInner(target,'공급받는자 보관용',pgRows,isLast);
      const supDoc=estDocInner(target,'공급자 보관용',pgRows,isLast);
      const pgBreak=ci>0?'style="page-break-before:always"':'';
      return `<div class="tax-a4" ${pgBreak}>${buyDoc}
        <div class="cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
        ${supDoc}</div>`;
    }).join('\n');
  } else if(dt==='statement'){
    pageCss='@page{size:A4 portrait;margin:8mm}';
    bodyHtml=`<div class="copy">${estDocInner(target,'공급받는자 보관용')}</div>
      <div class="cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
      <div class="copy">${estDocInner(target,'공급자 보관용')}</div>`;
  } else if(dt==='receipt'){
    pageCss='@page{size:A4 landscape;margin:8mm}';
    bodyHtml=`<div style="display:flex;gap:20px;justify-content:center;align-items:flex-start">
      <div class="rcpt-page">${estDocInner(target,'공급받는자 보관용')}</div>
      <div class="rcpt-page">${estDocInner(target,'공급자 보관용')}</div>
    </div>`;
  } else {
    pageCss='@page{size:A4 portrait;margin:12mm}';
    bodyHtml=estDocInner(target);
  }
  const isReceipt=dt==='receipt';
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc((estState.doctype||'견적서'))} ${no}</title>
    <style>:root{--print-border:#333;--hover-bg:#f2f4f8;--dday-today-bg:#e8f4f8;--primary-light:#dbeafe;--gray-300:#ccc;--card-bg:#fff}
    body{font-family:'Malgun Gothic',sans-serif;color:#222;padding:${isReceipt?'4px':'16px'};${isReceipt?'':'max-width:820px;'}margin:auto;background:#fff}
    ${EST_DOC_CSS}
    ${pageCss}
    .copy{}
    .rcpt{font-size:11px}
    .rcpt-page{width:86mm;height:190mm;box-sizing:border-box;overflow:hidden}
    .rcpt-page table{width:100%}
    .rcpt-page table td{word-break:break-all;overflow-wrap:break-word}
    .cut{color:#999;text-align:center;font-size:11px;margin:6mm 0;letter-spacing:1px}
    .pb{page-break-after:always}
    @media print{ button{display:none} .copy{page-break-inside:avoid} .tax-a4{page-break-after:always} .tax-a4:last-child{page-break-after:auto} }</style></head><body>
    ${bodyHtml}
    <div style="text-align:center;margin-top:24px"><button onclick="window.print()">🖨️ 인쇄</button></div>
    </body></html>`;
  const openUrl=navigator.userAgent.includes('Electron')?window.location.origin:'';
  const w=window.open(openUrl,'_blank'); if(!w){ showToast('팝업이 차단되었습니다. 허용 후 다시 시도하세요.','#e03131'); return; }
  w.document.write(html); w.document.close();
}
// 컴퓨존 견적 스크린샷 → 서버(Vision+AI) → 견적 항목 자동 채움
function estCompress(file){ return new Promise(resolve=>{ const rd=new FileReader();
  rd.onload=e=>{ const img=new Image(); img.onload=()=>{ let w=img.width,h=img.height; const max=1700;
    if(w>max||h>max){ if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;} }
    const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    resolve(c.toDataURL('image/jpeg',0.85)); }; img.onerror=()=>resolve(e.target.result); img.src=e.target.result; };
  rd.readAsDataURL(file); }); }
async function estAiImport(input){
  const f=input.files&&input.files[0]; input.value='';
  if(!f) return;
  const lbl=input.parentNode; const prev=lbl?lbl.innerHTML:''; if(lbl) lbl.textContent='⏳ 분석 중…';
  let r;
  try{ const d=await estCompress(f); r=await api('POST','/estimate/scan',{image:d}); }
  catch(e){ showToast('AI 가져오기 실패: '+(e&&e.message?e.message:e),'#e03131'); if(lbl)lbl.innerHTML=prev; return; }
  if(lbl)lbl.innerHTML=prev;
  const items=(r&&r.items)||[];
  if(!items.length){ showToast('견적 항목을 인식하지 못했습니다. 견적 목록이 잘 보이게 캡처했는지 확인해주세요.','#e68900'); return; }
  estAddItems(items);
  showToast(items.length+'개 항목을 가져왔습니다. 매입가·마진 확인 후 인쇄하세요.');
}
async function estPasteImport(btn){
  const t=(v('est_paste')||'').trim();
  if(!t){ showToast('붙여넣은 내용이 없습니다. 컴퓨존 견적서 소스복사의 [텍스트]를 붙여넣으세요.','#e68900'); return; }
  if(btn){ btn.disabled=true; btn.textContent='⏳ 분석 중…'; }
  let r;
  try{ r=await api('POST','/estimate/scan',{text:t}); }
  catch(e){ showToast('가져오기 실패: '+(e&&e.message?e.message:e),'#e03131'); if(btn){btn.disabled=false;btn.textContent='📋 이 내용 가져오기';} return; }
  if(btn){ btn.disabled=false; btn.textContent='📋 이 내용 가져오기'; }
  const items=(r&&r.items)||[];
  if(!items.length){ showToast('부품을 인식하지 못했습니다. 붙여넣은 내용을 확인해주세요.','#e68900'); return; }
  estAddItems(items);
  const box=document.getElementById('est_paste_box'); if(box)box.style.display='none';
  const ta=document.getElementById('est_paste'); if(ta)ta.value='';
  showToast(items.length+'개 항목을 가져왔습니다. 매입가·마진 확인 후 인쇄하세요.');
}
async function estUrlImport(btn){
  const u=(v('est_url')||'').trim();
  if(!u){ showToast('컴퓨존 URL 공유 링크를 입력하세요.','#e68900'); return; }
  if(btn){ btn.disabled=true; btn.textContent='⏳'; }
  let r;
  try{ r=await api('POST','/estimate/scan',{url:u}); }
  catch(e){ showToast('URL 가져오기 실패: '+(e&&e.message?e.message:e),'#e03131'); if(btn){btn.disabled=false;btn.textContent='가져오기';} return; }
  if(btn){ btn.disabled=false; btn.textContent='가져오기'; }
  const items=(r&&r.items)||[];
  if(!items.length){ showToast('부품을 인식하지 못했습니다. 소스·텍스트나 캡처 방식을 이용해보세요.','#e68900'); return; }
  estAddItems(items);
  const box=document.getElementById('est_url_box'); if(box)box.style.display='none';
  const el=document.getElementById('est_url'); if(el)el.value='';
  showToast(items.length+'개 항목을 가져왔습니다. 매입가·마진 확인 후 인쇄하세요.');
}

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
const PAY_METHODS = { cash:'현금', transfer:'계좌이체', cashreceipt:'현금영수증', card:'카드', tax:'세금계산서', unpaid:'미수' };
function payMethodLabel(m){ return PAY_METHODS[m] || m || '-'; }
// ── 결산 ──
const PM_LABEL = { cash:'현금', transfer:'계좌이체', cashreceipt:'현금영수증', card:'카드', tax:'세금계산서', unpaid:'미수금' };
// 대행업체(카드/계산서 경유) 설정 — 기사관리에서 변경. 이름/수수료율/사용여부 동적
function agencyName(){ const n=(state.settings||{}).agency_name; return (n&&n.trim())? n.trim() : '우리사무기'; }
function brandName(){ const n=(state.settings||{}).brand_name; return (n&&n.trim())? n.trim() : ''; }
// 외주 수수료는 결제수단별 요율(사업자관리)로 통일 — 결산·견적·매장판매 모두 적용
// 레코드의 적용 요율: 세금계산서 발행 시 fee_tax, 아니면 결제수단(fee_cash/transfer/card…). 둘 중 큰 값.
function feeRateRec(r){ const a=feeRate(r.payment_method||''), b=r.tax_invoice?feeRate('tax'):0; return Math.max(a||0,b||0); }
function agencyOn(){ return ['cash','transfer','cashreceipt','card','tax'].some(m=>feeRate(m)>0); }   // 하나라도 요율>0
function feePctRec(r){ return Math.round(feeRateRec(r)*10000)/100; }
function isWoori(r){ return feeRateRec(r)>0; }   // 외주 수수료 대상
function recRevenue(r){ return (Number(r.labor_fee)||0)+(Number(r.parts_fee)||0)+(Number(r.visit_fee)||0); }
function wooriCut(r){ return Math.round(recRevenue(r)*feeRateRec(r)); }
function recVatRefund(r){ return Number(r.vat_refund)||0; }
function mySettle(r){ return recRevenue(r)-wooriCut(r)+recVatRefund(r); }
let settleState = { y:null, m:null };
function settleMove(d){ let m=settleState.m+d, y=settleState.y; if(m<0){m=11;y--;} if(m>11){m=0;y++;} settleState.m=m; settleState.y=y; renderInto(); }
async function doWooriSettle(id){ await api('PUT',`/receptions/${id}/woori-settle`,{settled:true}); await loadAll(); render(); }
async function doWooriSettleSale(id){ await api('PUT',`/sales/${id}/woori-settle`,{settled:true}); await loadAll(); render(); }

async function printAgencySettlement(year, month){
  let data;
  try{ data=await api('GET',`/agency-settlement?year=${year}&month=${month}`); }
  catch(e){ showToast('정산 데이터 조회 실패','#e03131'); return; }
  const recs=data.receptions||[], sales=data.sales||[];
  const agName=agencyName(), brName=brandName()||agName;
  const st=state.settings||{};
  const myBizName=(st.company_name||'').trim()||(st.brand_name||'').trim()||'';
  const myBizNo=(st.biz_no||'').trim();
  const myCeo=(st.biz_ceo||'').trim();

  const agencyRecs=recs.filter(r=>feeRateRec(r)>0);
  const agencySales=sales.filter(s=>feeRateRec(s)>0);

  const vatRecs=recs.filter(r=>{
    if(!r.estimate_id) return false;
    return (Number(r.vat_refund)||0)>0;
  });

  let rowNum=0;
  let agencyRows='', agencyTotalRev=0, agencyTotalFee=0, agencyTotalPay=0;
  agencyRecs.forEach(r=>{
    const rev=recRevenue(r);
    const fee=wooriCut(r);
    const pay=rev-fee;
    agencyTotalRev+=rev; agencyTotalFee+=fee; agencyTotalPay+=pay;
    rowNum++;
    agencyRows+=`<tr>
      <td style="text-align:center">${rowNum}</td>
      <td style="text-align:center">${(r.completed_at||'').slice(0,10)}</td>
      <td>${r.est_no||('#'+r.id)}</td>
      <td style="text-align:center">${PM_LABEL[r.payment_method]||r.payment_method||''}${r.tax_invoice?'/계산서':''}</td>
      <td style="text-align:right">${won(rev)}</td>
      <td style="text-align:right;color:#c00">${won(fee)}</td>
      <td style="text-align:right;font-weight:700">${won(pay)}</td>
    </tr>`;
  });
  agencySales.forEach(s=>{
    const rev=Number(s.total_price)||0;
    const fee=Math.round(rev*feeRateRec(s));
    const pay=rev-fee;
    agencyTotalRev+=rev; agencyTotalFee+=fee; agencyTotalPay+=pay;
    rowNum++;
    agencyRows+=`<tr>
      <td style="text-align:center">${rowNum}</td>
      <td style="text-align:center">${(s.sale_date||'').slice(0,10)}</td>
      <td>판매: ${esc(s.item_name)}</td>
      <td style="text-align:center">${PM_LABEL[s.payment_method]||s.payment_method||''}${s.tax_invoice?'/계산서':''}</td>
      <td style="text-align:right">${won(rev)}</td>
      <td style="text-align:right;color:#c00">${won(fee)}</td>
      <td style="text-align:right;font-weight:700">${won(pay)}</td>
    </tr>`;
  });

  let vatNum=0, vatRows='', vatTotal=0;
  vatRecs.forEach(r=>{
    const opts=typeof r.opts==='string'?JSON.parse(r.opts):(r.opts||{});
    const realCost=Number(String(opts.realCost||'').replace(/[^\d]/g,''))||0;
    const refund=Number(r.vat_refund)||0;
    vatTotal+=refund;
    vatNum++;
    vatRows+=`<tr>
      <td style="text-align:center">${vatNum}</td>
      <td style="text-align:center">${r.purchase_date||(r.completed_at||'').slice(0,10)}</td>
      <td>${r.est_no||('#'+r.id)}</td>
      <td style="text-align:right">${won(r.est_total||0)}</td>
      <td style="text-align:right">${won(realCost)}</td>
      <td style="text-align:right;font-weight:700;color:#0ca678">${won(refund)}</td>
    </tr>`;
  });

  const grandTotal=agencyTotalPay+vatTotal;

  const html=`<!doctype html><html><head><meta charset="utf-8"><title>외주업체 정산서 ${year}년 ${month}월</title>
<style>
  body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222;padding:20px;max-width:820px;margin:auto;font-size:13px}
  h1{font-size:20px;text-align:center;margin:0 0 4px;letter-spacing:2px}
  .period{text-align:center;font-size:14px;color:#555;margin-bottom:16px}
  .info-box{display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px}
  .info-box .col{width:48%}
  .info-box .col td{padding:2px 6px}
  .info-box .col td:first-child{font-weight:700;color:#555;white-space:nowrap}
  table.settle{width:100%;border-collapse:collapse;margin-bottom:20px}
  table.settle th,table.settle td{border:1px solid #999;padding:5px 8px;font-size:12px}
  table.settle th{background:#f0f0f0;font-weight:700;text-align:center}
  table.settle tfoot td{background:#fafafa;font-weight:700}
  .section-title{font-size:15px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #333}
  .grand-total{text-align:center;margin:24px 0;padding:14px;background:#f7f7ff;border:2px solid #7048e8;border-radius:8px;font-size:16px}
  .grand-total strong{color:#7048e8;font-size:20px}
  .sign-area{display:flex;justify-content:space-between;margin-top:40px}
  .sign-box{width:45%;text-align:center}
  .sign-box .line{border-top:1px solid #333;margin-top:40px;padding-top:4px;font-size:12px}
  .no-print{margin-bottom:16px;text-align:center}
  @media print{.no-print{display:none} @page{size:A4 portrait;margin:12mm}}
</style></head><body>
  <div class="no-print"><button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;border:1px solid #7048e8;background:#7048e8;color:#fff;border-radius:6px">🖨️ 인쇄</button></div>
  <h1>외주업체 정산서</h1>
  <div class="period">${year}년 ${month}월</div>
  <div class="info-box">
    <table class="col"><tbody>
      <tr><td>제출처</td><td>${esc(agName)}</td></tr>
    </tbody></table>
    <table class="col"><tbody>
      <tr><td>제출자</td><td>${esc(myBizName)}${myCeo?' / '+esc(myCeo):''}</td></tr>
      ${myBizNo?`<tr><td>사업자번호</td><td>${esc(myBizNo)}</td></tr>`:''}
      <tr><td>작성일</td><td>${new Date().toISOString().slice(0,10)}</td></tr>
    </tbody></table>
  </div>

  ${agencyRows?`
  <div class="section-title">1. 대행 수금 정산 (카드/세금계산서)</div>
  <table class="settle">
    <thead><tr><th>No</th><th>완료일</th><th>건명</th><th>결제수단</th><th>결제금액</th><th>수수료</th><th>지급요청액</th></tr></thead>
    <tbody>${agencyRows}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:center">합 계</td>
      <td style="text-align:right">${won(agencyTotalRev)}</td>
      <td style="text-align:right;color:#c00">${won(agencyTotalFee)}</td>
      <td style="text-align:right">${won(agencyTotalPay)}</td>
    </tr></tfoot>
  </table>`:`
  <div class="section-title">1. 대행 수금 정산</div>
  <p style="color:#999;text-align:center;padding:12px">해당 월 대행 수금 건이 없습니다.</p>`}

  ${vatRows?`
  <div class="section-title">2. 매입부가세 환급</div>
  <table class="settle">
    <thead><tr><th>No</th><th>매입확정일</th><th>건명</th><th>견적합계</th><th>매입가</th><th>환급금</th></tr></thead>
    <tbody>${vatRows}</tbody>
    <tfoot><tr>
      <td colspan="5" style="text-align:center">환급 합계</td>
      <td style="text-align:right;color:#0ca678">${won(vatTotal)}</td>
    </tr></tfoot>
  </table>`:`
  <div class="section-title">2. 매입부가세 환급</div>
  <p style="color:#999;text-align:center;padding:12px">해당 월 매입부가세 환급 건이 없습니다.</p>`}

  <div class="grand-total">
    총 지급 요청액: <strong>${won(grandTotal)}</strong>
    <div style="font-size:12px;color:#666;margin-top:4px">
      (대행잔액 ${won(agencyTotalPay)} + 매입VAT환급 ${won(vatTotal)})
    </div>
  </div>

  <div class="sign-area">
    <div class="sign-box">
      <div class="line">제출자: ${esc(myBizName)} (인)</div>
    </div>
    <div class="sign-box">
      <div class="line">확인자: ${esc(agName)} (인)</div>
    </div>
  </div>
</body></html>`;

  const overlay=document.createElement('div');
  overlay.id='agency-settle-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:#fff;overflow:auto;';
  overlay.innerHTML=`<div style="position:sticky;top:0;z-index:1;background:#fff;padding:8px 16px;border-bottom:1px solid #ddd;display:flex;gap:8px;align-items:center">
    <button onclick="window.print()" style="padding:6px 20px;font-size:14px;cursor:pointer;border:1px solid #7048e8;background:#7048e8;color:#fff;border-radius:6px">🖨️ 인쇄</button>
    <button onclick="document.getElementById('agency-settle-overlay').remove()" style="padding:6px 20px;font-size:14px;cursor:pointer;border:1px solid #e03131;background:#e03131;color:#fff;border-radius:6px">✕ 닫기</button>
  </div>
  <div style="font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222;padding:20px;max-width:820px;margin:auto;font-size:13px">
  <h1 style="font-size:20px;text-align:center;margin:0 0 4px;letter-spacing:2px">외주업체 정산서</h1>
  <div style="text-align:center;font-size:14px;color:#555;margin-bottom:16px">${year}년 ${month}월</div>
  <div style="display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px">
    <table style="width:48%"><tbody>
      <tr><td style="font-weight:700;color:#555;padding:2px 6px;white-space:nowrap">제출처</td><td style="padding:2px 6px">${esc(agName)}</td></tr>
    </tbody></table>
    <table style="width:48%"><tbody>
      <tr><td style="font-weight:700;color:#555;padding:2px 6px;white-space:nowrap">제출자</td><td style="padding:2px 6px">${esc(myBizName)}${myCeo?' / '+esc(myCeo):''}</td></tr>
      ${myBizNo?`<tr><td style="font-weight:700;color:#555;padding:2px 6px;white-space:nowrap">사업자번호</td><td style="padding:2px 6px">${esc(myBizNo)}</td></tr>`:''}
      <tr><td style="font-weight:700;color:#555;padding:2px 6px;white-space:nowrap">작성일</td><td style="padding:2px 6px">${new Date().toISOString().slice(0,10)}</td></tr>
    </tbody></table>
  </div>
  ${agencyRows?`
  <div style="font-size:15px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #333">1. 대행 수금 정산 (카드/세금계산서)</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead><tr>${['No','완료일','건명','결제수단','결제금액','수수료','지급요청액'].map(h=>'<th style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#f0f0f0;font-weight:700;text-align:center">'+h+'</th>').join('')}</tr></thead>
    <tbody>${agencyRows}</tbody>
    <tfoot><tr>
      <td colspan="4" style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#fafafa;font-weight:700;text-align:center">합 계</td>
      <td style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#fafafa;font-weight:700;text-align:right">${won(agencyTotalRev)}</td>
      <td style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#fafafa;font-weight:700;text-align:right;color:#c00">${won(agencyTotalFee)}</td>
      <td style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#fafafa;font-weight:700;text-align:right">${won(agencyTotalPay)}</td>
    </tr></tfoot>
  </table>`:`
  <div style="font-size:15px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #333">1. 대행 수금 정산</div>
  <p style="color:#999;text-align:center;padding:12px">해당 월 대행 수금 건이 없습니다.</p>`}
  ${vatRows?`
  <div style="font-size:15px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #333">2. 매입부가세 환급</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead><tr>${['No','매입확정일','건명','견적합계','매입가','환급금'].map(h=>'<th style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#f0f0f0;font-weight:700;text-align:center">'+h+'</th>').join('')}</tr></thead>
    <tbody>${vatRows}</tbody>
    <tfoot><tr>
      <td colspan="5" style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#fafafa;font-weight:700;text-align:center">환급 합계</td>
      <td style="border:1px solid #999;padding:5px 8px;font-size:12px;background:#fafafa;font-weight:700;text-align:right;color:#0ca678">${won(vatTotal)}</td>
    </tr></tfoot>
  </table>`:`
  <div style="font-size:15px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #333">2. 매입부가세 환급</div>
  <p style="color:#999;text-align:center;padding:12px">해당 월 매입부가세 환급 건이 없습니다.</p>`}
  <div style="text-align:center;margin:24px 0;padding:14px;background:#f7f7ff;border:2px solid #7048e8;border-radius:8px;font-size:16px">
    총 지급 요청액: <strong style="color:#7048e8;font-size:20px">${won(grandTotal)}</strong>
    <div style="font-size:12px;color:#666;margin-top:4px">(대행잔액 ${won(agencyTotalPay)} + 매입VAT환급 ${won(vatTotal)})</div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:40px">
    <div style="width:45%;text-align:center"><div style="border-top:1px solid #333;margin-top:40px;padding-top:4px;font-size:12px">제출자: ${esc(myBizName)} (인)</div></div>
    <div style="width:45%;text-align:center"><div style="border-top:1px solid #333;margin-top:40px;padding-top:4px;font-size:12px">확인자: ${esc(agName)} (인)</div></div>
  </div>
  </div>`;
  document.body.appendChild(overlay);
}

function renderPayments(){
  const now=new Date();
  if(settleState.y==null){ settleState.y=now.getFullYear(); settleState.m=now.getMonth(); }
  const y=settleState.y, m=settleState.m;
  const inMonth=r=>{ const d=recDate(r.completed_at); return d && d.getFullYear()===y && d.getMonth()===m; };
  const done=(state.receptions||[]).filter(r=>r.status==='completed' && recRevenue(r)>0);
  const md=done.filter(inMonth);
  // 판매(매장판매 포함) 이달 합산 — 카드/계산서는 대행 경유(수수료 차감), 현금/이체는 전액
  const AG=agencyOn();
  const monthTag=`${y}-${String(m+1).padStart(2,'0')}`;
  const salesMonth=(state.sales||[]).filter(s=>(s.sale_date||'').slice(0,7)===monthTag);
  const saleWoori=s=>Math.round((Number(s.total_price)||0)*feeRateRec(s));
  const saleMine=s=>(Number(s.total_price)||0)-saleWoori(s);
  const salesSettled=salesMonth.filter(s=>feeRateRec(s)<=0||s.woori_settled);   // 대행 경유 매장판매도 정산받은 것만
  const salesRev=salesSettled.reduce((t,s)=>t+(Number(s.total_price)||0),0);
  const salesWoori=salesSettled.reduce((t,s)=>t+saleWoori(s),0);
  const salesMine=salesRev-salesWoori;
  const salesWpend=AG?(state.sales||[]).filter(s=>feeRateRec(s)>0&&!s.woori_settled):[];
  const salesWpendAmt=salesWpend.reduce((t,s)=>t+saleMine(s),0);
  const mdSettled=md.filter(r=>!isWoori(r)||r.woori_settled);   // 대행 경유는 정산받은 것만 매출 집계
  const rev=mdSettled.reduce((s,r)=>s+recRevenue(r),0);
  const myTotal=mdSettled.reduce((s,r)=>s+mySettle(r),0);
  const wooriMonth=mdSettled.reduce((s,r)=>s+wooriCut(r),0);
  const wooriPending=done.filter(r=>isWoori(r) && !r.woori_settled);
  const wooriPendingAmt=wooriPending.reduce((s,r)=>s+mySettle(r),0);
  const unpaid=done.filter(r=>r.payment_method==='unpaid');
  const unpaidAmt=unpaid.reduce((s,r)=>s+recRevenue(r),0);
  const byPM={cash:0,transfer:0,cashreceipt:0,card:0,tax:0,unpaid:0}; mdSettled.forEach(r=>{ if(byPM[r.payment_method]!==undefined) byPM[r.payment_method]+=recRevenue(r); });
  salesSettled.forEach(s=>{ if(byPM[s.payment_method]!==undefined) byPM[s.payment_method]+=Number(s.total_price)||0; });
  const vatRefundMonth=mdSettled.reduce((s,r)=>s+recVatRefund(r),0);
  const byCust={}; mdSettled.forEach(r=>{ const k=r.customer_id; const o=(byCust[k]=byCust[k]||{labor:0,parts:0,rev:0,woori:0,mine:0,refund:0}); o.labor+=Number(r.labor_fee)||0; o.parts+=Number(r.parts_fee)||0; o.rev+=recRevenue(r); o.woori+=wooriCut(r); o.mine+=mySettle(r); o.refund+=recVatRefund(r); });
  const custRows=Object.entries(byCust).sort((a,b)=>b[1].rev-a[1].rev);
  return `
  <div class="page-header"><h2>💳 결산${brandName()?` <span style="font-size:13px;color:var(--gray-500)">— ${esc(brandName())}</span>`:''}</h2>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-sm btn-secondary" onclick="settleMove(-1)">◀</button>
      <strong>${y}년 ${m+1}월</strong>
      <button class="btn btn-sm btn-secondary" onclick="settleMove(1)">▶</button>
      <button class="btn btn-sm" style="background:#7048e8;margin-left:8px" onclick="printAgencySettlement(${y},${m+1})">📄 외주업체 정산서</button>
    </div>
  </div>
  <div class="stat-grid">
    ${statCard('이달 매출', won(rev+salesRev), '', 20)}
    ${statCard('이달 정산액', won(myTotal+salesMine), 'var(--success)', 20)}
    ${statCard('이달 매장판매', won(salesRev), salesRev>0?'var(--primary)':'', 18)}
    ${AG?statCard(`${agencyName()} 받을 정산액`, won(wooriPendingAmt+salesWpendAmt), (wooriPendingAmt+salesWpendAmt)>0?'var(--warning)':'', 18):''}
    ${vatRefundMonth>0?statCard('매입부가세 환급', '+'+won(vatRefundMonth), '#0ca678', 18):''}
    ${statCard('고객 미수금', won(unpaidAmt), unpaidAmt>0?'var(--danger)':'', 18)}
  </div>
  <div class="split" style="grid-template-columns:${AG?'1fr 1fr':'1fr'};margin-bottom:16px">
    <div class="detail-panel" style="position:static">
      <h3>이달 결제수단별</h3>
      ${['cash','transfer','cashreceipt','card','tax','unpaid'].map(k=>`<div class="detail-row"><span class="detail-value">${PM_LABEL[k]}</span><span class="detail-value" style="text-align:right"><strong>${won(byPM[k])}</strong></span></div>`).join('')}
      ${AG?`<div class="detail-row" style="border:none;margin-top:6px"><span class="detail-value" style="color:var(--warning)">${esc(agencyName())} 대행수수료(이달, 판매 포함)</span><span class="detail-value" style="text-align:right;color:var(--warning)"><strong>${won(wooriMonth+salesWoori)}</strong></span></div>`:''}
      ${vatRefundMonth>0?`<div class="detail-row" style="border:none"><span class="detail-value" style="color:#0ca678">매입부가세 환급(이달)</span><span class="detail-value" style="text-align:right;color:#0ca678"><strong>+${won(vatRefundMonth)}</strong></span></div>`:''}
    </div>
    ${AG?`<div class="detail-panel" style="position:static">
      <h3>${esc(agencyName())} 받을 정산액 (미정산 ${wooriPending.length+salesWpend.length}건)</h3>
      ${wooriPending.slice(0,8).map(r=>`<div class="detail-row"><span class="detail-value">${esc(custName(r.customer_id))} · ${PM_LABEL[r.payment_method]||''}${r.tax_invoice?'/계산서':''}${recVatRefund(r)?` <span style="color:#0ca678;font-size:11px">환급+${won(recVatRefund(r))}</span>`:''}</span><span style="display:flex;gap:6px;align-items:center"><strong>${won(mySettle(r))}</strong><button class="btn btn-sm btn-success" onclick="doWooriSettle(${r.id})">정산받음</button></span></div>`).join('')}
      ${salesWpend.slice(0,8).map(s=>`<div class="detail-row"><span class="detail-value">🛒 ${esc(s.item_name)} · ${PM_LABEL[s.payment_method]||''}${s.tax_invoice?'/계산서':''}</span><span style="display:flex;gap:6px;align-items:center"><strong>${won(saleMine(s))}</strong><button class="btn btn-sm btn-success" onclick="doWooriSettleSale(${s.id})">정산받음</button></span></div>`).join('')}
      ${(wooriPending.length+salesWpend.length)===0?'<div class="empty-state">받을 정산액 없음</div>':''}
    </div>`:''}
  </div>
  <div class="table-container"><table class="table">
    <thead><tr><th>거래처</th><th style="text-align:right">공임</th><th style="text-align:right">부품</th><th style="text-align:right">매출</th>${AG?`<th style="text-align:right">${esc(agencyName())} 수수료</th>`:''}<th style="text-align:right;color:#0ca678">환급</th><th style="text-align:right">정산액</th></tr></thead>
    <tbody>${custRows.length? custRows.map(([cid,o])=>`<tr>
      <td><strong>${esc(custName(cid))}</strong></td>
      <td style="text-align:right">${won(o.labor)}</td>
      <td style="text-align:right">${won(o.parts)}</td>
      <td style="text-align:right"><strong>${won(o.rev)}</strong></td>
      ${AG?`<td style="text-align:right;color:var(--warning)">${o.woori?won(o.woori):'-'}</td>`:''}
      <td style="text-align:right;color:#0ca678">${o.refund?'+'+won(o.refund):'-'}</td>
      <td style="text-align:right;color:var(--success)"><strong>${won(o.mine)}</strong></td></tr>`).join('') : `<tr><td colspan="${AG?7:6}" class="empty-state">이달 완료·결제 내역이 없습니다</td></tr>`}
    </tbody></table></div>
  <div style="font-weight:700;margin:18px 2px 8px">🔧 이달 완료 작업·납품 내역 — ${md.length}건 · 매출 ${won(rev)}</div>
  <div class="table-container"><table class="table">
    <thead><tr><th>일자</th><th>거래처</th><th>내용</th><th>담당</th><th>결제수단</th><th style="text-align:right">매출</th>${AG?`<th style="text-align:right">${esc(agencyName())} 수수료</th><th style="text-align:right;color:#0ca678">환급</th><th style="text-align:right">정산액</th>`:''}</tr></thead>
    <tbody>${md.length? [...md].sort((a,b)=>(b.completed_at||'').localeCompare(a.completed_at||'')||b.id-a.id).map(r=>`<tr>
      <td style="font-size:12px">${(r.completed_at||'').slice(0,10)}</td>
      <td><strong>${esc(custName(r.customer_id))}</strong></td>
      <td style="font-size:12px">${esc(r.symptom)||'-'}${(Number(r.labor_fee)||0)&&(Number(r.parts_fee)||0)?` <span style="color:var(--gray-400)">(공임 ${won(r.labor_fee)}·부품 ${won(r.parts_fee)})</span>`:''}${(Number(r.estimate_amount)||0)>recRevenue(r)?` <span style="color:#e8590c;font-weight:700">· 현장할인 ${won((Number(r.estimate_amount)||0)-recRevenue(r))}</span>`:''}</td>
      <td>${r.assigned_engineer_id?engBadge(r.assigned_engineer_id):'-'}</td>
      <td><span class="chip">${PM_LABEL[r.payment_method]||payMethodLabel(r.payment_method)}${r.tax_invoice?' /계산서':''}</span></td>
      <td style="text-align:right"><strong>${won(recRevenue(r))}</strong></td>
      ${AG?`<td style="text-align:right;color:var(--warning)">${wooriCut(r)?won(wooriCut(r)):'-'}</td><td style="text-align:right;color:#0ca678">${recVatRefund(r)?'+'+won(recVatRefund(r)):'-'}</td><td style="text-align:right;color:var(--success)"><strong>${won(mySettle(r))}</strong></td>`:''}</tr>`).join('') : `<tr><td colspan="${AG?9:6}" class="empty-state">이달 완료 작업이 없습니다</td></tr>`}
    </tbody></table></div>
  <div style="font-weight:700;margin:18px 2px 8px">🛒 이달 판매 내역 (매장 등) — ${salesMonth.length}건 · 매출 ${won(salesRev)}${AG?` · 정산 ${won(salesMine)}`:''}</div>
  <div class="table-container"><table class="table">
    <thead><tr><th>일자</th><th>제품명</th><th style="text-align:right">수량</th><th style="text-align:right">금액</th><th>결제수단</th>${AG?`<th style="text-align:right">${esc(agencyName())} 수수료</th><th style="text-align:right">정산액</th>`:''}</tr></thead>
    <tbody>${salesMonth.length? [...salesMonth].sort((a,b)=>(b.sale_date||'').localeCompare(a.sale_date||'')||b.id-a.id).map(s=>`<tr>
      <td style="font-size:12px">${(s.sale_date||'').slice(0,10)}</td>
      <td><strong>${esc(s.item_name)}</strong>${s.customer_id?` <span style="font-size:11px;color:var(--gray-400)">(${esc(custName(s.customer_id))})</span>`:''}</td>
      <td style="text-align:right">${s.quantity||1}</td>
      <td style="text-align:right"><strong>${won(s.total_price)}</strong></td>
      <td><span class="chip">${PM_LABEL[s.payment_method]||payMethodLabel(s.payment_method)}${s.tax_invoice?' /계산서':''}</span></td>
      ${AG?`<td style="text-align:right;color:var(--warning)">${saleWoori(s)?won(saleWoori(s)):'-'}</td>
      <td style="text-align:right;color:var(--success)"><strong>${won(saleMine(s))}</strong></td>`:''}</tr>`).join('') : `<tr><td colspan="${AG?7:5}" class="empty-state">이달 판매 내역이 없습니다</td></tr>`}
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
    ${s.total_vat_refund>0?statCard('매입부가세 환급(누적)', '+'+won(s.total_vat_refund), '#0ca678', 18):''}
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
function renderInto(){ if(!document.querySelector('.modal-overlay') && state.page!=='estimates') render(); }
