# Computer Service ERP Platform (CSEP)

**프로젝트 명칭**: Computer Service ERP Platform  
**약칭**: CSEP  
**시작일**: 2026-06-28  
**상태**: 🔵 기획 단계  
**저장 위치**: `E:\dev\CSEP\`

---

## 📌 프로젝트 소개

컴퓨터 A/S 전문점을 위한 **통합 ERP 플랫폼**입니다.

- **접수** (전화, SMS, 카카오톡, 직접)
- **기사 관리** (배정, 위치 추적, 상태 관리)
- **고객 관리** (CRM, 수리 이력, 판매 이력)
- **컴퓨터 관리** (스펙, 이력, 보증기간)
- **판매/재고** (ERP 기능)
- **통계/대시보드**

**특징:**
- 1인 업체 ~ 다인 조직 모두 지원
- PC + 스마트폰 동시 사용
- 실시간 데이터 동기화

---

## 📂 폴더 구조

```
E:\dev\CSEP\
├── README.md                    # 이 파일
├── CSEP_기획서.md              # 전체 기능 설명
├── 개발계획.md                  # MVP → 단계별 계획
├── DB_설계.md                   # 데이터베이스 테이블 구조
├── 기술스택_선택.md            # 기술 스택 선택 가이드
└── (향후 추가)
    ├── API_명세서.md           # API 엔드포인트 정의
    ├── 아키텍처.md            # 시스템 아키텍처
    └── 배포_가이드.md         # 개발 및 배포 방법
```

---

## 🚀 빠른 시작

### 1단계: 이해하기
1. **CSEP_기획서.md** 읽기 - 전체 기능 이해
2. **개발계획.md** 읽기 - 단계별 개발 계획 이해

### 2단계: 기술 결정
1. **기술스택_선택.md** 읽기 - 각 항목별 선택지 이해
2. 기술 스택 결정 (Backend, Frontend, Mobile, Server 등)
3. 결정 사항을 `CSEP_기획서.md`에 기록

### 3단계: 설계
1. **DB_설계.md**로 데이터베이스 최종 확인
2. API 엔드포인트 설계
3. 아키텍처 다이어그램 작성

### 4단계: 개발
1. 환경 구축
2. Backend API 개발
3. Frontend (PC) 개발
4. Mobile (스마트폰) 개발
5. 통합 & 테스트

---

## 📋 현재 상태

### 결정됨 ✅
- **프로젝트 명칭**: CSEP
- **기획**: 완료 (CSEP_기획서.md)
- **개발 전략**: MVP → 3단계 (개발계획.md)
- **데이터베이스**: PostgreSQL 추천 (DB_설계.md)

### 미결정 ❓
- **Backend**: Python+FastAPI? Node.js? Go? → 추천: **Python+FastAPI**
- **Frontend (PC)**: React? Electron? → 추천: **React**
- **Mobile**: React Native? Flutter? → 추천: **React Native**
- **Server**: Render? Fly.io? Oracle? → 추천: **Render**
- **결제 API**: Portone? Stripe? → 추천: **Portone**
- **SMS API**: Naver? Twilio? → 추천: **Naver Cloud**
- **전화 API**: 아직 조사 필요

**→ 기술스택_선택.md 참고하여 결정하기**

---

## 📚 각 문서의 역할

### CSEP_기획서.md
- **무엇을**: 어떤 기능이 필요한가?
- 접수 시스템, 고객 관리, 기사 관리 등
- 향후 확장 기능

### 개발계획.md
- **언제**: 언제 개발할 것인가?
- MVP (1단계), 확장 (2단계), ERP (3단계)
- 각 단계별 소요 시간

### DB_설계.md
- **어떻게 저장할 것인가?**
- 테이블 구조, 관계도, 주요 쿼리

### 기술스택_선택.md
- **어떤 기술로 만들 것인가?**
- Backend, Frontend, Mobile, Server 선택지
- 각각의 장/단점과 추천

---

## 🎯 현재 해야 할 일

### 이번 주
- [ ] 기술스택_선택.md 읽고 이해하기
- [ ] 각 기술별로 선택 결정하기

### 다음 주
- [ ] API 명세서 작성 (API_명세서.md)
- [ ] 아키텍처 다이어그램 작성
- [ ] 개발 환경 구축

### 이후
- [ ] Backend 개발 시작 (FastAPI)
- [ ] Frontend 개발 시작 (React)
- [ ] Mobile 개발 시작 (React Native)

---

## 🔗 관련 프로젝트

**field-service**와는 **완전히 별개**의 프로젝트입니다.

| 항목 | field-service | CSEP |
|------|--|--|
| **목적** | 임대 기계 서비스 관리 | 컴퓨터 A/S 통합 ERP |
| **사용처** | 내부 (서비스사) | 외부 (A/S 업체) |
| **규모** | 중소규모 | 확장형 (1인~다인) |
| **주 기능** | 임대, 수리, 청구 | 접수, 배정, 판매, ERP |
| **Repository** | GitHub field-service | E:\dev\CSEP |
| **서버** | Render | ? (미정) |

---

## 💡 주요 결정 사항

### MVP 범위 (1단계)

**꼭 필요한 것:**
✅ 접수 시스템 (전화, SMS, 컴닥터)
✅ 기사 배정
✅ 기본 고객관리
✅ PC ↔ 모바일 동기화

**나중에 (2단계):**
⏭️ 컴퓨터 상세 관리
⏭️ 지도 연동
⏭️ 이력 관리

**나중에 (3단계):**
⏭️ ERP (판매, 재고, 매출)
⏭️ 통계/대시보드

---

## 🛠️ 기술 환경 (추천)

```
Backend:
  Language: Python 3.10+
  Framework: FastAPI
  Database: PostgreSQL
  Real-time: WebSocket + Socket.io
  Deployment: Render

Frontend (PC):
  Language: JavaScript (TypeScript)
  Framework: React 18
  Build Tool: Vite
  Styling: Tailwind CSS

Mobile:
  Framework: React Native
  Build: Expo
  Platforms: iOS, Android

APIs & Services:
  Map: Kakao Map, Tmap
  Payment: Portone
  SMS: Naver Cloud Platform
  Phone: (미정)

DevOps:
  Version Control: Git (GitHub or similar)
  CI/CD: GitHub Actions (또는 Render 내장)
  Monitoring: 추후 결정
```

---

## 📞 향후 외부 서비스

1. **전화 수신 API**
   - Twilio 또는 국내 솔루션
   - 자동 번호 인식, 콜 라우팅

2. **SMS API**
   - Naver Cloud Platform
   - 수신 SMS 자동 처리

3. **카카오톡 비즈니스**
   - 공식 채널 운영
   - 자동 응답

4. **지도 API**
   - Kakao Map (기본)
   - Tmap (옵션)
   - Naver Map (향후)

5. **결제 API**
   - Portone (카드, 계좌이체 등)

---

## 📈 개발 로드맵 (추정)

```
2026년 7월 ~ 9월:  MVP 개발 (4개월)
            ↓
2026년 10월 ~ 12월: 실제 업체 운영 및 피드백 (3개월)
            ↓
2026년 12월 ~ 2027년 3월: 2단계 개발 (3개월)
            ↓
2027년 3월 ~ 5월: 2단계 운영 (2개월)
            ↓
2027년 5월 ~ 8월: 3단계 ERP 개발 (3개월)
```

---

## ❓ FAQ

### Q1: field-service와 통합할 건가?
**A:** 아니오. CSEP는 완전히 별개의 프로젝트입니다. field-service는 내부용, CSEP는 외부(A/S 업체)용입니다.

### Q2: 개발 기간은?
**A:** MVP 기준 4개월 (혼자, 주 40시간). 팀이 있으면 2개월 가능.

### Q3: 비용이 얼마나 드나?
**A:** 초기 비용 (서버, API): 약 $20~50/월. 향후 사용량에 따라 증가.

### Q4: 혼자 개발 가능한가?
**A:** 네, 가능합니다. 하지만 3단계까지 1년 이상 소요.

### Q5: 기술 스택을 바꿀 수 있나?
**A:** 네, 언제든지 변경 가능합니다. 하지만 설계 단계에서 결정하는 것이 좋습니다.

---

## 📝 문서 편집 기록

| 날짜 | 내용 | 상태 |
|------|------|------|
| 2026-06-28 | 초기 기획 및 문서 생성 | ✅ 완료 |
| (예정) | 기술 스택 최종 결정 | ⏳ 진행 중 |
| (예정) | API 명세서 작성 | ⏳ 예정 |
| (예정) | 아키텍처 설계 | ⏳ 예정 |
| (예정) | 개발 시작 | ⏳ 예정 |

---

## 🤝 기여 및 피드백

이 프로젝트는 개인 프로젝트입니다. 

- 피드백, 아이디어: E:\dev\CSEP\ 내 .md 파일 수정
- 기술 관련 질문: Claude Code와 상담

---

**마지막 업데이트**: 2026-06-28  
**상태**: 🔵 기획 단계  
**다음 단계**: 기술 스택 최종 결정

