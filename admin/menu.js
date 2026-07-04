// ============================================================
//  메뉴 설정 — ⭐ 여기 한 곳만 고치면 메뉴가 바뀝니다
// ------------------------------------------------------------
//  메뉴 추가 방법:
//   1) 아래 MENU_CONFIG의 원하는 섹션 items 에 { id, icon, label } 한 줄 추가
//   2) app.js 에 render + (id 첫글자 대문자) 형태의 렌더 함수 작성
//      예) id:'vendors' → app.js 에 function renderVendors(){ ... }
//  메뉴 순서변경: 줄 순서만 바꾸면 됨
//  메뉴 삭제: 해당 줄만 지우면 됨
// ============================================================
const MENU_CONFIG = [
  { section: '현황', items: [
    { id: 'dashboard', icon: '📊', label: '대시보드' },
  ]},
  { section: '접수 / 현장', items: [
    { id: 'receptions', icon: '📞', label: '접수 관리' },
    { id: 'engineers',  icon: '🔧', label: '기사 관리' },
  ]},
  { section: '고객', items: [
    { id: 'customers', icon: '👥', label: '고객 관리' },
    { id: 'history',   icon: '📋', label: '수리 이력' },
  ]},
  { section: 'ERP', items: [
    { id: 'sales',     icon: '🛒', label: '판매 관리' },
    { id: 'inventory', icon: '📦', label: '재고 관리' },
    { id: 'payments',  icon: '💳', label: '결제 관리' },
  ]},
  { section: '분석', items: [
    { id: 'stats', icon: '📈', label: '통계' },
  ]},
];

// ── 아래는 자동 파생 (건드릴 필요 없음) ──
const MENUS  = MENU_CONFIG.map(s => ({ sec: s.section, items: s.items.map(i => [i.id, i.icon, i.label]) }));
const TITLES = {};
MENU_CONFIG.forEach(s => s.items.forEach(i => { TITLES[i.id] = i.label; }));

// 페이지 렌더러 레지스트리 (id → renderXxx 함수). app.js 로드 후 채워짐.
function pageRenderer(id) {
  const fn = 'render' + id.charAt(0).toUpperCase() + id.slice(1);
  return typeof window[fn] === 'function' ? window[fn] : null;
}
