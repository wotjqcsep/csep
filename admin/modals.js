// ============================================================
//  CSEP 관리자 — 모달 / 폼 / 검색선택 / SSE / 초기화
// ============================================================

function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }
function modal(title, bodyHtml, wide){
  document.getElementById('modalRoot').innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal ${wide?'wide':''}">
      <div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  </div>`;
}
function field(id,label,val,type){ return `<div class="form-group"><label>${label}</label><input id="${id}" type="${type||'text'}" value="${esc(val)||''}"></div>`; }
function area(id,label,val){ return `<div class="form-group"><label>${label}</label><textarea id="${id}">${esc(val)||''}</textarea></div>`; }
const v = id => { const e=document.getElementById(id); return e?e.value:''; };

// ── 고객 추가/수정 ──
function openCustomerModal(id, prefill){
  const c = id? state.customers.find(x=>x.id==id) : (prefill||{});
  const isEdit = !!id;
  const body = `
    <div class="form-group"><label>고객 구분 *</label><select id="c_type" onchange="toggleBiz()">
      <option value="personal" ${c.customer_type!=='business'?'selected':''}>개인</option>
      <option value="business" ${c.customer_type==='business'?'selected':''}>기업</option></select></div>
    <div id="bizFields" style="display:${c.customer_type==='business'?'block':'none'}">
      <div class="form-row">${field('c_company','회사명',c.company_name)}${field('c_contact','담당자',c.contact_person)}</div>
    </div>
    <div class="form-row">${field('c_name','고객명/식별명 (선택)',c.name)}${field('c_phone','전화번호 *',c.phone)}</div>
    <div class="form-row">${field('c_phone2','보조전화',c.phone2)}${field('c_email','이메일',c.email)}</div>
    ${field('c_address','주소',c.address)}
    ${field('c_addr2','상세주소',c.address_detail)}
    ${area('c_memo','메모',c.memo)}
    ${isEdit?field('c_outstanding','미수금',c.outstanding_amount,'number'):''}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveCustomer(${id||'null'})">저장</button></div>`;
  modal(isEdit?'고객 수정':'고객 추가', body);
}
function toggleBiz(){ document.getElementById('bizFields').style.display = v('c_type')==='business'?'block':'none'; }
async function saveCustomer(id){
  const data = { name:v('c_name'), phone:v('c_phone'), customer_type:v('c_type'), company_name:v('c_company'), contact_person:v('c_contact'), phone2:v('c_phone2'), email:v('c_email'), address:v('c_address'), address_detail:v('c_addr2'), memo:v('c_memo') };
  if(!data.phone){ alert('전화번호는 필수입니다'); return; }
  if(id){ data.outstanding_amount = Number(v('c_outstanding'))||0; await api('PUT','/customers/'+id, data); }
  else await api('POST','/customers', data);
  closeModal(); await loadAll();
}

// ── 장비 추가/수정 ──
function openComputerModal(id, customerId){
  const c = id? state.computers.find(x=>x.id==id) : { customer_id:customerId, device_type:'desktop' };
  const isEdit = !!id;
  const custOptions = state.customers.map(x=>`<option value="${x.id}" ${c.customer_id==x.id?'selected':''}>${esc(x.name)||esc(x.phone)||('고객'+x.id)}</option>`).join('');
  const body = `
    <div class="form-row">
      <div class="form-group"><label>고객 *</label><select id="p_cust">${custOptions}</select></div>
      <div class="form-group"><label>장비 종류 *</label><select id="p_type">
        ${Object.entries(DEVICE_TYPES).map(([k,l])=>`<option value="${k}" ${c.device_type===k?'selected':''}>${l}</option>`).join('')}
      </select></div>
    </div>
    <div class="form-row">${field('p_name','장비명 *',c.name)}${field('p_serial','시리얼번호',c.serial_number)}</div>
    <div class="form-section">하드웨어</div>
    <div class="form-row">${field('p_cpu','CPU',c.cpu)}${field('p_ram','RAM',c.ram)}</div>
    <div class="form-row">${field('p_ssd','SSD',c.ssd)}${field('p_hdd','HDD',c.hdd)}</div>
    <div class="form-row">${field('p_mb','메인보드',c.motherboard)}${field('p_gpu','GPU',c.gpu)}</div>
    <div class="form-row">${field('p_power','파워',c.power)}${field('p_monitor','모니터',c.monitor)}</div>
    <div class="form-section">소프트웨어</div>
    <div class="form-row">${field('p_os','OS',c.os)}${field('p_office','Office',c.office_version)}</div>
    <div class="form-row">${field('p_av','백신',c.antivirus)}${field('p_printer','프린터',c.printer)}</div>
    <div class="form-section">네트워크</div>
    <div class="form-row">${field('p_ip','IP주소',c.ip_address)}${field('p_mac','MAC주소',c.mac_address)}</div>
    <div class="form-row">${field('p_pdate','구입일',c.purchase_date,'date')}${field('p_warr','보증만료',c.warranty_expiry,'date')}</div>
    <div class="form-section">NAS (없으면 빈칸)</div>
    <div class="form-row">${field('p_nasname','NAS 이름',c.nas_name)}${field('p_nasmodel','모델',c.nas_model)}</div>
    <div class="form-row">${field('p_nasip','NAS IP',c.nas_ip)}${field('p_nascap','총 용량',c.nas_total_capacity)}</div>
    <div class="form-row">${field('p_nasid','관리자 ID',c.nas_admin_id)}${field('p_naspw','관리자 PW',c.nas_admin_password)}</div>
    <div class="form-section">공유기 (없으면 빈칸)</div>
    <div class="form-row">${field('p_rtname','공유기 이름',c.router_name)}${field('p_rtmodel','모델',c.router_model)}</div>
    <div class="form-row">${field('p_rtip','공유기 IP',c.router_ip)}${field('p_rtid','관리자 ID',c.router_admin_id)}</div>
    ${field('p_rtpw','공유기 관리자 PW',c.router_admin_password)}
    ${area('p_notes','메모',c.notes)}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveComputer(${id||'null'})">저장</button></div>`;
  modal(isEdit?'장비 수정':'장비 추가', body, true);
}
async function saveComputer(id){
  const data = {
    customer_id:Number(v('p_cust')), name:v('p_name'), device_type:v('p_type'), serial_number:v('p_serial'),
    cpu:v('p_cpu'), ram:v('p_ram'), ssd:v('p_ssd'), hdd:v('p_hdd'), motherboard:v('p_mb'), gpu:v('p_gpu'),
    power:v('p_power'), monitor:v('p_monitor'), os:v('p_os'), office_version:v('p_office'), antivirus:v('p_av'), printer:v('p_printer'),
    ip_address:v('p_ip'), mac_address:v('p_mac'), purchase_date:v('p_pdate'), warranty_expiry:v('p_warr'),
    nas_name:v('p_nasname'), nas_model:v('p_nasmodel'), nas_ip:v('p_nasip'), nas_total_capacity:v('p_nascap'), nas_admin_id:v('p_nasid'), nas_admin_password:v('p_naspw'),
    router_name:v('p_rtname'), router_model:v('p_rtmodel'), router_ip:v('p_rtip'), router_admin_id:v('p_rtid'), router_admin_password:v('p_rtpw'),
    notes:v('p_notes'),
  };
  if(!data.customer_id){ alert('고객을 선택하세요'); return; }
  if(!data.name){ alert('장비명을 입력하세요'); return; }
  if(id) await api('PUT','/computers/'+id, data); else await api('POST','/computers', data);
  closeModal(); await loadAll();
}
async function deleteComputer(id){ if(!confirm('이 장비를 삭제하시겠습니까?'))return; await api('DELETE','/computers/'+id); custState.selComp=null; await loadAll(); }

// ── 접수 등록 (검색 가능한 고객 선택) ──
let recPick = { customerId:'', search:'', open:false };
function openReceptionModal(){
  recPick = { customerId:'', search:'', open:false };
  const body = `
    <div class="form-row">
      <div class="form-group"><label>고객 *</label><div id="custSelect"></div></div>
      <div class="form-group"><label>접수 채널 *</label><select id="r_channel">
        <option value="phone">전화</option><option value="sms">SMS</option><option value="kakao">카카오톡</option><option value="direct">직접등록</option></select></div>
    </div>
    ${field('r_phone','전화번호','')}
    ${area('r_symptom','증상 *','')}
    ${area('r_memo','초기 메모','')}
    <div class="form-group"><label>담당 기사 (선택 시 바로 배정)</label><select id="r_eng">
      <option value="">미배정 (나중에 배정)</option>
      ${state.engineers.map(e=>`<option value="${e.id}">${esc(e.name)}${e.is_admin?' (대표)':''} · ${statusLabel(e.status)}</option>`).join('')}
    </select></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveReception()">접수 등록</button></div>`;
  modal('접수 등록 · 작업지시', body);
  renderCustSelect();
}
function renderCustSelect(){
  const el = document.getElementById('custSelect'); if(!el) return;
  const sel = state.customers.find(c=>c.id==recPick.customerId);
  const q = recPick.search.toLowerCase();
  const filtered = state.customers.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.company_name||'').toLowerCase().includes(q));
  el.innerHTML = `<div class="cs-wrap">
    <div class="cs-box" onclick="recPick.open=true;renderCustSelect();setTimeout(()=>{var i=document.getElementById('csInput');if(i)i.focus()},0)">
      ${!recPick.open && sel ? `<span style="flex:1">${esc(sel.name)||esc(sel.phone)} ${sel.name?`<span style="color:var(--gray-400);font-size:12px">(${esc(sel.phone)})</span>`:''}</span><button onclick="event.stopPropagation();recPick.customerId='';recPick.search='';renderCustSelect()" style="border:none;background:none;cursor:pointer;color:var(--gray-400);font-size:16px">×</button>`
        : `<input id="csInput" placeholder="${sel?(esc(sel.name)||esc(sel.phone)):'이름, 전화번호 검색...'}" value="${esc(recPick.search)}" oninput="recPick.search=this.value;recPick.open=true;renderCustSelect();document.getElementById('csInput').focus()">`}
    </div>
    ${recPick.open? `<div class="cs-list">${filtered.length? filtered.map(c=>`<div class="cs-item" onmousedown="pickCust(${c.id})"><strong>${esc(c.name)||esc(c.phone)}</strong> ${c.name?`<span style="color:var(--gray-400);font-size:12px">${esc(c.phone)}</span>`:''}${c.company_name?` · ${esc(c.company_name)}`:''}</div>`).join('') : '<div class="cs-item" style="color:var(--gray-400)">검색 결과 없음</div>'}</div>`:''}
  </div>`;
}
function pickCust(id){ recPick.customerId=id; recPick.open=false; recPick.search=''; renderCustSelect(); }
async function saveReception(){
  if(!recPick.customerId){ alert('고객을 선택하세요'); return; }
  const symptom = v('r_symptom'); if(!symptom){ alert('증상을 입력하세요'); return; }
  const rec = await api('POST','/receptions', { customer_id:Number(recPick.customerId), reception_channel:v('r_channel'), reception_phone:v('r_phone'), symptom, initial_memo:v('r_memo') });
  const eng = v('r_eng');
  if(eng) await api('PUT',`/receptions/${rec.id}/assign?engineer_id=${eng}`);   // 작업지시: 바로 배정
  closeModal(); await loadAll();
}

// ── 기사 배정 ──
function openAssignModal(recId){
  const r = state.receptions.find(x=>x.id==recId);
  const body = `
    <div style="margin-bottom:14px;padding:12px;background:var(--gray-50);border-radius:8px;font-size:13px"><strong>증상:</strong> ${esc(r.symptom)||'-'}</div>
    <div class="form-group"><label>배정할 기사</label><select id="a_eng">
      <option value="">선택하세요</option>
      ${state.engineers.map(e=>`<option value="${e.id}">${esc(e.name)} (${statusLabel(e.status)})</option>`).join('')}
    </select></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="doAssign(${recId})">배정</button></div>`;
  modal(`기사 배정 - ${esc(custName(r.customer_id))}`, body);
}
async function doAssign(recId){
  const eng = v('a_eng'); if(!eng){ alert('기사를 선택하세요'); return; }
  await api('PUT',`/receptions/${recId}/assign?engineer_id=${eng}`);
  closeModal(); await loadAll();
}

// ── 기사 추가 ──
function openEngineerModal(){
  const body = `
    <div class="form-row">${field('e_name','이름 *','')}${field('e_phone','전화번호','')}</div>
    <div class="form-group"><label><input type="checkbox" id="e_admin" onchange="document.getElementById('e_pwGroup').style.display=this.checked?'block':'none'"> 대표 권한 (기사앱 대표 모드)</label></div>
    <div id="e_pwGroup" style="display:none">${field('e_pw','대표 비밀번호','')}</div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveEngineer()">저장</button></div>`;
  modal('기사 추가', body);
}
async function saveEngineer(){
  const name=v('e_name'); if(!name){ alert('이름을 입력하세요'); return; }
  const is_admin = document.getElementById('e_admin').checked;
  await api('POST','/engineers', { name, phone:v('e_phone'), is_admin, password:is_admin?v('e_pw'):null });
  closeModal(); await loadAll();
}

// ── 판매 등록 ──
function openSaleModal(){
  const custOptions = state.customers.map(x=>`<option value="${x.id}">${esc(x.name)||esc(x.phone)||('고객'+x.id)}</option>`).join('');
  const body = `
    <div class="form-group"><label>고객 *</label><select id="s_cust">${custOptions}</select></div>
    <div class="form-row">${field('s_item','품목명 *','')}<div class="form-group"><label>품목 유형</label><select id="s_type"><option value="part">부품</option><option value="product">완제품</option><option value="service">서비스</option></select></div></div>
    <div class="form-row">${field('s_qty','수량','1','number')}${field('s_price','단가','0','number')}</div>
    <div class="form-row">${field('s_date','판매일',new Date().toISOString().slice(0,10),'date')}<div class="form-group"><label>결제수단</label><select id="s_method"><option value="cash">현금</option><option value="card">카드</option><option value="transfer">계좌이체</option></select></div></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveSale()">저장</button></div>`;
  modal('판매 등록', body);
}
async function saveSale(){
  const qty=Number(v('s_qty'))||1, price=Number(v('s_price'))||0;
  if(!v('s_cust')||!v('s_item')){ alert('고객과 품목을 입력하세요'); return; }
  await api('POST','/sales', { customer_id:Number(v('s_cust')), item_type:v('s_type'), item_name:v('s_item'), quantity:qty, unit_price:price, total_price:qty*price, sale_date:v('s_date'), payment_method:v('s_method') });
  closeModal(); await loadAll();
}

// ── 재고 추가/수정 ──
function openInventoryModal(id){
  const i = id? state.inventory.find(x=>x.id==id) : {};
  const body = `
    <div class="form-row">${field('i_name','부품명 *',i.part_name)}${field('i_code','부품코드',i.part_code)}</div>
    <div class="form-row">${field('i_cat','분류',i.category)}${field('i_loc','위치',i.location)}</div>
    <div class="form-row">${field('i_qty','수량',i.quantity||0,'number')}${field('i_reorder','재주문 기준',i.reorder_level||5,'number')}</div>
    <div class="form-row">${field('i_cost','원가',i.unit_cost,'number')}${field('i_price','판매가',i.unit_price,'number')}</div>
    <div class="form-row">${field('i_sup','공급처',i.supplier)}${field('i_supphone','공급처 전화',i.supplier_phone)}</div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveInventory(${id||'null'})">저장</button></div>`;
  modal(id?'부품 수정':'부품 추가', body);
}
async function saveInventory(id){
  const name=v('i_name'); if(!name){ alert('부품명을 입력하세요'); return; }
  const data = { part_name:name, part_code:v('i_code'), category:v('i_cat'), location:v('i_loc'), quantity:Number(v('i_qty'))||0, reorder_level:Number(v('i_reorder'))||5, unit_cost:Number(v('i_cost'))||0, unit_price:Number(v('i_price'))||0, supplier:v('i_sup'), supplier_phone:v('i_supphone') };
  if(id) await api('PUT','/inventory/'+id, data); else await api('POST','/inventory', data);
  closeModal(); await loadAll();
}

// ── 전화 수신 테스트 ──
async function testCall(){
  const phone = prompt('테스트할 전화번호:', '01012341234');
  if(phone) await api('POST','/incoming-call?phone='+encodeURIComponent(phone));
}

// ============================================================
//  팝업 (전화/SMS 수신)
// ============================================================
let pendingCalls = [], pendingSms = [];
function renderPopups(){
  const el = document.getElementById('popups');
  el.innerHTML = [
    ...pendingCalls.map(c=>popupCard('call', c)),
    ...pendingSms.map(s=>popupCard('sms', s)),
  ].join('');
}
function popupCard(type, item){
  const c = item.customer;
  const title = type==='call'? '📞 전화 수신' : '💬 SMS 수신';
  return `<div class="popup ${type==='sms'?'sms':''}">
    <div class="popup-head"><strong>${title}</strong><button class="modal-close" onclick="dismiss${type==='call'?'Call':'Sms'}(${item.id})">×</button></div>
    <div class="popup-body">
      <div style="font-size:16px;font-weight:700">${esc(item.phone)}</div>
      ${c? `<div style="margin:4px 0"><span class="badge new">${c.customer_type==='business'?'기업':'개인'}</span> <strong>${esc(c.name)}</strong>${c.company_name?` · ${esc(c.company_name)}`:''}</div>${c.address?`<div style="font-size:12px;color:var(--gray-500)">${esc(c.address)}</div>`:''}` : '<div style="color:var(--gray-400);margin:4px 0">미등록 고객</div>'}
      ${type==='sms'?`<div style="margin-top:6px;padding:8px;background:var(--gray-50);border-radius:6px;font-size:13px">${esc(item.message)}</div>`:''}
      ${(item.recent_receptions||[]).length?`<div style="margin-top:6px;font-size:12px;color:var(--gray-500)">최근: ${item.recent_receptions.map(r=>esc(r.symptom||'')).join(', ')}</div>`:''}
      <div style="margin-top:10px;display:flex;gap:6px">
        ${c
          ? `<button class="btn btn-sm" style="flex:1" onclick="quickReception(${c.id},'${type}',${item.id})">접수 등록</button>`
          : `<button class="btn btn-sm" style="flex:1" onclick="registerFromPopup('${esc(item.phone)}','${type}',${item.id})">고객 등록</button>`}
        <button class="btn btn-sm btn-secondary" style="flex:1" onclick="dismiss${type==='call'?'Call':'Sms'}(${item.id})">닫기</button>
      </div>
    </div></div>`;
}
async function dismissCall(id){ await api('DELETE','/incoming-call/'+id); pendingCalls=pendingCalls.filter(c=>c.id!=id); renderPopups(); }
async function dismissSms(id){ await api('DELETE','/incoming-sms/'+id); pendingSms=pendingSms.filter(s=>s.id!=id); renderPopups(); }
function quickReception(custId, type, itemId){
  if(type==='call') dismissCall(itemId); else if(type==='sms') dismissSms(itemId);
  go('receptions'); openReceptionModal(); pickCust(custId);
}
// 미등록 번호 → 전화번호 채운 고객 등록 모달
function registerFromPopup(phone, type, itemId){
  if(type==='call') dismissCall(itemId); else if(type==='sms') dismissSms(itemId);
  openCustomerModal(null, { phone });
}

async function pollPopups(){
  try{
    const [calls, sms] = await Promise.all([api('GET','/incoming-call/pending'), api('GET','/incoming-sms/pending')]);
    if(JSON.stringify(calls)!==JSON.stringify(pendingCalls) || JSON.stringify(sms)!==JSON.stringify(pendingSms)){
      pendingCalls=calls; pendingSms=sms; renderPopups();
    }
  }catch(e){}
}

// ============================================================
//  SSE 실시간
// ============================================================
function connectSSE(){
  try{
    const es = new EventSource(API+'/admin-stream');
    const reloadEvents = ['reception_new','reception_update','job_update','engineer_update'];
    reloadEvents.forEach(ev=>es.addEventListener(ev, ()=>loadAll()));
    es.addEventListener('incoming_call', e=>{ const c=JSON.parse(e.data); pendingCalls.push(c); renderPopups(); });
    es.addEventListener('incoming_sms', e=>{ const s=JSON.parse(e.data); pendingSms.push(s); renderPopups(); });
    es.onerror = ()=>{ es.close(); setTimeout(connectSSE, 5000); };
  }catch(e){}
}

// ============================================================
//  초기화
// ============================================================
renderNav();
loadAll(true);
setInterval(()=>loadAll(false), 30000);
pollPopups();
setInterval(pollPopups, 3000);
connectSSE();
