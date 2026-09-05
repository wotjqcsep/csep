// ============================================================
//  CSEP 관리자 — 모달 / 폼 / 검색선택 / SSE / 초기화
// ============================================================

function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }
function modal(title, bodyHtml, wide){
  document.getElementById('modalRoot').innerHTML = `
  <div class="modal-overlay">
    <div class="modal ${wide?'wide':''}">
      <div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  </div>`;
}
function field(id,label,val,type){ return `<div class="form-group"><label>${label}</label><input id="${id}" type="${type||'text'}" value="${esc(val)||''}"></div>`; }
function area(id,label,val){ return `<div class="form-group"><label>${label}</label><textarea id="${id}">${esc(val)||''}</textarea></div>`; }
const v = id => { const e=document.getElementById(id); return e?e.value:''; };

// ============================================================
//  카카오(다음) 우편번호 서비스 — API 키 불필요
//  정규식 추측이 아니라 실제 존재하는 주소를 고르게 해서
//  네비가 100% 인식하는 도로명주소를 얻는다. 상세주소는 별도 칸으로 유도.
// ============================================================
let _postcodeLoading = null;
function loadPostcodeScript(){
  if(window.daum && window.daum.Postcode) return Promise.resolve();
  if(_postcodeLoading) return _postcodeLoading;
  _postcodeLoading = new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.onload=()=>resolve();
    s.onerror=()=>{ _postcodeLoading=null; reject(new Error('스크립트 로드 실패')); };
    document.head.appendChild(s);
  });
  return _postcodeLoading;
}
// addrId: 주소 입력칸 id, detailId: 상세주소 입력칸 id (선택)
async function openPostcode(addrId, detailId){
  const addrEl=document.getElementById(addrId);
  try{ await loadPostcodeScript(); }
  catch(e){ alert('주소 검색을 열 수 없습니다.\n네트워크를 확인하거나 직접 입력해주세요.'); return; }
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px';
  wrap.onclick=e=>{ if(e.target===wrap) wrap.remove(); };
  const box=document.createElement('div');
  box.style.cssText='background:#fff;border-radius:12px;width:100%;max-width:520px;height:78vh;max-height:620px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.3)';
  const bar=document.createElement('div');
  bar.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:11px 15px;border-bottom:1px solid #e9ecef;font-weight:700;color:#343a40;flex-shrink:0';
  bar.innerHTML='<span>🔍 주소 검색</span>';
  const close=document.createElement('button');
  close.textContent='✕';
  close.style.cssText='border:none;background:none;font-size:20px;cursor:pointer;color:#868e96;line-height:1';
  close.onclick=()=>wrap.remove();
  bar.appendChild(close);
  const host=document.createElement('div');
  host.style.cssText='flex:1;min-height:0';
  box.appendChild(bar); box.appendChild(host); wrap.appendChild(box);
  document.body.appendChild(wrap);
  new daum.Postcode({
    oncomplete: d=>{
      // 도로명 우선. 사용자가 지번을 골랐으면 지번.
      let a = (d.userSelectedType==='J') ? d.jibunAddress : d.roadAddress;
      if(!a) a = d.roadAddress || d.jibunAddress || '';
      if(d.userSelectedType!=='J' && d.buildingName) a += ' (' + d.buildingName + ')';
      if(addrEl){ addrEl.value=a; addrEl.dispatchEvent(new Event('input',{bubbles:true})); }
      wrap.remove();
      const de=detailId && document.getElementById(detailId);
      if(de) de.focus();   // 동/호/층은 여기에 이어서 입력
    },
    width:'100%', height:'100%',
  }).embed(host, { q: (addrEl && addrEl.value.trim()) || '', autoClose:false });
}
// 주소칸 아래에 붙이는 검색 버튼
function postcodeBtn(addrId, detailId){
  return `<div style="margin:-8px 0 12px"><button type="button" class="btn btn-sm btn-secondary" onclick="openPostcode('${addrId}','${detailId||''}')">🔍 주소 검색</button>
    <span style="font-size:11px;color:var(--gray-400);margin-left:6px">검색해서 고르면 네비가 인식하는 주소로 입력됩니다</span></div>`;
}
// 선택(목록) + 직접입력 겸용 필드 (datalist)
function comboField(id,label,val,listId,options){
  return `<div class="form-group"><label>${label}</label>
    <input id="${id}" list="${listId}" value="${esc(val)||''}" placeholder="선택 또는 직접 입력" autocomplete="off">
    <datalist id="${listId}">${options.map(o=>`<option value="${o}"></option>`).join('')}</datalist></div>`;
}
// ── 부품 프리셋 (선택 + 직접입력 겸용) ──
const CPU_DATA = {
  Intel: { label:'세대', info:'내장 그래픽: F·KF 모델만 없음, 그 외 모델은 내장 그래픽 있음(UHD/Iris Xe)', groups:{
    'Core Ultra(2세대)':['Core Ultra 9 285K','Core Ultra 7 265K','Core Ultra 7 265KF','Core Ultra 5 245K','Core Ultra 5 245KF'],
    '14세대':['Core i9-14900KS','Core i9-14900K','Core i9-14900KF','Core i9-14900','Core i7-14700K','Core i7-14700KF','Core i7-14700','Core i5-14600K','Core i5-14600KF','Core i5-14500','Core i5-14400','Core i5-14400F','Core i3-14100','Core i3-14100F'],
    '13세대':['Core i9-13900KS','Core i9-13900K','Core i9-13900KF','Core i9-13900','Core i7-13700K','Core i7-13700KF','Core i7-13700','Core i5-13600K','Core i5-13600KF','Core i5-13500','Core i5-13400','Core i5-13400F','Core i3-13100','Core i3-13100F'],
    '12세대':['Core i9-12900K','Core i9-12900KF','Core i9-12900','Core i7-12700K','Core i7-12700KF','Core i7-12700','Core i5-12600K','Core i5-12600KF','Core i5-12600','Core i5-12500','Core i5-12400','Core i5-12400F','Core i3-12100','Core i3-12100F'],
    '11세대':['Core i9-11900K','Core i9-11900KF','Core i9-11900','Core i7-11700K','Core i7-11700KF','Core i7-11700','Core i5-11600K','Core i5-11600KF','Core i5-11500','Core i5-11400','Core i5-11400F'],
    '10세대':['Core i9-10900K','Core i9-10900KF','Core i9-10900','Core i7-10700K','Core i7-10700KF','Core i7-10700','Core i5-10600K','Core i5-10600KF','Core i5-10500','Core i5-10400','Core i5-10400F','Core i3-10300','Core i3-10100','Core i3-10100F'],
    '9세대':['Core i9-9900KS','Core i9-9900K','Core i9-9900KF','Core i9-9900','Core i7-9700K','Core i7-9700KF','Core i7-9700','Core i5-9600K','Core i5-9600KF','Core i5-9400','Core i5-9400F','Core i3-9350KF','Core i3-9100','Core i3-9100F'],
    '8세대':['Core i7-8700K','Core i7-8700','Core i5-8600K','Core i5-8600','Core i5-8500','Core i5-8400','Core i3-8350K','Core i3-8300','Core i3-8100'],
    '7세대':['Core i7-7700K','Core i7-7700','Core i5-7600K','Core i5-7600','Core i5-7500','Core i5-7400','Core i3-7350K','Core i3-7320','Core i3-7300','Core i3-7100'],
    '6세대':['Core i7-6700K','Core i7-6700','Core i5-6600K','Core i5-6600','Core i5-6500','Core i5-6400','Core i3-6320','Core i3-6300','Core i3-6100'],
    '5세대':['Core i7-5775C','Core i5-5675C'],
    '4세대':['Core i7-4790K','Core i7-4790','Core i7-4770K','Core i7-4770','Core i5-4690K','Core i5-4670K','Core i5-4590','Core i5-4570','Core i5-4460','Core i5-4440','Core i3-4360','Core i3-4340','Core i3-4170','Core i3-4160','Core i3-4150','Core i3-4130'],
    '3세대':['Core i7-3770K','Core i7-3770','Core i5-3570K','Core i5-3550','Core i5-3470','Core i5-3450','Core i5-3330','Core i3-3240','Core i3-3220','Core i3-3210'],
    '2세대':['Core i7-2700K','Core i7-2600K','Core i7-2600','Core i5-2500K','Core i5-2500','Core i5-2400','Core i5-2320','Core i5-2300','Core i3-2130','Core i3-2120','Core i3-2100'],
    '1세대':['Core i7-980X','Core i7-975','Core i7-965','Core i7-960','Core i7-950','Core i7-930','Core i7-920','Core i7-880','Core i7-870','Core i7-860','Core i5-760','Core i5-750','Core i5-680','Core i5-660','Core i5-650','Core i3-560','Core i3-550','Core i3-540','Core i3-530'],
  }},
  AMD: { label:'소켓', info:'BIOS 업데이트 시 상위 CPU 지원(예: B450→라이젠 5000)',
    chipset:{ 'AM5':'A620 / B650 / B650E / X670 / X670E / B840 / X870 / X870E', 'AM4':'A320 / B350 / X370 / B450 / X470 / A520 / B550 / X570', 'AM3':'760G / 970 / 990X / 990FX (AM3+)', 'AM6':'(예정)' },
    igpu:{ 'AM5':'7000번대 이상 기본 내장, 8000G 강력', 'AM4':'G 모델만 내장(예: 5600G)', 'AM3':'없음', 'AM6':'(예정)' },
    groups:{
    'AM5':['Ryzen 9 9950X3D','Ryzen 9 9950X','Ryzen 9 9900X3D','Ryzen 9 9900X','Ryzen 7 9800X3D','Ryzen 7 9700X','Ryzen 5 9600X','Ryzen 9 7950X3D','Ryzen 9 7950X','Ryzen 9 7900X','Ryzen 9 7900','Ryzen 7 7800X3D','Ryzen 7 7700X','Ryzen 7 7700','Ryzen 5 7600X','Ryzen 5 7600','Ryzen 5 7500F','Ryzen 7 8700G','Ryzen 5 8600G','Ryzen 5 8500G'],
    'AM4':['Ryzen 9 5950X','Ryzen 9 5900X','Ryzen 7 5800X3D','Ryzen 7 5800X','Ryzen 7 5700X','Ryzen 7 5700G','Ryzen 5 5600X','Ryzen 5 5600','Ryzen 5 5600G','Ryzen 5 5500','Ryzen 9 3900X','Ryzen 7 3800X','Ryzen 7 3700X','Ryzen 5 3600X','Ryzen 5 3600','Ryzen 5 3400G','Ryzen 3 3200G','Ryzen 5 3100','Ryzen 7 2700X','Ryzen 7 2700','Ryzen 5 2600X','Ryzen 5 2600','Ryzen 5 2400G','Ryzen 3 2200G','Ryzen 7 1800X','Ryzen 7 1700X','Ryzen 7 1700','Ryzen 5 1600','Ryzen 5 1500X','Ryzen 3 1300X','Ryzen 3 1200'],
    'AM3':['Phenom II X6 1100T','Phenom II X6 1090T','Phenom II X4 965','Phenom II X4 955','Phenom II X4 945','Athlon II X4 640','Athlon II X4 630','FX-9590 (AM3+)','FX-8350 (AM3+)','FX-8320 (AM3+)','FX-6350 (AM3+)','FX-6300 (AM3+)','FX-4300 (AM3+)'],
    'AM6':['(미출시 · 예정)'],
  }}
};
const VGA_DATA = {
  'NVIDIA': { groups:{
    'RTX 50':['RTX 5090','RTX 5080','RTX 5070 Ti','RTX 5070','RTX 5060 Ti','RTX 5060'],
    'RTX 40':['RTX 4090','RTX 4080 SUPER','RTX 4070 Ti SUPER','RTX 4070 SUPER','RTX 4070','RTX 4060 Ti','RTX 4060'],
    'RTX 30':['RTX 3090','RTX 3080','RTX 3070','RTX 3060 Ti','RTX 3060','RTX 3050'],
    'RTX 20':['RTX 2080 Ti','RTX 2070','RTX 2060'],
    'GTX 16':['GTX 1660 SUPER','GTX 1650'],
    'GTX 10':['GTX 1080 Ti','GTX 1070','GTX 1060','GTX 1050 Ti'],
  }},
  'AMD': { groups:{
    'RX 9000':['RX 9070 XT','RX 9070'],
    'RX 7000':['RX 7900 XTX','RX 7800 XT','RX 7700 XT','RX 7600'],
    'RX 6000':['RX 6900 XT','RX 6800','RX 6700 XT','RX 6600','RX 6500 XT'],
    'RX 5000':['RX 5700 XT','RX 5600 XT','RX 5500 XT'],
  }},
  'Intel Arc': { groups:{ 'Arc B':['Arc B580','Arc B570'], 'Arc A':['Arc A770','Arc A750','Arc A380'] }},
  '내장 그래픽': { groups:{} },
};
const MB_MAKERS=['ASUS','MSI','GIGABYTE','ASROCK','BIOSTAR','기타'];
const MB_CHIPSET={
  Intel:['H610','B660','B760','H670','H770','Z690','Z790'],
  AMD:['A520','A620','B550','B650','B650E','X570','X670','X670E']
};
function optHtml(list){ return list.map(o=>`<option value="${o}"></option>`).join(''); }
// 수동 추가 부품(part_options) 조회
function partOpts(kind){ return (typeof state!=='undefined' && state.partOptions)? state.partOptions.filter(o=>o.kind===kind) : []; }
// 단순 부품(제조사·OS 등) 사용자 추가값 목록
function customOpts(kind){ return partOpts(kind).map(o=>o.value).filter(Boolean); }
function customGroups(kind, first){ return [...new Set(partOpts(kind).filter(o=>(o.grp||'').split('||')[0]===first).map(o=>(o.grp||'').split('||')[1]).filter(Boolean))]; }
function customVals(kind, first, second){ return partOpts(kind).filter(o=>{ const pp=(o.grp||'').split('||'); return pp[0]===first && (!second || pp[1]===second); }).map(o=>o.value); }
// 저장된 CPU 모델명 → 플랫폼/세대 역추론 (편집 시 드롭다운 프리필용)
function inferCpu(name){
  const n=String(name||'');
  if(!n) return {plat:'',sub:''};
  let plat='';
  if(/Ryzen|라이젠|Athlon|Phenom|\bFX-|AMD/i.test(n)) plat='AMD';
  else if(/Intel|Core|Xeon|Pentium|Celeron/i.test(n)) plat='Intel';
  let sub='';
  if(plat && CPU_DATA[plat]){
    const g=CPU_DATA[plat].groups;
    for(const k in g){ if(g[k].some(m=>m.toLowerCase()===n.trim().toLowerCase())){ sub=k; break; } }
    if(!sub) for(const k in g){ if(g[k].some(m=>n.toLowerCase().includes(m.toLowerCase()))){ sub=k; break; } }
  }
  return {plat,sub};
}
// 저장된 VGA 모델명 → 제조사/시리즈 역추론
function inferVga(name){
  const n=String(name||'');
  if(!n) return {maker:'',series:''};
  let maker='';
  if(/내장|UHD|Iris|HD Graphics/i.test(n)) maker='내장 그래픽';
  else if(/GeForce|RTX|GTX|NVIDIA|Quadro/i.test(n)) maker='NVIDIA';
  else if(/Radeon|\bRX\b/i.test(n)) maker='AMD';
  else if(/\bArc\b/i.test(n)) maker='Intel Arc';
  let series='';
  if(maker && VGA_DATA[maker]){
    const g=VGA_DATA[maker].groups;
    for(const k in g){ if(g[k].some(m=>m.toLowerCase()===n.trim().toLowerCase())){ series=k; break; } }
    if(!series) for(const k in g){ if(g[k].some(m=>n.toLowerCase().includes(m.toLowerCase()))){ series=k; break; } }
  }
  return {maker,series};
}
function updateCpuSub(){
  const p=v('p_cpu_plat'); const sel=document.getElementById('p_cpu_sub');
  const preset=(p&&CPU_DATA[p])?Object.keys(CPU_DATA[p].groups):[];
  const groups=[...preset, ...customGroups('cpu',p).filter(g=>!preset.includes(g))];
  if(sel) sel.innerHTML=`<option value="">${p&&CPU_DATA[p]?CPU_DATA[p].label:'세대/소켓'}</option>`+groups.map(g=>`<option>${g}</option>`).join('');
  updateCpuModels();
}
function updateCpuModels(){
  const p=v('p_cpu_plat'), sub=v('p_cpu_sub'); const dl=document.getElementById('cpu_list');
  let list=[];
  if(p&&CPU_DATA[p]){ const g=CPU_DATA[p].groups; list = (sub&&g[sub])? g[sub].slice() : [].concat(...Object.values(g)); }
  list=list.concat(customVals('cpu',p,sub));
  if(dl) dl.innerHTML=optHtml(list);
  const info=document.getElementById('cpu_info');
  if(info){ let t='';
    if(p==='Intel') t='🖥 '+CPU_DATA.Intel.info;
    else if(p==='AMD'){ t='🖥 '+CPU_DATA.AMD.info; if(sub&&CPU_DATA.AMD.chipset[sub]) t=`🖥 지원 칩셋: ${CPU_DATA.AMD.chipset[sub]} · 내장그래픽: ${CPU_DATA.AMD.igpu[sub]}\n   ${CPU_DATA.AMD.info}`; }
    info.textContent=t;
  }
}
function updateVgaSeries(){
  const m=v('p_vga_maker'); const sel=document.getElementById('p_vga_series'); const g=document.getElementById('p_gpu');
  if(m==='내장 그래픽'){ if(g&&!g.value) g.value='내장 그래픽'; if(sel) sel.innerHTML='<option value="">-</option>'; const dl=document.getElementById('vga_list'); if(dl) dl.innerHTML=''; return; }
  const preset=(m&&VGA_DATA[m])?Object.keys(VGA_DATA[m].groups):[];
  const groups=[...preset, ...customGroups('vga',m).filter(g=>!preset.includes(g))];
  if(sel) sel.innerHTML='<option value="">시리즈</option>'+groups.map(s=>`<option>${s}</option>`).join('');
  updateVgaModels();
}
function updateVgaModels(){
  const m=v('p_vga_maker'), s=v('p_vga_series'); const dl=document.getElementById('vga_list');
  let list=[];
  if(m&&VGA_DATA[m]){ const g=VGA_DATA[m].groups; list = (s&&g[s])? g[s].slice() : [].concat(...Object.values(g)); }
  list=list.concat(customVals('vga',m,s));
  if(dl) dl.innerHTML=optHtml(list);
}
function updateMbChipset(){ const p=v('p_mb_plat'); const list=[...(p?(MB_CHIPSET[p]||[]):[].concat(MB_CHIPSET.Intel,MB_CHIPSET.AMD)),...customOpts('mbchipset')]; const dl=document.getElementById('mb_chipset_list'); if(dl) dl.innerHTML=optHtml(list); }
function mbParse(raw){ if(!raw) return {}; try{ const o=JSON.parse(raw); if(o&&typeof o==='object'&&!Array.isArray(o)) return o; }catch(e){} return {model:String(raw)}; }
function collectMb(){ const o={plat:v('p_mb_plat'),maker:v('p_mb_maker'),chipset:v('p_mb_chipset'),model:v('p_mb_model')}; return Object.values(o).some(x=>x)? JSON.stringify(o):''; }
function collectMonitor(){ const inch=v('p_mon_inch'), model=v('p_mon_model'); const ports=[...document.querySelectorAll('.mon-port:checked')].map(el=>el.value); return (inch||model||ports.length)? JSON.stringify({inch,model,ports}):''; }
function mbSummary(raw){ const o=mbParse(raw); return [o.plat,o.maker,o.chipset,o.model].filter(Boolean).join(' '); }
// 모니터 파싱: JSON {inch,model,ports[]} 우선, 구버전 문자열도 최대한 분해
function monParse(raw){
  if(!raw) return { inch:'', model:'', ports:[] };
  try{ const o=JSON.parse(raw); if(o&&typeof o==='object'&&!Array.isArray(o)) return { inch:o.inch||'', model:o.model||'', ports:Array.isArray(o.ports)?o.ports:[] }; }catch(e){}
  let s=String(raw); const inch=((s.match(/(\d+(?:\.\d+)?)\s*인치/)||[])[1])||'';
  s=s.replace(/\d+(?:\.\d+)?\s*인치/,''); const ports=[];
  MONITOR_PORTS.slice().sort((a,b)=>b.length-a.length).forEach(p=>{ if(s.includes(p)){ ports.push(p); s=s.split(p).join(' '); } });
  return { inch, model:s.replace(/[,·]/g,' ').trim(), ports };
}
function monSummary(raw){ const o=monParse(raw); return [o.inch?o.inch+'인치':'', o.model, (o.ports||[]).join('/')].filter(Boolean).join(' · '); }

// 여러 개 입력(RAM/SSD/HDD) — JSON으로 저장. RAM은 합계 자동계산. opts 있으면 선택+직접입력
const MULTI_SPECS = {
  ram: { calc:true, init:2, legacy:'maker', fields:[{k:'size',ph:'용량(GB) 선택/직접',flex:1,opts:['4','8','16','32','64','128'],optKind:'ramsize'},{k:'spec',ph:'규격',flex:1,opts:['DDR3','DDR4','DDR5','DDR6'],optKind:'ramspec'},{k:'maker',ph:'제조사',flex:1,opts:['삼성','SK하이닉스','마이크론','G.SKILL','커세어','팀그룹','기타'],optKind:'ram'}] },
  ssd: { calc:false, legacy:'cap',  fields:[{k:'type',ph:'방식(선택/직접)',flex:1,opts:['2.5인치 SATA','NVMe M.2','M.2 SATA'],optKind:'ssdtype'},{k:'cap',ph:'용량(예:512GB)',flex:1},{k:'maker',ph:'제조사/모델',flex:2,optKind:'ssd'}] },
  hdd: { calc:false, legacy:'cap',  fields:[{k:'cap',ph:'용량(예:2TB)',flex:1},{k:'maker',ph:'제조사',flex:2,opts:['WD','씨게이트','도시바','기타'],optKind:'hdd'}] },
};
function parseSpecList(kind, raw){
  if(!raw) return [];
  try{ const a=JSON.parse(raw); if(Array.isArray(a)) return a; }catch(e){}
  const k=MULTI_SPECS[kind].legacy; return String(raw).trim()? [{[k]:String(raw)}] : [];
}
function multiRow(kind, item, idx){
  item=item||{}; const cfg=MULTI_SPECS[kind];
  const slot = kind==='ram' ? `<span style="flex:none;width:42px;text-align:center;font-size:12px;color:var(--gray-500);font-weight:700">슬롯${(idx||0)+1}</span>` : '';
  const inputs=cfg.fields.map(f=>`<input class="ms-${kind}-${f.k}" placeholder="${f.ph}"${f.type?` type="${f.type}" min="0"`:''}${(f.opts||f.optKind)?` list="ms-${kind}-${f.k}-list"`:''} value="${esc(item[f.k])||''}" style="flex:${f.flex}"${cfg.calc?` oninput="calcMulti('${kind}')"`:''} autocomplete="off">`).join('');
  return `<div class="ms-${kind}-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center">${slot}${inputs}<button type="button" class="btn btn-sm btn-danger" style="flex:none" onclick="this.parentElement.remove();${cfg.calc?`calcMulti('${kind}')`:''}">−</button></div>`;
}
function multiBlock(kind, raw){
  const cfg=MULTI_SPECS[kind]; const list=parseSpecList(kind, raw);
  const rows=(list.length?list:Array(cfg.init||1).fill({})).map((it,idx)=>multiRow(kind,it,idx)).join('');
  const datalists=cfg.fields.filter(f=>f.opts||f.optKind).map(f=>`<datalist id="ms-${kind}-${f.k}-list">${optHtml([...(f.opts||[]),...(f.optKind?customOpts(f.optKind):[])])}</datalist>`).join('');
  return `${datalists}<div id="ms-${kind}-rows">${rows}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">
      <button type="button" class="btn btn-sm btn-secondary" onclick="addMulti('${kind}')">+ 추가</button>
      ${cfg.calc?`<span style="font-size:12px;color:var(--gray-500)">합계: <strong id="ms-${kind}-total">-</strong></span>`:''}
    </div>`;
}
function addMulti(kind){ const n=document.querySelectorAll('#ms-'+kind+'-rows .ms-'+kind+'-row').length; document.getElementById('ms-'+kind+'-rows').insertAdjacentHTML('beforeend', multiRow(kind,null,n)); if(MULTI_SPECS[kind].calc) calcMulti(kind); }
function collectMulti(kind){ const cfg=MULTI_SPECS[kind];
  return [...document.querySelectorAll('#ms-'+kind+'-rows .ms-'+kind+'-row')].map(r=>{ const o={}; cfg.fields.forEach(f=>o[f.k]=(r.querySelector('.ms-'+kind+'-'+f.k).value||'').trim()); return o; }).filter(o=>Object.values(o).some(x=>x));
}
function calcMulti(kind){ if(!MULTI_SPECS[kind].calc) return;
  const total=[...document.querySelectorAll('#ms-'+kind+'-rows .ms-'+kind+'-size')].reduce((s,el)=>s+(parseFloat(el.value)||0),0);
  const el=document.getElementById('ms-'+kind+'-total'); if(el) el.textContent = total? total+'GB' : '-';
}
// 목록 표시용 요약
function specSummary(kind, raw){
  const list=parseSpecList(kind, raw); if(!list.length) return '';
  const cfg=MULTI_SPECS[kind];
  if(kind==='ram'){ const total=list.reduce((s,x)=>s+(parseFloat(x.size)||0),0);
    const parts=list.map(x=>[(x.size?x.size+'GB':''),x.spec,x.maker].filter(Boolean).join(' ')).filter(Boolean).join(' + ');
    return (total?total+'GB':'')+(parts?' ('+parts+')':''); }
  return list.map(x=>cfg.fields.map(f=>x[f.k]).filter(Boolean).join(' ')).filter(Boolean).join(', ');
}
// 프린터: 여러 대 가능 (프린터명/모델 + IP). DB의 printer 컬럼에 JSON으로 저장
function parsePrinters(raw){ if(!raw) return []; try{ const a=JSON.parse(raw); return Array.isArray(a)?a:[]; }catch(e){ return raw?[{name:String(raw),ip:''}]:[]; } }
function printerRowHtml(p){ p=p||{}; return `<div class="printer-row" style="display:flex;gap:6px;margin-bottom:6px">
    <input class="p-name" placeholder="프린터명/모델" value="${esc(p.name)||''}" style="flex:2">
    <input class="p-ip" placeholder="IP (선택)" value="${esc(p.ip)||''}" style="flex:1">
    <button type="button" class="btn btn-sm btn-danger" style="flex:none" onclick="this.parentElement.remove()">−</button>
  </div>`; }
function addPrinterRow(){ document.getElementById('printer_rows').insertAdjacentHTML('beforeend', printerRowHtml()); }
function collectPrinters(){ return [...document.querySelectorAll('#printer_rows .printer-row')].map(r=>({name:r.querySelector('.p-name').value.trim(), ip:r.querySelector('.p-ip').value.trim()})).filter(p=>p.name||p.ip); }

// ── 고객 추가/수정 ──
function openCustomerModal(id, prefill){
  const c = id? (state.customers.find(x=>x.id==id) || {}) : (prefill||{});
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
    ${postcodeBtn('c_address','c_addr2')}
    ${field('c_addr2','상세주소 (동/호/층)',c.address_detail)}
    <div style="margin-top:6px;font-size:12px;color:#1971c2;font-weight:600">사업자정보 (선택 — 견적서·명세서·계산서 자동입력용)</div>
    <div class="form-row">${field('c_ceo','대표자',c.ceo_name)}${field('c_bizno','사업자번호',c.biz_no)}</div>
    <div class="form-row">${field('c_biztype','업태',c.biz_type)}${field('c_bizitem','종목',c.biz_item)}</div>
    ${area('c_memo','메모',c.memo)}
    ${isEdit?field('c_outstanding','미수금',c.outstanding_amount,'number'):''}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveCustomer(${id||'null'})">저장</button></div>`;
  modal(isEdit?'고객 수정':'고객 추가', body);
}
function toggleBiz(){ document.getElementById('bizFields').style.display = v('c_type')==='business'?'block':'none'; }
async function saveCustomer(id){
  const data = { name:v('c_name'), phone:v('c_phone'), customer_type:v('c_type'), company_name:v('c_company'), contact_person:v('c_contact'), phone2:v('c_phone2'), email:v('c_email'), address:v('c_address'), address_detail:v('c_addr2'), memo:v('c_memo'), biz_no:v('c_bizno'), biz_type:v('c_biztype'), biz_item:v('c_bizitem'), ceo_name:v('c_ceo') };
  if(!data.phone){ alert('전화번호는 필수입니다'); return; }
  if(id){ data.outstanding_amount = Number(v('c_outstanding'))||0; await api('PUT','/customers/'+id, data); }
  else await api('POST','/customers', data);
  closeModal(); await loadAll();
  if(id && typeof estState!=='undefined' && estState && estState.customerId==id){
    estState.customer=data.name||data.company_name||'';
    estState.phone=data.phone||'';
    estState.buyerCeo=data.ceo_name||data.contact_person||'';
    estState.buyerAddr=[data.address,data.address_detail].filter(Boolean).join(' ');
    estState.buyerBizno=data.biz_no||'';
    estState.buyerType=data.biz_type||'';
    estState.buyerItem=data.biz_item||'';
    if(typeof _estForceRender!=='undefined'){_estForceRender=true; render();}
  }
}

// ── 장비 추가/수정 ──
const OS_OPTS=['Windows XP','Windows 7','Windows 8.1','Windows 10','Windows 11','Windows 12'];
// 파워/모니터 선택 옵션
const POWER_TYPES=['ATX','M-ATX','TFX'];
const POWER_WATTS=['200~250W','300W~350W','400W~450W','500W~550W','600W~650W','700W~750W','800W~850W','900W~950W'];
const MONITOR_PORTS=['HDMI','DP','DVI','RGB','썬더볼트','미니HDMI','마이크로HDMI'];
const OFFICE_OPTS=['Office 2007','Office 2010','Office 2013','Office 2016','Office 2019','Office 2021','Microsoft 365'];
const CAD_OPTS=['AutoCAD 2018','AutoCAD 2020','AutoCAD 2022','AutoCAD 2024','ZWCAD'];
const ADOBE_OPTS=['Acrobat Reader','Acrobat Pro','Photoshop','Illustrator','Adobe CC'];
function openComputerModal(id, customerId){
  const c = id? state.computers.find(x=>x.id==id) : { customer_id:customerId, device_type:'desktop' };
  const isEdit = !!id;
  const cid = c.customer_id;
  const cust = state.customers.find(x=>x.id==cid) || {};
  const cname = cust.company_name || cust.name || cust.phone || ('고객'+cid);
  const mb = mbParse(c.motherboard);
  // 파워/모니터 기존값 분해 (선택식 프리필용)
  const allPwTypes = [...POWER_TYPES, ...((state.partOptions||[]).filter(o=>o.kind==='pwtype').map(o=>o.value))];
  const pwType = allPwTypes.slice().sort((a,b)=>b.length-a.length).find(t=>(c.power||'').includes(t)) || '';
  const pwWatt = (c.power||'').replace(pwType,'').trim();
  const mon = monParse(c.monitor);
  const cpuG = inferCpu(c.cpu);      // 편집 시 CPU 플랫폼/세대 프리필
  const vgaG = inferVga(c.gpu);      // 편집 시 VGA 제조사/시리즈 프리필
  const body = `
    <div class="form-group"><label>거래처 (고정)</label>
      <input type="hidden" id="p_cust" value="${cid||''}">
      <input value="${esc(cname)}" disabled style="background:var(--gray-100);color:var(--gray-600);cursor:not-allowed"></div>
    <div class="form-row">
      <div class="form-group"><label>장비 종류 *</label><select id="p_type">
        ${Object.entries(DEVICE_TYPES).map(([k,l])=>`<option value="${k}" ${c.device_type===k?'selected':''}>${l}</option>`).join('')}
      </select></div>
      ${field('p_name','장비명 (선택)',c.name)}
    </div>
    <div class="form-section">하드웨어 <span style="font-weight:400;color:var(--gray-400);font-size:11px">(추후 스마트폰 AI 사진으로 자동 입력 예정)</span></div>
    <div class="form-group"><label>CPU</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="p_cpu_plat" onchange="updateCpuSub()" style="flex:none;width:90px"><option value="">플랫폼</option><option ${cpuG.plat==='Intel'?'selected':''}>Intel</option><option ${cpuG.plat==='AMD'?'selected':''}>AMD</option></select>
        <select id="p_cpu_sub" onchange="updateCpuModels()" style="flex:none;width:120px"><option value="">세대/소켓</option></select>
        <input id="p_cpu" list="cpu_list" value="${esc(c.cpu)||''}" placeholder="모델 선택/입력" style="flex:1;min-width:150px" autocomplete="off">
        <datalist id="cpu_list"></datalist>
      </div>
      <div id="cpu_info" style="font-size:11.5px;color:var(--gray-500);margin-top:5px;white-space:pre-line"></div></div>
    <div class="form-group"><label>메인보드</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="p_mb_plat" onchange="updateMbChipset()" style="flex:none;width:100px"><option value="">플랫폼</option><option ${mb.plat==='Intel'?'selected':''}>Intel</option><option ${mb.plat==='AMD'?'selected':''}>AMD</option></select>
        <input id="p_mb_maker" list="mb_maker_list" value="${esc(mb.maker)||''}" placeholder="제조사" style="flex:1;min-width:100px" autocomplete="off">
        <input id="p_mb_chipset" list="mb_chipset_list" value="${esc(mb.chipset)||''}" placeholder="칩셋" style="flex:1;min-width:100px" autocomplete="off">
        <input id="p_mb_model" value="${esc(mb.model)||''}" placeholder="세부 모델(선택)" style="flex:2;min-width:130px">
      </div>
      <datalist id="mb_maker_list">${optHtml([...MB_MAKERS,...customOpts('mbmaker')])}</datalist>
      <datalist id="mb_chipset_list"></datalist></div>
    <div class="form-group"><label>VGA (그래픽카드)</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="p_vga_maker" onchange="updateVgaSeries()" style="flex:none;width:110px"><option value="">제조사</option>${['내장 그래픽','NVIDIA','AMD','Intel Arc'].map(o=>`<option ${vgaG.maker===o?'selected':''}>${o}</option>`).join('')}</select>
        <select id="p_vga_series" onchange="updateVgaModels()" style="flex:none;width:110px"><option value="">시리즈</option></select>
        <input id="p_gpu" list="vga_list" value="${esc(c.gpu)||''}" placeholder="모델 선택/입력" style="flex:1;min-width:150px" autocomplete="off">
        <datalist id="vga_list"></datalist>
      </div></div>
    <div class="form-group"><label>파워</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <input id="p_pw_type" list="pw_type_list" value="${esc(pwType)||''}" placeholder="종류(ATX 등)" style="flex:1;min-width:110px" autocomplete="off">
        <input id="p_pw_watt" list="pw_watt_list" value="${esc(pwWatt)||''}" placeholder="와트(선택/1000W↑ 직접)" style="flex:2;min-width:150px" autocomplete="off">
      </div>
      <datalist id="pw_type_list">${optHtml([...POWER_TYPES,...customOpts('pwtype')])}</datalist>
      <datalist id="pw_watt_list">${optHtml([...POWER_WATTS,...customOpts('pwwatt')])}</datalist></div>
    <div class="form-group"><label>모니터</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <input id="p_mon_inch" value="${esc(mon.inch)||''}" placeholder="인치(예: 27)" style="flex:1;min-width:90px" autocomplete="off">
        <input id="p_mon_model" value="${esc(mon.model)||''}" placeholder="모델명(예: LG 27GL850 · 아답터 확인용)" style="flex:2;min-width:170px" autocomplete="off">
      </div>
      <div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">연결포트 (복수 선택)</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        ${[...new Set([...MONITOR_PORTS,...customOpts('monport'),...mon.ports])].map(p=>`<label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:400;cursor:pointer"><input type="checkbox" class="mon-port" value="${esc(p)}" ${mon.ports.includes(p)?'checked':''} style="width:16px;height:16px"> ${esc(p)}</label>`).join('')}
      </div></div>
    <div class="form-group"><label>RAM (슬롯당 메모리 · 합계 자동계산)</label>${multiBlock('ram',c.ram)}</div>
    <div class="form-group"><label>SSD (여러 개 가능)</label>${multiBlock('ssd',c.ssd)}</div>
    <div class="form-group"><label>HDD (여러 개 가능)</label>${multiBlock('hdd',c.hdd)}</div>
    <div class="form-row">${field('p_serial','시리얼번호',c.serial_number)}${field('p_bios','BIOS 버전',c.bios_version)}</div>
    <div class="form-section">소프트웨어 <span style="font-weight:400;color:var(--gray-400);font-size:11px">(설치 확인용 · 선택 또는 직접 입력)</span></div>
    <div class="form-row">${comboField('p_os','OS',c.os,'os_list',[...OS_OPTS,...customOpts('os')])}${comboField('p_office','Office',c.office_version,'office_list',[...OFFICE_OPTS,...customOpts('office')])}</div>
    <div class="form-row">${comboField('p_cad','캐드(CAD)',c.cad,'cad_list',[...CAD_OPTS,...customOpts('cad')])}${comboField('p_adobe','어도비(Adobe)',c.adobe,'adobe_list',[...ADOBE_OPTS,...customOpts('adobe')])}</div>
    <div class="form-row">${field('p_etc1','기타 프로그램 1',c.etc_program1)}${field('p_etc2','기타 프로그램 2',c.etc_program2)}</div>
    <div class="form-section">네트워크</div>
    <div class="form-row">${field('p_ip','IP주소',c.ip_address)}${field('p_mac','MAC주소',c.mac_address)}</div>
    <div class="form-row">${field('p_pdate','구입일',c.purchase_date,'date')}${field('p_warr','보증만료',c.warranty_expiry,'date')}</div>
    <div class="form-section">프린터 (여러 대 가능 · 없으면 빈칸)</div>
    <div id="printer_rows">${(parsePrinters(c.printer).length?parsePrinters(c.printer):[{}]).map(printerRowHtml).join('')}</div>
    <button type="button" class="btn btn-sm btn-secondary" onclick="addPrinterRow()">+ 프린터 추가</button>
    <div class="form-section">NAS (없으면 빈칸)</div>
    <div class="form-row">${field('p_nasname','NAS 이름/모델',c.nas_name||c.nas_model)}${field('p_nasip','NAS IP',c.nas_ip)}</div>
    <div class="form-row">${field('p_nascap','총 용량',c.nas_total_capacity)}${field('p_naspart','파티션',c.nas_partition_info)}</div>
    <div class="form-row">${field('p_nasid','관리자 ID',c.nas_admin_id)}${field('p_naspw','관리자 PW',c.nas_admin_password)}</div>
    <div class="form-section">공유기 (없으면 빈칸)</div>
    <div class="form-row">${field('p_rtname','공유기 이름/모델',c.router_name||c.router_model)}${field('p_rtip','공유기 IP',c.router_ip)}</div>
    <div class="form-row">${field('p_rthub','허브 연결 갯수',c.router_hub_count)}${field('p_rtid','관리자 ID',c.router_admin_id)}</div>
    ${field('p_rtpw','공유기 관리자 PW',c.router_admin_password)}
    ${area('p_notes','메모',c.notes)}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveComputer(${id||'null'})">저장</button></div>`;
  modal(isEdit?'장치 수정':'장치 추가', body, true);
  calcMulti('ram'); updateMbChipset();
  // 플랫폼이 프리필된 상태에서 세대·시리즈 목록을 만들고, 저장값에 해당하는 항목을 선택한다
  updateCpuSub(); if(cpuG.sub){ const e=document.getElementById('p_cpu_sub'); if(e){ e.value=cpuG.sub; updateCpuModels(); } }
  updateVgaSeries(); if(vgaG.series){ const e=document.getElementById('p_vga_series'); if(e){ e.value=vgaG.series; updateVgaModels(); } }
}
async function saveComputer(id){
  const data = {
    customer_id:Number(v('p_cust')), name:v('p_name'), device_type:v('p_type'), serial_number:v('p_serial'), bios_version:v('p_bios'),
    cpu:v('p_cpu'), ram:JSON.stringify(collectMulti('ram')), ssd:JSON.stringify(collectMulti('ssd')), hdd:JSON.stringify(collectMulti('hdd')), motherboard:collectMb(), gpu:v('p_gpu'),
    power:[v('p_pw_type'),v('p_pw_watt')].filter(Boolean).join(' '), monitor:collectMonitor(),
    os:v('p_os'), office_version:v('p_office'), cad:v('p_cad'), adobe:v('p_adobe'), etc_program1:v('p_etc1'), etc_program2:v('p_etc2'),
    ip_address:v('p_ip'), mac_address:v('p_mac'), purchase_date:v('p_pdate'), warranty_expiry:v('p_warr'),
    printer:JSON.stringify(collectPrinters()),
    nas_name:v('p_nasname'), nas_model:'', nas_ip:v('p_nasip'), nas_total_capacity:v('p_nascap'), nas_partition_info:v('p_naspart'), nas_admin_id:v('p_nasid'), nas_admin_password:v('p_naspw'),
    router_name:v('p_rtname'), router_model:'', router_ip:v('p_rtip'), router_hub_count:v('p_rthub'), router_admin_id:v('p_rtid'), router_admin_password:v('p_rtpw'),
    notes:v('p_notes'),
  };
  if(!data.customer_id){ alert('거래처 정보가 없습니다'); return; }
  if(!data.name) data.name = '장치';   // 장비명은 선택 — 비우면 기본값(거래처에 귀속)
  try{
    if(id) await api('PUT','/computers/'+id, data); else await api('POST','/computers', data);
  }catch(e){ alert('저장 실패: '+(e && e.message ? e.message : e)); return; }
  closeModal(); await loadAll();
}
async function deleteComputer(id){ if(!confirm('이 장비를 삭제하시겠습니까?'))return; await api('DELETE','/computers/'+id); custState.selComp=null; await loadAll(); }

// ── 접수 등록 (기존 고객 검색 또는 신규 고객 입력) ──
let recPick = { customerId:'', search:'', open:false, mode:'search', newName:'', newPhone:'' };
function openReceptionModal(){
  recPick = { customerId:'', search:'', open:false, mode:'search', newName:'', newPhone:'' };
  const body = `
    <div class="tabs" style="margin-bottom:14px">
      <button class="tab ${recPick.mode==='search'?'active':''}" onclick="recPick.mode='search';renderCustSelect()">기존 고객</button>
      <button class="tab ${recPick.mode==='new'?'active':''}" onclick="recPick.mode='new';renderCustSelect()">신규 고객</button>
    </div>
    <div id="custSelectContainer"></div>
    <div class="form-row" style="margin-top:14px">
      <div class="form-group"><label>접수 채널 *</label><select id="r_channel">
        <option value="phone">전화</option><option value="sms">SMS</option><option value="kakao">카카오톡</option><option value="direct">직접등록</option></select></div>
    </div>
    <div id="custHistory"></div>
    ${field('r_phone','전화번호','')}
    ${area('r_symptom','증상 *','')}
    ${area('r_memo','초기 메모','')}
    <div class="form-group"><label>담당 기사</label><select id="r_eng">
      <option value="">미지정</option>
      ${state.engineers.map(e=>`<option value="${e.id}">${esc(e.name)}${e.is_admin?' (대표)':''} · ${statusLabel(e.status)}</option>`).join('')}
    </select></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveReception()">접수 등록</button></div>`;
  modal('접수 등록 · 작업지시', body);
  renderCustSelect();
}
function renderCustSelect(){
  const el = document.getElementById('custSelectContainer'); if(!el) return;

  if(recPick.mode === 'search'){
    // 기존 고객 검색 모드
    const sel = state.customers.find(c=>c.id==recPick.customerId);
    // 선택 완료 상태: 칩만 표시
    if(sel && !recPick.open){
      el.innerHTML = `<div class="form-group"><label>고객 *</label><div class="cs-box"><span style="flex:1">${esc(sel.name)||esc(sel.phone)} ${sel.name?`<span style="color:var(--gray-400);font-size:12px">(${esc(sel.phone)})</span>`:''}</span><button onclick="clearCust()" style="border:none;background:none;cursor:pointer;color:var(--gray-400);font-size:16px">×</button></div></div>`;
      return;
    }
    // 검색 상태: 입력창은 고정, 목록만 갱신
    el.innerHTML = `<div class="form-group"><label>고객 *</label><div class="cs-wrap">
      <div class="cs-box"><input id="csInput" autocomplete="off" placeholder="이름, 전화번호 검색..." value="${esc(recPick.search)}"
        oninput="onCustInput(this.value)" onfocus="recPick.open=true;updateCustList()" onblur="setTimeout(()=>{recPick.open=false;updateCustList()},180)"></div>
      <div id="csList" class="cs-list" style="display:none"></div>
    </div></div>`;
    const i=document.getElementById('csInput'); if(i)i.focus();
    updateCustList();
  } else {
    // 신규 고객 입력 모드
    el.innerHTML = `<div class="form-row">
      ${field('newCustName','고객명',recPick.newName)}
      ${field('newCustPhone','전화번호',recPick.newPhone)}
    </div>`;
    // 입력값 동기화
    document.getElementById('newCustName').addEventListener('input', e => recPick.newName = e.target.value);
    document.getElementById('newCustPhone').addEventListener('input', e => recPick.newPhone = e.target.value);
  }
}
function onCustInput(val){ recPick.search=val; recPick.open=true; updateCustList(); }
function updateCustList(){
  const listEl=document.getElementById('csList'); if(!listEl) return;
  if(!recPick.open){ listEl.style.display='none'; return; }
  const q=recPick.search.toLowerCase();
  const filtered=state.customers.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q)||(c.company_name||'').toLowerCase().includes(q));
  listEl.style.display='block';
  listEl.innerHTML = filtered.length? filtered.slice(0,30).map(c=>`<div class="cs-item" onmousedown="pickCust(${c.id})"><strong>${esc(c.name)||esc(c.phone)}</strong> ${c.name?`<span style="color:var(--gray-400);font-size:12px">${esc(c.phone)}</span>`:''}${c.company_name?` · ${esc(c.company_name)}`:''}</div>`).join('') : '<div class="cs-item" style="color:var(--gray-400)">검색 결과 없음</div>';
}
function clearCust(){ recPick.customerId=''; recPick.search=''; recPick.open=true; renderCustSelect(); renderCustHistory(); }
function pickCust(id){
  recPick.customerId=id; recPick.open=false; recPick.search='';
  renderCustSelect();
  const c=state.customers.find(x=>x.id==id);
  const phoneEl=document.getElementById('r_phone');
  if(phoneEl && c && !phoneEl.value) phoneEl.value=c.phone||'';   // 전화번호 자동입력
  renderCustHistory();
}
function renderCustHistory(){
  const el=document.getElementById('custHistory'); if(!el) return;
  if(!recPick.customerId){ el.innerHTML=''; return; }
  const past=state.receptions.filter(r=>r.customer_id==recPick.customerId)
    .sort((a,b)=>(b.received_at||'').localeCompare(a.received_at||''));
  if(!past.length){ el.innerHTML='<div style="font-size:12px;color:var(--gray-400);margin:2px 0 10px">과거 접수 이력 없음</div>'; return; }
  el.innerHTML=`<div style="margin:2px 0 12px;border:1px solid var(--gray-200);border-radius:8px;padding:8px 10px;background:var(--gray-50)">
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:5px">📋 과거 접수 이력 (${past.length})</div>
    ${past.slice(0,5).map(r=>`<div style="font-size:12px;padding:3px 0;border-bottom:1px solid var(--gray-200)"><span class="badge ${r.status}" style="font-size:10px">${statusLabel(r.status)}</span> ${esc(r.symptom)||'-'} <span style="color:var(--gray-400);float:right">${(r.received_at||'').slice(0,10)}</span></div>`).join('')}
    ${past.length>5?`<div style="font-size:11px;color:var(--gray-400);margin-top:4px">외 ${past.length-5}건</div>`:''}
  </div>`;
}
async function saveReception(){
  let customerId = null;
  const symptom = v('r_symptom'); if(!symptom){ alert('증상을 입력하세요'); return; }

  if(recPick.mode === 'search'){
    // 기존 고객 선택 모드
    if(!recPick.customerId){ alert('고객을 선택하세요'); return; }
    customerId = Number(recPick.customerId);
  } else {
    // 신규 고객 모드: 고객명 또는 전화번호로 검색 후 없으면 생성
    const name = recPick.newName.trim();
    const phone = recPick.newPhone.trim();

    if(!name && !phone){ alert('고객명 또는 전화번호 중 하나는 입력해야 합니다'); return; }

    // 고객명 또는 전화번호로 기존 고객 검색
    let existingCust = null;
    if(name) existingCust = state.customers.find(c => (c.name || '').toLowerCase() === name.toLowerCase());
    if(!existingCust && phone){ const pd=digits(phone); if(pd) existingCust = state.customers.find(c => digits(c.phone)===pd || digits(c.phone2)===pd); }

    if(existingCust){
      // 기존 고객 발견
      customerId = existingCust.id;
    } else {
      // 신규 고객 생성
      const newCust = await api('POST', '/customers', {
        name: name || phone,  // 고객명이 없으면 전화번호를 고객명으로
        phone: phone,
        customer_type: 'personal'
      });
      customerId = newCust.id;
    }
  }

  const rec = await api('POST','/receptions', { customer_id:customerId, reception_channel:v('r_channel'), reception_phone:v('r_phone'), symptom, initial_memo:v('r_memo') });
  const eng = v('r_eng');
  if(eng) await api('PUT',`/receptions/${rec.id}/assign?engineer_id=${eng}`);   // 작업지시: 바로 배정
  csepLog('info','RECEPTION','PC 접수 생성 #'+rec.id,symptom);
  closeModal(); await loadAll();
}

// ── 기사 추가 ──
function openEngineerModal(id){
  const e = id ? (state.engineers.find(x=>x.id==id)||{}) : {};
  const isEdit = !!id;
  const body = `
    <div class="form-row">${field('e_name','이름 *',e.name||'')}${field('e_phone','전화번호',e.phone||'')}</div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:6px;font-weight:600"><input type="checkbox" id="e_admin" ${e.is_admin?'checked':''}> 대표 권한 (기사앱 대표 모드 · 전체 배차/전화감지)</label></div>
    <div class="form-group"><label>기사앱 로그인 비밀번호 ${isEdit?'<span style="font-weight:400;color:var(--gray-400)">(변경할 때만 입력)</span>':''}</label>
      <input id="e_pw" type="password" autocomplete="off" placeholder="${isEdit?(e.has_password?'●●● 설정됨 — 바꾸려면 새 비번 입력':'미설정 — 입력하면 비번 설정'):'비워두면 비번 없이 로그인'}" style="padding:9px 12px;border:1px solid var(--gray-300);border-radius:8px;width:100%"></div>
    ${isEdit&&e.has_password?`<label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:400;margin-bottom:8px"><input type="checkbox" id="e_clearpw"> 비밀번호 제거 (비번 없이 로그인)</label>`:''}
    ${isEdit&&e.locked?`<div style="margin-bottom:10px;padding:9px 12px;background:#fff0f0;border-radius:8px;color:var(--danger);font-weight:600">🔒 계정 잠김 (비번 3회 오류) — <button class="btn btn-sm btn-success" onclick="unlockEngineer(${e.id});closeModal()">잠금 해제</button></div>`:''}
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">취소</button><button class="btn" onclick="saveEngineer(${id||'null'})">저장</button></div>`;
  modal(isEdit?'기사 편집':'기사 추가', body);
}
async function saveEngineer(id){
  const name=v('e_name'); if(!name){ alert('이름을 입력하세요'); return; }
  const data = { name, phone:v('e_phone'), is_admin:document.getElementById('e_admin').checked };
  const pw=v('e_pw'); if(pw) data.password=pw;
  const clr=document.getElementById('e_clearpw'); if(clr&&clr.checked) data.clear_password=true;
  if(id) await api('PUT','/engineers/'+id, data);
  else await api('POST','/engineers', data);
  closeModal(); await loadAll();
}

// ── 판매 등록 ──
function openSaleModal(){
  const custOptions = state.customers.map(x=>`<option value="${x.id}">${esc(x.name)||esc(x.phone)||('고객'+x.id)}</option>`).join('');
  const body = `
    <div class="form-group"><label>고객 *</label><select id="s_cust"><option value="">— 고객을 선택하세요 —</option>${custOptions}</select></div>
    <div class="form-row">${field('s_item','품목명 *','')}<div class="form-group"><label>품목 유형</label><select id="s_type"><option value="part">부품</option><option value="product">완제품</option><option value="service">서비스</option></select></div></div>
    <div class="form-row">${field('s_qty','수량','1','number')}${field('s_price','단가','0','number')}</div>
    <div class="form-row">${field('s_date','판매일',kstNow(),'date')}<div class="form-group"><label>결제수단</label><select id="s_method"><option value="cash">현금</option><option value="card">카드</option><option value="transfer">계좌이체</option></select></div></div>
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

// ============================================================
//  작업별 채팅 (관리자 ↔ 기사)
// ============================================================
let adminChatUnread={}, adminChatOpen=null;
async function openAdminChat(recId){
  adminChatOpen=recId;
  let msgs=[]; try{ msgs=await api('GET',`/receptions/${recId}/messages`); }catch(e){}
  try{ await api('POST',`/receptions/${recId}/messages/read?side=admin`); }catch(e){}
  adminChatUnread[recId]=0;
  renderAdminChat(recId,msgs);
}
function closeAdminChat(){ adminChatOpen=null; closeModal(); renderInto(); }
function adminChatBubble(m){
  const mine=m.sender==='admin';
  return `<div style="display:flex;justify-content:${mine?'flex-end':'flex-start'};margin-bottom:8px">
    <div style="max-width:78%;padding:8px 12px;border-radius:12px;background:${mine?'var(--primary)':'var(--gray-100)'};color:${mine?'#fff':'var(--gray-700)'};font-size:14px;word-break:break-word">
      ${m.photo?`<img src="${imgUrl(m.photo)}" style="max-width:100%;border-radius:8px;${m.text?'margin-bottom:4px':''}">`:''}
      ${m.text?esc(m.text):''}
    </div></div>`;
}
function renderAdminChat(recId,msgs){
  const r=state.receptions.find(x=>x.id==recId)||{};
  document.getElementById('modalRoot').innerHTML=`
  <div class="modal-overlay" onclick="if(event.target===this)closeAdminChat()">
    <div class="modal">
      <div class="modal-head"><h3>💬 대화 · ${esc(custName(r.customer_id))}</h3><button class="modal-close" onclick="closeAdminChat()">×</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column">
        <div id="aChatBody" style="max-height:50vh;overflow-y:auto;margin-bottom:10px;min-height:180px">
          ${msgs.length?msgs.map(adminChatBubble).join(''):'<div class="empty-state">대화가 없습니다</div>'}
        </div>
        <div style="display:flex;gap:6px;align-items:center;border-top:1px solid var(--gray-200);padding-top:10px">
          <label style="cursor:pointer;font-size:22px">📷<input type="file" accept="image/*" onchange="sendAdminChatPhoto(${recId},this)" style="display:none"></label>
          <input id="aChatText" placeholder="메시지 입력" style="flex:1;padding:9px 12px;border:1px solid var(--gray-300);border-radius:8px" onkeydown="if(event.key==='Enter')sendAdminChat(${recId})">
          <button class="btn" onclick="sendAdminChat(${recId})">전송</button>
        </div>
      </div>
    </div>
  </div>`;
  const b=document.getElementById('aChatBody'); if(b)b.scrollTop=b.scrollHeight;
}
async function sendAdminChat(recId){
  const el=document.getElementById('aChatText'); if(!el)return; const text=el.value.trim(); if(!text)return;
  el.value='';
  await api('POST',`/receptions/${recId}/messages`,{sender:'admin',text});
  renderAdminChat(recId, await api('GET',`/receptions/${recId}/messages`));
}
async function sendAdminChatPhoto(recId,input){
  const f=input.files&&input.files[0]; if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{ const img=new Image(); img.onload=async()=>{
    const max=1000; let w=img.width,h=img.height;
    if(w>max||h>max){ if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;} }
    const c=document.createElement('canvas'); c.width=w;c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    await api('POST',`/receptions/${recId}/messages`,{sender:'admin',photo:c.toDataURL('image/jpeg',0.6)});
    renderAdminChat(recId, await api('GET',`/receptions/${recId}/messages`));
  }; img.src=e.target.result; };
  reader.readAsDataURL(f); input.value='';
}
async function pollChatUnread(){
  try{
    const u=await api('GET','/messages/unread-admin');
    if(JSON.stringify(u)!==JSON.stringify(adminChatUnread)){ adminChatUnread=u; if(!document.querySelector('.modal-overlay'))renderInto(); }
  }catch(e){}
}

// ── 전화 수신 테스트 ──
function testCall(){
  // PC 관리자 앱의 상태 객체는 state (기사앱이 S). 예전엔 window.S 를 봐서 목록이 늘 비어 있었음
  const engs=(typeof state!=='undefined'&&state.engineers)||[];
  const engOpts=engs.map(e=>`<option value="${e.phone||''}">${esc(e.name)}${e.is_admin?' (대표)':' (기사)'} — ${e.phone||'번호없음'}</option>`).join('');
  const html=`<div>
    <div style="margin-bottom:12px">
      <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px">직접 입력</label>
      <input id="testPhone" value="01012341234" placeholder="전화번호 입력" style="width:100%;padding:10px;border:1px solid #dee2e6;border-radius:8px;font-size:15px">
    </div>
    ${engs.length?`<div style="margin-bottom:16px">
      <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px">또는 등록된 기사/대표 선택</label>
      <select id="testEngSelect" onchange="document.getElementById('testPhone').value=this.value" style="width:100%;padding:10px;border:1px solid #dee2e6;border-radius:8px;font-size:15px">
        <option value="">— 선택 —</option>${engOpts}</select>
    </div>`:''}
    <div style="margin-bottom:12px">
      <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px">문자 내용 (문자 테스트용)</label>
      <textarea id="testSmsMsg" rows="3" placeholder="예: 서울시 강남구 역삼동 123-4 / 홍길동 / ABC컴퓨터" style="width:100%;padding:10px;border:1px solid #dee2e6;border-radius:8px;font-size:14px;resize:vertical"></textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="doTestCall('call')">📞 전화 테스트</button>
      <button class="btn" style="flex:1;background:#20c997;color:#fff" onclick="doTestCall('sms')">💬 문자 테스트</button>
    </div>
    <button class="btn btn-secondary" style="width:100%;margin-top:8px" onclick="closeModal()">닫기</button>
    <div style="margin-top:10px;font-size:11px;color:var(--gray-400);line-height:1.5">※ 이 테스트는 PC에서 직접 보내는 것이라 항상 동작합니다.<br>실제 전화 감지는 대표 폰의 APK가 서버로 보내야 하므로, 여기서 된다고 폰에서도 되는 것은 아닙니다.</div>
  </div>`;
  modal('📞 수신 테스트', html);
}
async function doTestCall(type){
  const phone=document.getElementById('testPhone').value.trim();
  if(!phone){ alert('전화번호를 입력하세요'); return; }
  try{
    if(type==='sms'){
      const msg=document.getElementById('testSmsMsg').value.trim()||phone;
      await api('POST','/incoming-sms',{phone, message:msg});
    }
    else await api('POST','/incoming-call?phone='+encodeURIComponent(phone));
    closeModal();
  }catch(e){ alert('테스트 실패: '+e.message); }
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
  const smsItem = type==='sms' ? pendingSms.find(s=>s.id==itemId) : null;
  if(type==='call') dismissCall(itemId); else if(type==='sms') dismissSms(itemId);
  go('receptions'); openReceptionModal(); pickCust(custId);
  if(smsItem && smsItem.message){
    const parsed=parseSmsMessage(smsItem.message);
    const memo=[parsed.memo||'',parsed.address||''].filter(Boolean).join(' / ');
    setTimeout(()=>{
      const el=document.getElementById('r_symptom'); if(el) el.value=memo||smsItem.message;
      const chEl=document.getElementById('r_channel'); if(chEl) chEl.value='sms';
    },100);
  }
}
// SMS 메시지에서 주소/이름/상호 자동 추출
// SMS 본문에서 주소만 뽑아낸다.
// 예전 정규식은 "충남 천안시…"처럼 시/도로 시작할 때만 잡아서
// "천안시 서북구…" 같은 일반적인 표기를 전부 놓쳤다(인식률 2/10).
// 네비 인식용 주소 / 상세주소 분리.
// 티맵·카카오맵과 주소API는 '동'까지만 인식하고 호수·층수는 모른다.
// "…불당대로 100, 3층" → 주소 "…불당대로 100" + 상세 "3층"
// "…롯데캐슬 105동 1201호" → 주소 "…롯데캐슬 105동" + 상세 "1201호"  (동은 주소에 남김)
function splitAddressDetail(addr){
  if(!addr) return {address:'', detail:''};
  let a=String(addr).trim(); const det=[];
  const RE_UNIT=/[,\s]*((?:지하\s*)?\d+\s*(?:호실|호|층)|B\d+)\s*$/;
  // 아파트 동은 숫자 앞에 공백이 있는 것만. '상계1동'처럼 한글에 붙은 행정동은 주소에 남긴다.
  const RE_DONG=/([\s,])(\d{1,4}\s*동)\s*$/;
  for(;;){
    let m=a.match(RE_UNIT);
    if(m){ det.unshift(m[1].replace(/\s+/g,'')); a=a.slice(0,m.index).trim(); continue; }
    m=a.match(RE_DONG);
    if(m){ det.unshift(m[2].replace(/\s+/g,'')); a=a.slice(0,m.index).trim(); continue; }
    break;
  }
  return { address:a.replace(/[,\s]+$/,''), detail:det.join(' ') };
}
function extractAddress(text){
  if(!text) return '';
  const SIDO='(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청|전라|경상)(?:특별자치시|특별자치도|특별시|광역시|도)?';
  const SGG ='[가-힣]{1,8}(?:시|군|구)';
  const ROAD='[가-힣A-Za-z0-9]{1,12}(?:대로|로|길)';
  const EMD ='[가-힣0-9]{1,8}(?:읍|면|동|리|가)';
  const BLDG='[가-힣A-Za-z0-9]{1,14}(?:아파트|빌딩|타워|상가|오피스텔|맨션|빌라|캐슬|파크|프라자|플라자|센터|하이츠|자이|푸르지오|래미안|힐스테이트)';
  const UNIT='(?:지하\\s*)?\\d+(?:동|호|층)|B\\d+';   // 지하1층·B1 도 주소 구간에 포함시켜야 상세주소로 분리된다
  const NUM ='\\d+(?:-\\d+)?(?:번지|번길)?';
  const TOK ='(?:'+SIDO+'|'+SGG+'|'+ROAD+'|'+BLDG+'|'+EMD+'|'+UNIT+'|'+NUM+')';
  const SEQ =new RegExp(TOK+'(?:[\\s,]+'+TOK+')+','g');
  const STRONG=/[가-힣](시|군|구|읍|면|동|리|로|길)/;
  const HEAD=new RegExp('(?:'+SIDO+'|'+SGG+')');
  // 사람이름꼴(성씨+2자 이상). 2글자 지명('천안')을 이름으로 오인하지 않도록 3자 이상만.
  const SURNAME=/^(?:김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|류|유|전|홍|고|문|양|손|배|백|허|남|심|노|하|곽|성|차|주|우|구|민|진|지|채|원|천|방|공|현|함|변|추|도|석|소|설|선|마|길|연|위|표|명|기|반|라|왕|금|옥|육|인|맹|제|모|탁|국|어|은|편|용|예|경|봉|사|부|가|복|태|목|피|감|당|탕|점)[가-힣]{2,3}$/;
  const reSido=new RegExp('^'+SIDO), reSgg=new RegExp(SGG), reRoad=new RegExp(ROAD), reEmd=new RegExp(EMD), reBldg=new RegExp(BLDG);
  const lines=String(text).split(/\n/).map(s=>s.trim()).filter(Boolean);
  let best='', bestScore=-1;
  for(const line of (lines.length?lines:[String(text).trim()])){
    SEQ.lastIndex=0;
    let m;
    while((m=SEQ.exec(line))!==null){
      let a=m[0].trim().replace(/[,\s]+$/,'');
      if(!STRONG.test(a)) continue;
      const h=a.match(HEAD);                    // "홍길동 천안시…" → 이름 앞머리 제거
      if(h && h.index>0){ const prefix=a.slice(0,h.index).trim(); if(SURNAME.test(prefix)) a=a.slice(h.index).trim(); }
      // "천안 서북구…" 처럼 구/군 앞 도시명은 토큰이 아니라 빠진다 → 앞 낱말 하나를 끌어옴
      if(/^[가-힣]{1,8}(?:구|군)(\s|$)/.test(a)){
        const before=line.slice(0,m.index).trim();
        const w=(before.match(/([가-힣]{2,4})$/)||[])[1];
        if(w && !SURNAME.test(w) && !/(시|군|구|읍|면|동|리|로|길)$/.test(w)) a=w+' '+a;
      }
      if(a.length<5) continue;
      let sc=0;
      if(reSido.test(a)) sc+=3;
      if(reSgg.test(a)) sc+=3;
      if(reRoad.test(a)) sc+=2;
      if(reEmd.test(a)) sc+=2;
      if(/\d/.test(a)) sc+=2;
      if(reBldg.test(a)) sc+=1;
      sc+=Math.min(a.length/20,1);
      if(sc>bestScore){ bestScore=sc; best=a; }
    }
  }
  return best;
}
function parseSmsMessage(msg){
  if(!msg) return {};
  const result={};
  const addr=extractAddress(msg);
  if(addr){
    const sp=splitAddressDetail(addr);        // 호/층은 네비가 못 읽으므로 상세주소로 분리
    result.address=sp.address;
    if(sp.detail) result.address_detail=sp.detail;
  }
  const lines=msg.split(/[\n,\/]/).map(s=>s.trim()).filter(Boolean);
  for(const line of lines){
    if(result.address && line.includes(result.address)) continue;
    if(/[가-힣a-zA-Z]{2,}(?:컴퓨터|전자|통신|사무|상사|기업|회사|주식회사|㈜|업체|센터|학원|병원|약국|마트|식당|카페|호텔|모텔|공업사|정비|인쇄)/.test(line)||/^㈜/.test(line)){
      result.company_name=line; result.customer_type='business';
    } else if(/^[가-힣]{2,4}$/.test(line) && /^(?:김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|류|유|전|홍|고|문|양|손|배|백|허|남|심|노|하|곽|성|차|주|우|구|민|진|지|채|원|천|방|공|현|함|변|추|도|석|소|설|선|마|길|연|위|표|명|기|반|라|왕|금|옥|육|인|맹|제|모|탁|국|어|은|편|용|예|경|봉|사|부|가|복|태|목|피|감|당|탕|점)/.test(line) && !/^(?:안녕|감사|부탁|연락|문의|고장|수리|방문|확인|예약|접수|상담|주문|배송|결제|취소|요청|답변|처리|완료|진행|대기|긴급|참고|전달)/.test(line) && !result.name) result.name=line;
  }
  // 메모 = 원문에서 주소·이름·상호를 '빼고' 남은 것.
  // 예전엔 '주소와 똑같은 줄'만 제외해서, 주소가 줄의 일부이거나 쉼표를 넘어가면
  // 메모에 주소가 그대로 중복 기입됐다.
  let rest=String(msg);
  if(result.address) rest=rest.split(result.address).join(' ');
  if(result.address_detail) rest=rest.split(result.address_detail).join(' ');
  if(result.name) rest=rest.split(result.name).join(' ');
  if(result.company_name) rest=rest.split(result.company_name).join(' ');
  rest=rest.split(/[\n,\/]/).map(s=>s.trim()).filter(Boolean).join(' ').replace(/\s{2,}/g,' ').trim();
  if(rest) result.memo=rest;
  return result;
}
// 미등록 번호 → 전화번호 채운 고객 등록 모달
function registerFromPopup(phone, type, itemId){
  const smsItem = type==='sms' ? pendingSms.find(s=>s.id==itemId) : null;
  if(type==='call') dismissCall(itemId); else if(type==='sms') dismissSms(itemId);
  const prefill = { phone };
  if(smsItem && smsItem.message) Object.assign(prefill, parseSmsMessage(smsItem.message));
  openCustomerModal(null, prefill);
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
// 완료 알림: 소리 + 팝업
function playNotificationSound(){
  try{
    // Web Audio API로 간단한 beep 음 생성 (2024 이상 모던 브라우저용)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 800;  // 800 Hz 신호음
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }catch(e){
    console.log('소리 재생 실패:', e.message);
  }
}

// 비차단 토스트 알림 (alert() 대체 — alert은 JS 블로킹 + IME 끊김 유발)
let _toastOffset = 0;
function showToast(message, color){
  if(!document.getElementById('toastStyles')){
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `@keyframes toastIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes toastOut{from{opacity:1}to{opacity:0}}`;
    document.head.appendChild(style);
  }
  const el = document.createElement('div');
  const top = 80 + _toastOffset;
  _toastOffset += 72;
  el.style.cssText = `position:fixed;top:${top}px;right:20px;background:${color||'var(--success)'};color:#fff;padding:14px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:10000;font-weight:600;max-width:340px;word-break:break-word;animation:toastIn .3s ease-out;cursor:pointer;font-size:14px`;
  el.innerHTML = message;
  el.onclick = () => remove();
  document.body.appendChild(el);
  function remove(){ if(!el.parentElement) return; el.style.animation='toastOut .3s ease-in forwards'; setTimeout(()=>{el.remove(); _toastOffset=Math.max(0,_toastOffset-72);}, 300); }
  setTimeout(remove, 3000);
}

// 완료 알림 — 사라지지 않는 영구 팝업 (클릭 시 상세보기 / 고객 등록)
function showCompletionNotification(rec){
  if(!document.getElementById('cnStyles')){
    const s = document.createElement('style'); s.id = 'cnStyles';
    s.textContent = `@keyframes cnSlideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes cnFadeOut{from{opacity:1}to{opacity:0}}.cn-wrap{position:fixed;top:70px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-height:calc(100vh - 90px);overflow-y:auto}.cn-card{pointer-events:auto;background:var(--notify-bg);border-radius:10px;box-shadow:0 6px 24px var(--shadow);width:340px;overflow:hidden;animation:cnSlideIn .35s ease-out;border-left:5px solid var(--success)}.cn-card .cn-hd{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--notify-head);border-bottom:1px solid var(--notify-border);font-weight:700;font-size:14px;color:var(--gray-700)}.cn-card .cn-x{cursor:pointer;font-size:18px;color:var(--gray-400);padding:0 4px;line-height:1}.cn-card .cn-x:hover{color:var(--danger)}.cn-card .cn-bd{padding:10px 14px;font-size:13px;line-height:1.7;color:var(--gray-600)}.cn-card .cn-row{color:var(--gray-600)}.cn-card .cn-ft{padding:6px 14px 10px;display:flex;gap:6px;border-top:1px solid var(--notify-border)}`;
    document.head.appendChild(s);
  }
  let wrap = document.getElementById('cnWrap');
  if(!wrap){ wrap=document.createElement('div'); wrap.id='cnWrap'; wrap.className='cn-wrap'; document.body.appendChild(wrap); }

  const cust = custObj(rec.customer_id) || {};
  const name = cust.name || cust.company_name || '';
  const phone = rec.reception_phone || cust.phone || '';
  const isNew = !name;
  const displayName = name || phone || ('고객'+rec.customer_id);
  const cost = (Number(rec.labor_fee)||0) + (Number(rec.parts_fee)||0);

  const el = document.createElement('div');
  el.className = 'cn-card';
  const lines = [];
  if(phone && name) lines.push('📞 '+esc(phone));
  if(rec.symptom) lines.push('💬 '+esc(rec.symptom));
  if(rec.solution) lines.push('🔧 '+esc(rec.solution));
  if(cost) lines.push('💰 '+cost.toLocaleString('ko-KR')+'원');

  el.innerHTML = `<div class="cn-hd"><span>✅ 작업 완료</span><span class="cn-x">✕</span></div>`
    +`<div class="cn-bd"><div style="font-weight:600;font-size:14px">${esc(displayName)}</div>`
    + lines.map(l=>`<div class="cn-row">${l}</div>`).join('') + `</div>`
    +`<div class="cn-ft"><button class="btn btn-sm">📋 상세보기</button>`
    +(isNew?`<button class="btn btn-sm" style="background:var(--success);color:#fff">➕ 고객 등록</button>`:'')
    +`</div>`;
  wrap.appendChild(el);

  function removeCard(){ el.style.animation='cnFadeOut .3s ease-in forwards'; setTimeout(()=>el.remove(),300); }
  el.querySelector('.cn-x').onclick = removeCard;
  el.querySelectorAll('.cn-ft .btn')[0].onclick = ()=>{ removeCard(); openReceptionDetail(rec.id); };
  const regBtn = el.querySelectorAll('.cn-ft .btn')[1];
  if(regBtn && isNew) regBtn.onclick = ()=>{ removeCard(); openCustomerModal(rec.customer_id); };
}

let _knownCompleted = new Set();
let _completionReady = false;
function initCompletionTracking(){
  (state.receptions||[]).forEach(r=>{ if(r.status==='completed') _knownCompleted.add(r.id); });
  _completionReady = true;
}
function connectSSE(){
  try{
    csepLog('info','SSE','PC SSE 연결 시도');
    const es = new EventSource(API+'/admin-stream?token='+(sessionStorage.getItem('authToken')||''));
    const reloadEvents = ['reception_new','reception_deleted','job_update','engineer_update'];
    reloadEvents.forEach(ev=>es.addEventListener(ev, ()=>loadAll()));

    // 완료 처리: 소리 + 팝업 표시
    es.addEventListener('reception_update', e=>{
      try{
        const rec = JSON.parse(e.data);
        if(rec.status === 'completed' && _completionReady && !_knownCompleted.has(rec.id)){
          _knownCompleted.add(rec.id);
          playNotificationSound();
          showCompletionNotification(rec);
        }
      }catch(x){}
      loadAll();  // 화면 갱신
    });

    es.addEventListener('incoming_call', e=>{ const c=JSON.parse(e.data); pendingCalls.push(c); renderPopups(); });
    es.addEventListener('incoming_sms', e=>{ const s=JSON.parse(e.data); pendingSms.push(s); renderPopups(); });
    es.addEventListener('estimate_import', e=>{
      try{
        const d=JSON.parse(e.data);
        if(d.items&&d.items.length){
          window._pendingEstImport=d;
          if(typeof estState!=='undefined'&&estState&&typeof estAddItems==='function'){
            estAddItems(d.items,'append');
            window._pendingEstImport=null;
            const tp=d.totalPrice;
            showToast('📋 북마클릿: '+d.items.length+'개 항목 가져옴'+(tp?' (업체 판매가 '+Number(tp).toLocaleString()+'원)':''));
          } else {
            showToast('📋 견적 '+d.items.length+'개 부품 수신 — 견적 페이지에서 확인하세요','#1971c2');
          }
        }
      }catch(x){}
    });
    es.addEventListener('new_message', e=>{ let d={}; try{d=JSON.parse(e.data);}catch(x){}
      if(adminChatOpen==d.reception_id){ openAdminChat(d.reception_id); }
      else { adminChatUnread[d.reception_id]=(adminChatUnread[d.reception_id]||0)+1; if(!document.querySelector('.modal-overlay'))renderInto(); }
    });
    es.onerror = ()=>{
      if(es.readyState !== EventSource.CLOSED) return;   // 브라우저가 알아서 재연결 중
      // 토큰이 만료되면 계속 401 → 무한 재연결이 되므로 시도 간격을 늘리고 상한을 둔다
      _sseRetry++;
      if(_sseRetry > 10){ csepLog('warn','SSE','PC SSE 재연결 중단 — 새로고침 필요'); return; }
      const wait = Math.min(30000, 3000 * _sseRetry);
      csepLog('warn','SSE','PC SSE 연결 끊김 — '+(wait/1000)+'초 후 재연결 ('+_sseRetry+'/10)');
      setTimeout(connectSSE, wait);
    };
    es.addEventListener('open', ()=>{ _sseRetry=0; });
  }catch(e){ csepLog('error','SSE','PC SSE 초기화 실패',e.message); }
}
let _sseRetry=0;

// ============================================================
//  초기화
// ============================================================
let _appStarted=false;
function startApp(){
  if(_appStarted) return;   // 로그인 경로가 둘(자동/수동)이라 중복 시작 방지
  _appStarted=true;
  csepLog('info','STARTUP','PC 관리자 앱 시작');
  renderNav();
  loadAll(true);
  // 폴링 주기 완화 — 실시간 갱신은 SSE가 담당한다.
  // 예전: 전체로드 30초 + 팝업 3초 + 채팅 5초 → /dashboard·/stats 풀스캔이 30초마다 반복돼
  // Render 무료 인스턴스에서 부하·비용이 컸음. SSE 이벤트로 즉시 갱신되므로 백업 주기만 남긴다.
  setInterval(()=>{ if(!document.hidden) loadAll(false); }, 120000);
  pollPopups();
  setInterval(()=>{ if(!document.hidden) pollPopups(); }, 15000);
  pollChatUnread();
  setInterval(()=>{ if(!document.hidden) pollChatUnread(); }, 20000);
  // 탭을 다시 볼 때 즉시 최신화 (백그라운드에서 폴링을 쉬는 대신)
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ loadAll(false); pollPopups(); pollChatUnread(); } });
  connectSSE();
}
checkLicense();
