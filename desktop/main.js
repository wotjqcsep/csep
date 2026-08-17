// CSEP PC 버전 — Electron 데스크톱 앱
// - X(닫기) 누르면 트레이로 최소화(계속 실행) → 트레이 메뉴 '종료'로만 진짜 종료
//   (콜 완료·메시지 알림 소리를 백그라운드에서 계속 받기 위함)
// - 설치폴더 하위 jpg 폴더 자동 생성 (거래처별 사진 오프라인 저장 준비)
const { app, BrowserWindow, Tray, Menu, shell, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');

const CSEP_URL = 'https://csep-cf37.onrender.com';   // 온라인 백엔드/관리자 화면

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let win = null;
let tray = null;
app.isQuiting = false;

// 설치폴더(패키지) 또는 개발폴더 기준 jpg 폴더 경로
function baseDir() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
}
function ensureJpgFolder() {
  try {
    const dir = path.join(baseDir(), 'jpg');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (e) { console.error('jpg 폴더 생성 실패:', e.message); return null; }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'CSEP — 컴퓨터 A/S ERP',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });
  win.loadURL(CSEP_URL, { extraHeaders: 'pragma: no-cache\nCache-Control: no-cache' });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(CSEP_URL)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  // X 클릭 → 종료 대신 트레이로 숨김 (앱은 계속 실행)
  win.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); win.hide(); }
  });
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
  tray = new Tray(img);
  tray.setToolTip('CSEP — 실행 중 (알림 대기)');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'CSEP 열기', click: () => { if (win) { win.show(); win.focus(); } } },
    { label: 'jpg 폴더 열기', click: () => { const d = ensureJpgFolder(); if (d) shell.openPath(d); } },
    { type: 'separator' },
    { label: '완전 종료', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  // 트레이 아이콘 클릭/더블클릭 → 창 열기
  tray.on('click', () => { if (win) { win.isVisible() ? win.focus() : win.show(); } });
  tray.on('double-click', () => { if (win) { win.show(); win.focus(); } });
}

// 단일 인스턴스만 실행 (두 번 켜면 기존 창 활성화)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({ storages: ['cachestorage'] });
    ensureJpgFolder();
    createWindow();
    createTray();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  // 모든 창이 닫혀도 트레이로 계속 실행 → quit 안 함 (명시적 종료만)
  app.on('window-all-closed', (e) => { /* 트레이 유지: 아무것도 안 함 */ });
}
