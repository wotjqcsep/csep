# CSEP 데이터베이스 설계

---

## 주요 테이블 구조

### 1. users (사용자)

```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'engineer', 'customer'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 2. customers (고객)

```sql
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    phone2 VARCHAR(20), -- 보조 전화
    email VARCHAR(255),
    address VARCHAR(500),
    address_detail VARCHAR(500),
    memo TEXT,
    outstanding_amount DECIMAL(10,2) DEFAULT 0, -- 미수금
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 3. computers (컴퓨터/장비)

```sql
CREATE TABLE computers (
    computer_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    name VARCHAR(100), -- "회사 데스크톱", "가정용 노트북" 등
    
    -- 하드웨어
    cpu VARCHAR(100),
    ram VARCHAR(100),
    ssd VARCHAR(100),
    hdd VARCHAR(100),
    motherboard VARCHAR(100),
    gpu VARCHAR(100),
    
    -- 운영체제 및 소프트웨어
    os VARCHAR(100),
    os_version VARCHAR(100),
    office_installed BOOLEAN DEFAULT FALSE,
    office_version VARCHAR(50),
    antivirus VARCHAR(100),
    
    -- 네트워크
    ip_address VARCHAR(50),
    mac_address VARCHAR(50),
    
    -- 기타
    serial_number VARCHAR(100),
    assembled BOOLEAN DEFAULT FALSE, -- 조립 여부
    purchase_date DATE,
    warranty_expiry DATE,
    
    -- 프린터, 모니터 등
    printer VARCHAR(100),
    monitor VARCHAR(100),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 4. receptions (접수)

```sql
CREATE TABLE receptions (
    reception_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(customer_id),
    computer_id INT REFERENCES computers(computer_id),
    
    -- 접수 정보
    reception_channel VARCHAR(50) NOT NULL, -- 'phone', 'sms', 'kakao', 'direct'
    reception_phone VARCHAR(20), -- 통화 번호 또는 SMS 발신 번호
    received_at TIMESTAMP DEFAULT NOW(),
    
    -- 내용
    symptom TEXT, -- 고장 증상
    initial_memo TEXT, -- 초기 상담 메모
    
    -- 상태
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'assigned', 'in_progress', 'completed', 'cancelled'
    
    -- 배정 정보
    assigned_engineer_id INT REFERENCES users(user_id),
    assigned_at TIMESTAMP,
    
    -- 결과
    completed_at TIMESTAMP,
    solution TEXT, -- 해결 방법
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 5. jobs (작업/서비스)

```sql
CREATE TABLE jobs (
    job_id SERIAL PRIMARY KEY,
    reception_id INT NOT NULL REFERENCES receptions(reception_id) ON DELETE CASCADE,
    engineer_id INT NOT NULL REFERENCES users(user_id),
    
    -- 일정
    scheduled_date DATE,
    scheduled_time TIME,
    
    -- 작업 상태
    status VARCHAR(50) DEFAULT 'assigned', -- 'assigned', 'on_the_way', 'working', 'completed'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- 작업 내용
    work_description TEXT,
    parts_used TEXT,
    cost_parts DECIMAL(10,2) DEFAULT 0, -- 부품 비용
    cost_labor DECIMAL(10,2) DEFAULT 0, -- 공임
    total_cost DECIMAL(10,2) DEFAULT 0,
    
    -- 고객 만족도 (나중)
    satisfaction_score INT, -- 1~5
    feedback TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 6. engineers (기사/엔지니어)

```sql
CREATE TABLE engineers (
    engineer_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- 상태
    current_status VARCHAR(50) DEFAULT 'idle', -- 'idle', 'on_the_way', 'working', 'off_duty'
    
    -- 위치 (실시간 업데이트)
    last_latitude DECIMAL(10,8),
    last_longitude DECIMAL(10,8),
    last_location_update TIMESTAMP,
    
    -- 누적 실적
    total_jobs INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 7. sales (판매)

```sql
CREATE TABLE sales (
    sale_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(customer_id),
    engineer_id INT REFERENCES users(user_id), -- 판매자
    
    -- 항목
    item_type VARCHAR(50), -- 'computer', 'part', 'service'
    item_name VARCHAR(100),
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    
    -- 거래
    sale_date DATE,
    payment_method VARCHAR(50), -- 'cash', 'transfer', 'card', 'credit'
    paid BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 8. inventory (재고)

```sql
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    
    -- 부품 정보
    part_name VARCHAR(100) NOT NULL,
    part_code VARCHAR(50),
    category VARCHAR(100), -- 'cpu', 'ram', 'ssd', 'hdd', 'power', 'monitor' 등
    
    -- 수량
    quantity INT DEFAULT 0,
    reorder_level INT DEFAULT 5, -- 재주문 수준
    
    -- 비용
    unit_cost DECIMAL(10,2),
    unit_price DECIMAL(10,2),
    
    -- 공급처
    supplier VARCHAR(100),
    supplier_phone VARCHAR(20),
    
    -- 창고 위치
    location VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 9. payments (결제)

```sql
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(job_id),
    sale_id INT REFERENCES sales(sale_id),
    
    -- 결제 정보
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50), -- 'cash', 'transfer', 'card', 'credit'
    payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    paid_at TIMESTAMP,
    
    -- 신용
    due_date DATE, -- 외상의 경우 납기일
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 10. schedules (일정)

```sql
CREATE TABLE schedules (
    schedule_id SERIAL PRIMARY KEY,
    engineer_id INT NOT NULL REFERENCES users(user_id),
    customer_id INT REFERENCES customers(customer_id),
    job_id INT REFERENCES jobs(job_id),
    
    -- 일정
    scheduled_date DATE,
    scheduled_time TIME,
    title VARCHAR(255),
    description TEXT,
    
    -- 상태
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 11. photos (사진)

```sql
CREATE TABLE photos (
    photo_id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(job_id) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(customer_id) ON DELETE CASCADE,
    
    -- 사진
    file_path VARCHAR(500),
    file_url VARCHAR(500), -- 클라우드 URL
    description TEXT,
    
    -- 메타데이터
    taken_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 12. memos (메모)

```sql
CREATE TABLE memos (
    memo_id SERIAL PRIMARY KEY,
    
    -- 관련 정보
    customer_id INT REFERENCES customers(customer_id) ON DELETE CASCADE,
    job_id INT REFERENCES jobs(job_id) ON DELETE CASCADE,
    reception_id INT REFERENCES receptions(reception_id) ON DELETE CASCADE,
    
    -- 메모 내용
    content TEXT NOT NULL,
    created_by INT NOT NULL REFERENCES users(user_id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 13. logs (로그)

```sql
CREATE TABLE logs (
    log_id SERIAL PRIMARY KEY,
    
    -- 사용자/액션
    user_id INT REFERENCES users(user_id),
    action VARCHAR(100), -- 'create', 'update', 'delete', 'login'
    table_name VARCHAR(100),
    record_id INT,
    
    -- 상세
    details TEXT,
    ip_address VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 14. companies (협력업체/컴닥터)

```sql
CREATE TABLE companies (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address VARCHAR(500),
    
    -- 특정 번호로 인식
    reception_phone VARCHAR(20), -- 접수 전화번호 (자동 인식용)
    
    -- 담당자
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    
    status VARCHAR(50) DEFAULT 'active',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 15. company_receptions (협력업체 접수)

```sql
CREATE TABLE company_receptions (
    reception_id INT PRIMARY KEY REFERENCES receptions(reception_id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(company_id),
    
    -- 협력업체가 보낸 문자 정보
    sms_content TEXT,
    sms_sent_at TIMESTAMP,
    
    -- 담당 기사 배정
    assigned_engineer_id INT REFERENCES users(user_id),
    assigned_at TIMESTAMP
);
```

---

## 데이터 관계도

```
┌─────────────┐
│   users     │ (사용자: 관리자, 기사, 고객)
└──────┬──────┘
       │
       ├─────── engineers (기사 추가 정보)
       │
       ├─────── jobs (작업 배정)
       │
       ├─────── logs (사용자 액션)
       │
       └─────── schedules (일정)


┌─────────────┐
│ customers   │ (고객)
└──────┬──────┘
       │
       ├─────── computers (고객 컴퓨터)
       │            │
       │            └─ receptions (접수)
       │                 │
       │                 └─ jobs (작업)
       │                      │
       │                      ├─ payments (결제)
       │                      ├─ photos (사진)
       │                      └─ memos (메모)
       │
       ├─────── sales (판매 이력)
       │
       ├─────── payments (미수금)
       │
       ├─────── memos (메모)
       │
       └─────── photos (사진)


┌─────────────┐
│  companies  │ (협력업체)
└──────┬──────┘
       │
       └─── company_receptions (협력업체 접수)
             │
             └─── receptions (접수)


┌─────────────┐
│  inventory  │ (재고)
└─────────────┘
       │
       └─── sales (판매 시 연동)
```

---

## 주요 쿼리 예시

### 고객의 모든 접수 조회
```sql
SELECT r.reception_id, r.symptom, r.status, j.completed_at
FROM receptions r
LEFT JOIN jobs j ON r.reception_id = j.reception_id
WHERE r.customer_id = ?
ORDER BY r.received_at DESC;
```

### 오늘의 배정되지 않은 접수
```sql
SELECT r.reception_id, c.name, r.symptom
FROM receptions r
JOIN customers c ON r.customer_id = c.customer_id
WHERE r.status = 'new'
AND DATE(r.received_at) = CURRENT_DATE;
```

### 기사별 오늘의 작업
```sql
SELECT j.job_id, r.customer_id, c.name, j.status, j.started_at
FROM jobs j
JOIN receptions r ON j.reception_id = r.reception_id
JOIN customers c ON r.customer_id = c.customer_id
WHERE j.engineer_id = ?
AND DATE(j.scheduled_date) = CURRENT_DATE
ORDER BY j.scheduled_time;
```

### 월간 매출
```sql
SELECT 
    DATE_TRUNC('month', j.completed_at) as month,
    SUM(j.total_cost) as monthly_revenue
FROM jobs j
WHERE j.status = 'completed'
GROUP BY DATE_TRUNC('month', j.completed_at)
ORDER BY month DESC;
```

### 미수금 조회
```sql
SELECT c.customer_id, c.name, SUM(p.amount) as outstanding
FROM customers c
LEFT JOIN payments p ON c.customer_id = c.customer_id
WHERE p.payment_status = 'pending'
GROUP BY c.customer_id, c.name
HAVING SUM(p.amount) > 0;
```

---

## 인덱스 (성능 최적화)

```sql
-- 검색 성능
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_receptions_customer ON receptions(customer_id);
CREATE INDEX idx_receptions_status ON receptions(status);
CREATE INDEX idx_receptions_date ON receptions(received_at);
CREATE INDEX idx_jobs_engineer ON jobs(engineer_id);
CREATE INDEX idx_jobs_date ON jobs(scheduled_date);

-- 실시간 동기화
CREATE INDEX idx_jobs_updated ON jobs(updated_at);
CREATE INDEX idx_receptions_updated ON receptions(updated_at);
```

---

## 향후 추가 고려 사항

1. **사진 저장소**: 로컬 파일/클라우드 (AWS S3, GCP 등)
2. **백업**: 일일 자동 백업
3. **다중 사이트**: 향후 여러 지점 운영 시 site_id 추가
4. **결제 히스토리**: 외상 추적을 위해 상세 히스토리 필요
5. **감사 로그**: 민감한 데이터 변경 추적
