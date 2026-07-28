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
//  ※ 렌더 함수(renderXxx)가 없는 항목은 "준비 중" 빈 페이지로 표시됩니다(메뉴만).
const MENU_CONFIG = [
  { section: '현황', items: [
    { id: 'dashboard', icon: '📊', label: '대시보드' },
  ]},
  { section: '접수 · 현장', items: [
    { id: 'receptions', icon: '📋', label: '작업현황' },
    { id: 'workorders', icon: '🔧', label: '작업지시' },   // 거래처 선택 → 작업지시 전송(배당)
  ]},
  { section: '거래처', items: [
    { id: 'vendors',   icon: '🏢', label: '거래처' },      // 메뉴만(준비 중)
    { id: 'schedule',  icon: '📅', label: '일정표' },      // 메뉴만(준비 중)
  ]},
  { section: '매출 · 정산', items: [
    { id: 'sales',     icon: '📑', label: '판매 관리' },
    { id: 'store',     icon: '🛒', label: '매장 판매' },
    { id: 'payments',  icon: '💳', label: '결산' },
  ]},
  { section: '분석', items: [
    { id: 'stats', icon: '📈', label: '통계' },
  ]},
  { section: '관리', items: [
    { id: 'partsdata', icon: '🧩', label: '부품 데이터', right: true }, // 기사관리 왼쪽(우측정렬 시작)
    { id: 'engineers', icon: '👷', label: '기사 관리', right: true },  // 상단 탭 맨 우측 끝
  ]},
];

// ── 아래는 자동 파생 (건드릴 필요 없음) ──
const MENUS  = MENU_CONFIG.map(s => ({ sec: s.section, items: s.items.map(i => [i.id, i.icon, i.label, i.right]) }));
const TITLES = {};
MENU_CONFIG.forEach(s => s.items.forEach(i => { TITLES[i.id] = i.label; }));

// 페이지 렌더러 레지스트리 (id → renderXxx 함수). app.js 로드 후 채워짐.
function pageRenderer(id) {
  const fn = 'render' + id.charAt(0).toUpperCase() + id.slice(1);
  return typeof window[fn] === 'function' ? window[fn] : null;
}
