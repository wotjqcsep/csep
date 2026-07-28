// CSEP PC 버전 — Electron 데스크톱 앱
// 온라인 CSEP(관리자 화면)를 데스크톱 창으로 실행.
// (다음 단계) 설치폴더\jpg\거래처명\ 오프라인 사진 저장 로직을 여기(main 프로세스)에 추가 예정.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const CSEP_URL = 'https://csep-cf37.onrender.com';   // 온라인 백엔드/관리자 화면

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'CSEP — 컴퓨터 A/S ERP',
    autoHideMenuBar: true,                 // 상단 메뉴바 숨김
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(CSEP_URL);
  // 외부 링크(새 창)는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(CSEP_URL)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
