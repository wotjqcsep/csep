# CSEP 프로젝트 작업 규칙

## ⚠️ 작업 경로

**이 경로(`E:\Production program\CSEP`)가 CSEP의 유일한 실제 작업 경로입니다.**

- 모든 편집·npm·`npx cap sync`·git·Android Studio 빌드는 여기서 실행합니다.
- 기존 경로 `E:\dev\CSEP`는 **파일만 유지, 사용하지 않습니다** (편집·빌드·커밋 금지).
- 두 경로는 같은 GitHub 원격(`github.com/wotjqcsep/csep.git`)을 공유합니다.

## 구조

- `server/` — Express + pg + SSE + FCM 백엔드
- `admin/` — 관리자 웹 (PC)
- `engineer/` — 기사앱 웹 (index.html 단일 파일). APK가 서버 URL에서 로드.
- `engineer-app/` — Capacitor 안드로이드 앱 래퍼

## 배포 / 빌드

- 서버 배포: main push → Render(`csep-cf37.onrender.com`) 자동 배포.
- **기사앱 웹(JS/HTML) 변경**: 서버 배포만으로 반영 (APK가 서버 URL 로드).
- **네이티브 변경(플러그인·권한·매니페스트)**: APK 재빌드+재설치 필요.
  - Android Studio로 `engineer-app\android` 열기 → Gradle Sync → Build → Build APK(s)
  - 산출물: `engineer-app\android\app\build\outputs\apk\debug\app-debug.apk`
