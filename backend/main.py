from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

app = FastAPI(title="CSEP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 더미 데이터 =====

customers_db = [
    {"id": 1, "name": "이찬호", "customer_type": "personal", "company_name": None, "contact_person": None, "phone": "01012341234", "phone2": None, "email": None, "address": "강남구 강남대로 123", "address_detail": "101호", "memo": "VIP 고객", "outstanding_amount": 50000, "created_at": "2026-01-10T09:00:00"},
    {"id": 2, "name": "강민지", "customer_type": "personal", "company_name": None, "contact_person": None, "phone": "01056785678", "phone2": "01099990000", "email": "kang@example.com", "address": "서초구 서초동 456", "address_detail": None, "memo": None, "outstanding_amount": 0, "created_at": "2026-02-15T14:30:00"},
    {"id": 3, "name": "박지훈", "customer_type": "business", "company_name": "박지훈 사무소", "contact_person": "박지훈", "phone": "01011112222", "phone2": None, "email": None, "address": "마포구 홍대입구 789", "address_detail": "3층", "memo": "소기업 사장님", "outstanding_amount": 120000, "created_at": "2026-03-20T10:00:00"},
    {"id": 4, "name": "김수진", "customer_type": "business", "company_name": "(주)수진테크", "contact_person": "김수진", "phone": "01033334444", "phone2": None, "email": "kim@email.com", "address": "송파구 잠실동 321", "address_detail": None, "memo": None, "outstanding_amount": 0, "created_at": "2026-04-05T16:00:00"},
]
customers_counter = [5]

computers_db = [
    {"id": 1, "customer_id": 1, "name": "사무용 데스크톱", "device_type": "desktop", "cpu": "Intel i5-10400", "ram": "16GB DDR4", "ssd": "Samsung 500GB", "hdd": "WD 1TB", "motherboard": "ASUS B460", "gpu": None, "os": "Windows 11", "os_version": "22H2", "office_installed": True, "office_version": "Office 2021", "antivirus": "V3", "ip_address": "192.168.1.100", "mac_address": "AA:BB:CC:DD:EE:FF", "serial_number": "SN20240101", "assembled": True, "purchase_date": "2024-01-15", "warranty_expiry": "2027-01-15", "printer": "HP LaserJet", "monitor": "삼성 24인치", "notes": None, "created_at": "2026-01-10T09:10:00"},
    {"id": 2, "customer_id": 1, "name": "가정용 노트북", "device_type": "laptop", "cpu": "Intel i3-1115G4", "ram": "8GB DDR4", "ssd": "256GB", "hdd": None, "motherboard": None, "gpu": None, "os": "Windows 10", "os_version": "21H2", "office_installed": False, "office_version": None, "antivirus": "Windows Defender", "ip_address": None, "mac_address": None, "serial_number": "NB20230815", "assembled": False, "purchase_date": "2023-08-15", "warranty_expiry": "2025-08-15", "printer": None, "monitor": None, "notes": "삼성 갤럭시북", "created_at": "2026-01-10T09:15:00"},
    {"id": 3, "customer_id": 2, "name": "회사 서버", "device_type": "server", "cpu": "Intel Xeon E-2278G", "ram": "32GB ECC", "ssd": "512GB NVMe", "hdd": "4TB x2", "motherboard": "Supermicro", "gpu": None, "os": "Windows Server 2022", "os_version": None, "office_installed": False, "office_version": None, "antivirus": "ESET", "ip_address": "192.168.0.10", "mac_address": "11:22:33:44:55:66", "serial_number": "SRV2024", "assembled": True, "purchase_date": "2024-03-01", "warranty_expiry": "2027-03-01", "printer": None, "monitor": None, "notes": "NAS 겸용", "created_at": "2026-02-15T14:40:00"},
    {"id": 4, "customer_id": 3, "name": "카운터 PC", "device_type": "desktop", "cpu": "AMD Ryzen 5 5600", "ram": "16GB DDR4", "ssd": "500GB", "hdd": None, "motherboard": "MSI B550", "gpu": "GTX 1650", "os": "Windows 11", "os_version": "23H2", "office_installed": True, "office_version": "Office 365", "antivirus": "알약", "ip_address": "10.0.0.5", "mac_address": "FF:EE:DD:CC:BB:AA", "serial_number": "PC2023Q4", "assembled": True, "purchase_date": "2023-12-01", "warranty_expiry": "2026-12-01", "printer": "브라더 레이저", "monitor": "LG 27인치 x2", "notes": None, "created_at": "2026-03-20T10:10:00"},
    {"id": 5, "customer_id": 4, "name": "사무실 NAS", "device_type": "nas", "cpu": None, "ram": "4GB", "ssd": None, "hdd": "4TB x4", "motherboard": None, "gpu": None, "os": "Synology DSM 7", "os_version": "7.2", "office_installed": False, "office_version": None, "antivirus": None, "ip_address": "192.168.1.200", "mac_address": None, "serial_number": "NAS2025", "assembled": False, "purchase_date": "2025-03-01", "warranty_expiry": "2028-03-01", "power": None, "printer": None, "monitor": None, "notes": "Synology DS923+", "created_at": "2026-04-05T16:10:00"},
]
computers_counter = [6]

engineers_db = [
    {"id": 1, "name": "이기사", "phone": "01001001000", "status": "working", "location": "강남구", "total_jobs": 142, "total_revenue": 4200000, "created_at": "2025-01-01"},
    {"id": 2, "name": "박기사", "phone": "01002002000", "status": "idle", "location": "서초구", "total_jobs": 98, "total_revenue": 2850000, "created_at": "2025-03-01"},
    {"id": 3, "name": "최기사", "phone": "01003003000", "status": "on_the_way", "location": "강동구", "total_jobs": 67, "total_revenue": 1950000, "created_at": "2025-06-01"},
]
engineers_counter = [4]

receptions_db = [
    {"id": 1, "customer_id": 1, "computer_id": 1, "reception_channel": "phone", "reception_phone": "01012341234", "symptom": "노트북 모니터 검은색", "initial_memo": "전원은 켜지나 화면 안 나옴", "status": "completed", "assigned_engineer_id": 1, "assigned_at": "2026-06-20T10:00:00", "completed_at": "2026-06-20T14:00:00", "solution": "LVDS 케이블 교체", "received_at": "2026-06-20T09:00:00"},
    {"id": 2, "customer_id": 2, "computer_id": None, "reception_channel": "sms", "reception_phone": "01056785678", "symptom": "데스크톱 느린 속도", "initial_memo": None, "status": "in_progress", "assigned_engineer_id": 1, "assigned_at": "2026-06-27T11:00:00", "completed_at": None, "solution": None, "received_at": "2026-06-27T10:30:00"},
    {"id": 3, "customer_id": 3, "computer_id": 4, "reception_channel": "phone", "reception_phone": "01011112222", "symptom": "전원이 안 켜짐", "initial_memo": "어제부터 갑자기", "status": "assigned", "assigned_engineer_id": 2, "assigned_at": "2026-06-28T09:30:00", "completed_at": None, "solution": None, "received_at": "2026-06-28T09:00:00"},
    {"id": 4, "customer_id": 4, "computer_id": None, "reception_channel": "direct", "reception_phone": None, "symptom": "바이러스 감염 의심", "initial_memo": "팝업 광고 계속 뜸", "status": "new", "assigned_engineer_id": None, "assigned_at": None, "completed_at": None, "solution": None, "received_at": "2026-06-28T10:00:00"},
]
receptions_counter = [5]

jobs_db = [
    {"id": 1, "reception_id": 1, "engineer_id": 1, "scheduled_date": "2026-06-20", "status": "completed", "started_at": "2026-06-20T10:30:00", "completed_at": "2026-06-20T14:00:00", "work_description": "LVDS 케이블 불량으로 교체 완료", "parts_used": "LVDS 케이블 1개", "cost_parts": 15000, "cost_labor": 30000, "total_cost": 45000, "created_at": "2026-06-20T10:00:00"},
    {"id": 2, "reception_id": 2, "engineer_id": 1, "scheduled_date": "2026-06-27", "status": "working", "started_at": "2026-06-27T11:15:00", "completed_at": None, "work_description": None, "parts_used": None, "cost_parts": 0, "cost_labor": 0, "total_cost": 0, "created_at": "2026-06-27T10:30:00"},
    {"id": 3, "reception_id": 3, "engineer_id": 2, "scheduled_date": "2026-06-28", "status": "assigned", "started_at": None, "completed_at": None, "work_description": None, "parts_used": None, "cost_parts": 0, "cost_labor": 0, "total_cost": 0, "created_at": "2026-06-28T09:30:00"},
]
jobs_counter = [4]

sales_db = [
    {"id": 1, "customer_id": 1, "engineer_id": 1, "item_type": "computer", "item_name": "조립 PC (i5-10400)", "quantity": 1, "unit_price": 850000, "total_price": 850000, "sale_date": "2024-01-15", "payment_method": "card", "paid": True, "created_at": "2024-01-15T14:00:00"},
    {"id": 2, "customer_id": 3, "engineer_id": 2, "item_type": "part", "item_name": "삼성 SSD 500GB", "quantity": 2, "unit_price": 75000, "total_price": 150000, "sale_date": "2026-06-15", "payment_method": "cash", "paid": True, "created_at": "2026-06-15T11:00:00"},
    {"id": 3, "customer_id": 4, "engineer_id": 1, "item_type": "service", "item_name": "바이러스 치료 및 최적화", "quantity": 1, "unit_price": 50000, "total_price": 50000, "sale_date": "2026-06-10", "payment_method": "transfer", "paid": True, "created_at": "2026-06-10T15:00:00"},
    {"id": 4, "customer_id": 2, "engineer_id": None, "item_type": "part", "item_name": "DDR4 16GB RAM", "quantity": 1, "unit_price": 45000, "total_price": 45000, "sale_date": "2026-06-20", "payment_method": "credit", "paid": False, "created_at": "2026-06-20T13:00:00"},
]
sales_counter = [5]

inventory_db = [
    {"id": 1, "part_name": "삼성 SSD 500GB", "part_code": "SSD-SAM-500", "category": "ssd", "quantity": 5, "reorder_level": 3, "unit_cost": 55000, "unit_price": 75000, "supplier": "삼성전자", "supplier_phone": "02-1234-5678", "location": "선반 A-1", "created_at": "2026-01-01"},
    {"id": 2, "part_name": "SK하이닉스 DDR4 16GB", "part_code": "RAM-SKH-16", "category": "ram", "quantity": 3, "reorder_level": 5, "unit_cost": 35000, "unit_price": 45000, "supplier": "SK하이닉스", "supplier_phone": "031-111-2222", "location": "선반 A-2", "created_at": "2026-01-01"},
    {"id": 3, "part_name": "Intel Core i5-12400", "part_code": "CPU-INT-I5-12400", "category": "cpu", "quantity": 2, "reorder_level": 2, "unit_cost": 180000, "unit_price": 230000, "supplier": "인텔코리아", "supplier_phone": "02-2222-3333", "location": "선반 B-1", "created_at": "2026-01-01"},
    {"id": 4, "part_name": "WD HDD 1TB", "part_code": "HDD-WD-1T", "category": "hdd", "quantity": 8, "reorder_level": 3, "unit_cost": 40000, "unit_price": 58000, "supplier": "WD코리아", "supplier_phone": "02-3333-4444", "location": "선반 B-2", "created_at": "2026-01-01"},
    {"id": 5, "part_name": "LVDS 케이블 (일반)", "part_code": "CABLE-LVDS-G", "category": "cable", "quantity": 1, "reorder_level": 5, "unit_cost": 8000, "unit_price": 15000, "supplier": "부품상가", "supplier_phone": "02-4444-5555", "location": "서랍 C-1", "created_at": "2026-01-01"},
    {"id": 6, "part_name": "AMD Ryzen 5 5600", "part_code": "CPU-AMD-R5-5600", "category": "cpu", "quantity": 0, "reorder_level": 2, "unit_cost": 150000, "unit_price": 200000, "supplier": "AMD코리아", "supplier_phone": "02-5555-6666", "location": "선반 B-3", "created_at": "2026-02-01"},
]
inventory_counter = [7]

payments_db = [
    {"id": 1, "job_id": 1, "sale_id": None, "amount": 45000, "payment_method": "card", "payment_status": "completed", "paid_at": "2026-06-20T14:30:00", "due_date": None, "created_at": "2026-06-20T14:00:00"},
    {"id": 2, "job_id": None, "sale_id": 1, "amount": 850000, "payment_method": "card", "payment_status": "completed", "paid_at": "2024-01-15T14:30:00", "due_date": None, "created_at": "2024-01-15T14:00:00"},
    {"id": 3, "job_id": None, "sale_id": 2, "amount": 150000, "payment_method": "cash", "payment_status": "completed", "paid_at": "2026-06-15T11:30:00", "due_date": None, "created_at": "2026-06-15T11:00:00"},
    {"id": 4, "job_id": None, "sale_id": 3, "amount": 50000, "payment_method": "transfer", "payment_status": "completed", "paid_at": "2026-06-10T15:30:00", "due_date": None, "created_at": "2026-06-10T15:00:00"},
    {"id": 5, "job_id": None, "sale_id": 4, "amount": 45000, "payment_method": "credit", "payment_status": "pending", "paid_at": None, "due_date": "2026-07-20", "created_at": "2026-06-20T13:00:00"},
]
payments_counter = [6]

network_devices_db = [
    {"id": 1, "customer_id": 2, "device_type": "nas", "name": "사무실 NAS", "model": "Synology DS923+", "ip_address": "192.168.1.200", "hdd_count": 4, "hdd_detail": "WD Red 4TB x4", "total_capacity": "16TB", "partition_info": "볼륨1: 12TB (RAID5), 볼륨2: 2TB", "maintenance_period": "6개월", "maintenance_notes": "HDD 상태 점검, 펌웨어 업데이트", "admin_id": "admin", "admin_password": "synology1234", "notes": None, "created_at": "2026-02-15T14:50:00"},
    {"id": 2, "customer_id": 3, "device_type": "router", "name": "사무실 공유기", "model": "ipTIME A3004NS", "ip_address": "192.168.0.1", "hdd_count": None, "hdd_detail": None, "total_capacity": None, "partition_info": None, "maintenance_period": None, "maintenance_notes": None, "admin_id": "admin", "admin_password": "admin1234", "notes": "2.4GHz + 5GHz 듀얼밴드", "created_at": "2026-03-20T10:20:00"},
]
network_devices_counter = [3]

# 수신 전화 대기열 (Android 앱이 POST → PC가 폴링으로 읽음)
incoming_calls_db = []
incoming_calls_counter = [1]

# 수신 SMS 대기열 (Android 앱이 POST → PC가 폴링으로 읽음)
incoming_sms_db = []
incoming_sms_counter = [1]


# ===== Pydantic 모델 =====

class CustomerCreate(BaseModel):
    name: str
    phone: str
    customer_type: str = "personal"  # personal, business
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone2: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    address_detail: Optional[str] = None
    memo: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    customer_type: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone2: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    address_detail: Optional[str] = None
    memo: Optional[str] = None
    outstanding_amount: Optional[float] = None

class ComputerCreate(BaseModel):
    customer_id: int
    name: Optional[str] = None
    cpu: Optional[str] = None
    ram: Optional[str] = None
    ssd: Optional[str] = None
    hdd: Optional[str] = None
    motherboard: Optional[str] = None
    gpu: Optional[str] = None
    os: Optional[str] = None
    os_version: Optional[str] = None
    office_installed: Optional[bool] = False
    office_version: Optional[str] = None
    antivirus: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    serial_number: Optional[str] = None
    assembled: Optional[bool] = False
    purchase_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    device_type: Optional[str] = "desktop"
    power: Optional[str] = None
    printer: Optional[str] = None
    monitor: Optional[str] = None
    # NAS 정보
    nas_name: Optional[str] = None
    nas_model: Optional[str] = None
    nas_ip: Optional[str] = None
    nas_hdd_count: Optional[int] = None
    nas_hdd_detail: Optional[str] = None
    nas_total_capacity: Optional[str] = None
    nas_partition_info: Optional[str] = None
    nas_maintenance_period: Optional[str] = None
    nas_maintenance_notes: Optional[str] = None
    nas_admin_id: Optional[str] = None
    nas_admin_password: Optional[str] = None
    # 공유기 정보
    router_name: Optional[str] = None
    router_model: Optional[str] = None
    router_ip: Optional[str] = None
    router_admin_id: Optional[str] = None
    router_admin_password: Optional[str] = None
    notes: Optional[str] = None

class EngineerCreate(BaseModel):
    name: str
    phone: str

class ReceptionCreate(BaseModel):
    customer_id: int
    symptom: str
    reception_channel: str
    computer_id: Optional[int] = None
    reception_phone: Optional[str] = None
    initial_memo: Optional[str] = None

class JobUpdate(BaseModel):
    work_description: Optional[str] = None
    parts_used: Optional[str] = None
    cost_parts: Optional[float] = None
    cost_labor: Optional[float] = None
    total_cost: Optional[float] = None
    status: Optional[str] = None

class SaleCreate(BaseModel):
    customer_id: int
    item_type: str
    item_name: str
    quantity: int
    unit_price: float
    total_price: float
    sale_date: str
    payment_method: str
    engineer_id: Optional[int] = None

class InventoryCreate(BaseModel):
    part_name: str
    part_code: Optional[str] = None
    category: Optional[str] = None
    quantity: int = 0
    reorder_level: int = 5
    unit_cost: Optional[float] = None
    unit_price: Optional[float] = None
    supplier: Optional[str] = None
    supplier_phone: Optional[str] = None
    location: Optional[str] = None

class InventoryUpdate(BaseModel):
    part_name: Optional[str] = None
    part_code: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    reorder_level: Optional[int] = None
    unit_cost: Optional[float] = None
    unit_price: Optional[float] = None
    supplier: Optional[str] = None
    supplier_phone: Optional[str] = None
    location: Optional[str] = None

class NetworkDeviceCreate(BaseModel):
    customer_id: int
    device_type: str  # nas, router, switch, ap, other
    name: str
    model: Optional[str] = None
    ip_address: Optional[str] = None
    # NAS 전용
    hdd_count: Optional[int] = None
    hdd_detail: Optional[str] = None
    total_capacity: Optional[str] = None
    partition_info: Optional[str] = None
    maintenance_period: Optional[str] = None
    maintenance_notes: Optional[str] = None
    # 공통 인증
    admin_id: Optional[str] = None
    admin_password: Optional[str] = None
    notes: Optional[str] = None

class SmsReceived(BaseModel):
    phone: str
    message: str
    received_at: str

class PaymentCreate(BaseModel):
    job_id: Optional[int] = None
    sale_id: Optional[int] = None
    amount: float
    payment_method: str
    due_date: Optional[str] = None


# ===== 고객 관리 =====

@app.get("/api/customers")
def get_customers(search: Optional[str] = None):
    if search:
        s = search.lower()
        return [c for c in customers_db if s in c["name"].lower() or (c["phone"] and s in c["phone"])]
    return customers_db

@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: int):
    c = next((c for c in customers_db if c["id"] == customer_id), None)
    if not c:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return c

@app.post("/api/customers")
def create_customer(body: CustomerCreate):
    new = {**body.model_dump(), "id": customers_counter[0], "outstanding_amount": 0, "created_at": datetime.now().isoformat()}
    customers_db.append(new)
    customers_counter[0] += 1
    return new

@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, body: CustomerUpdate):
    c = next((c for c in customers_db if c["id"] == customer_id), None)
    if not c:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    for k, v in body.model_dump(exclude_none=True).items():
        c[k] = v
    return c

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    idx = next((i for i, c in enumerate(customers_db) if c["id"] == customer_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    customers_db.pop(idx)
    return {"ok": True}

@app.get("/api/customers/{customer_id}/computers")
def get_customer_computers(customer_id: int):
    return [c for c in computers_db if c["customer_id"] == customer_id]

@app.get("/api/customers/{customer_id}/receptions")
def get_customer_receptions(customer_id: int):
    return [r for r in receptions_db if r["customer_id"] == customer_id]


# ===== 컴퓨터 관리 =====

@app.get("/api/computers")
def get_computers(customer_id: Optional[int] = None):
    if customer_id:
        return [c for c in computers_db if c["customer_id"] == customer_id]
    return computers_db

@app.get("/api/computers/{computer_id}")
def get_computer(computer_id: int):
    c = next((c for c in computers_db if c["id"] == computer_id), None)
    if not c:
        raise HTTPException(status_code=404, detail="컴퓨터를 찾을 수 없습니다")
    return c

@app.post("/api/computers")
def create_computer(body: ComputerCreate):
    new = {**body.model_dump(), "id": computers_counter[0], "created_at": datetime.now().isoformat()}
    computers_db.append(new)
    computers_counter[0] += 1
    return new

@app.put("/api/computers/{computer_id}")
def update_computer(computer_id: int, body: ComputerCreate):
    c = next((c for c in computers_db if c["id"] == computer_id), None)
    if not c:
        raise HTTPException(status_code=404, detail="컴퓨터를 찾을 수 없습니다")
    for k, v in body.model_dump(exclude_none=True).items():
        c[k] = v
    return c

@app.delete("/api/computers/{computer_id}")
def delete_computer(computer_id: int):
    idx = next((i for i, c in enumerate(computers_db) if c["id"] == computer_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="컴퓨터를 찾을 수 없습니다")
    computers_db.pop(idx)
    return {"ok": True}


# ===== 기사 관리 =====

@app.get("/api/engineers")
def get_engineers():
    return engineers_db

@app.get("/api/engineers/{engineer_id}")
def get_engineer(engineer_id: int):
    e = next((e for e in engineers_db if e["id"] == engineer_id), None)
    if not e:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return e

@app.post("/api/engineers")
def create_engineer(body: EngineerCreate):
    new = {**body.model_dump(), "id": engineers_counter[0], "status": "idle", "location": None, "total_jobs": 0, "total_revenue": 0, "created_at": datetime.now().isoformat()}
    engineers_db.append(new)
    engineers_counter[0] += 1
    return new

@app.put("/api/engineers/{engineer_id}/status")
def update_engineer_status(engineer_id: int, status: str):
    e = next((e for e in engineers_db if e["id"] == engineer_id), None)
    if not e:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    e["status"] = status
    return e

@app.put("/api/engineers/{engineer_id}/location")
def update_engineer_location(engineer_id: int, location: str):
    e = next((e for e in engineers_db if e["id"] == engineer_id), None)
    if not e:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    e["location"] = location
    return e

@app.delete("/api/engineers/{engineer_id}")
def delete_engineer(engineer_id: int):
    idx = next((i for i, e in enumerate(engineers_db) if e["id"] == engineer_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    engineers_db.pop(idx)
    return {"ok": True}


# ===== 접수 관리 =====

@app.get("/api/receptions")
def get_receptions(status: Optional[str] = None):
    if status:
        return [r for r in receptions_db if r["status"] == status]
    return receptions_db

@app.get("/api/receptions/{reception_id}")
def get_reception(reception_id: int):
    r = next((r for r in receptions_db if r["id"] == reception_id), None)
    if not r:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    return r

@app.post("/api/receptions")
def create_reception(body: ReceptionCreate):
    new = {**body.model_dump(), "id": receptions_counter[0], "status": "new", "assigned_engineer_id": None, "assigned_at": None, "completed_at": None, "solution": None, "received_at": datetime.now().isoformat()}
    receptions_db.append(new)
    receptions_counter[0] += 1
    return new

@app.put("/api/receptions/{reception_id}/assign")
def assign_reception(reception_id: int, engineer_id: int):
    r = next((r for r in receptions_db if r["id"] == reception_id), None)
    if not r:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    r["assigned_engineer_id"] = engineer_id
    r["status"] = "assigned"
    r["assigned_at"] = datetime.now().isoformat()
    return r

@app.put("/api/receptions/{reception_id}/status")
def update_reception_status(reception_id: int, status: str):
    r = next((r for r in receptions_db if r["id"] == reception_id), None)
    if not r:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    r["status"] = status
    if status == "completed":
        r["completed_at"] = datetime.now().isoformat()
    return r

@app.delete("/api/receptions/{reception_id}")
def delete_reception(reception_id: int):
    idx = next((i for i, r in enumerate(receptions_db) if r["id"] == reception_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    receptions_db.pop(idx)
    return {"ok": True}


# ===== 작업 이력 =====

@app.get("/api/jobs")
def get_jobs(engineer_id: Optional[int] = None, status: Optional[str] = None):
    result = jobs_db
    if engineer_id:
        result = [j for j in result if j["engineer_id"] == engineer_id]
    if status:
        result = [j for j in result if j["status"] == status]
    return result

@app.get("/api/jobs/{job_id}")
def get_job(job_id: int):
    j = next((j for j in jobs_db if j["id"] == job_id), None)
    if not j:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return j

@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, body: JobUpdate):
    j = next((j for j in jobs_db if j["id"] == job_id), None)
    if not j:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    for k, v in body.model_dump(exclude_none=True).items():
        j[k] = v
    if body.status == "completed":
        j["completed_at"] = datetime.now().isoformat()
    return j


# ===== 판매 관리 =====

@app.get("/api/sales")
def get_sales(paid: Optional[bool] = None):
    if paid is not None:
        return [s for s in sales_db if s["paid"] == paid]
    return sales_db

@app.post("/api/sales")
def create_sale(body: SaleCreate):
    new = {**body.model_dump(), "id": sales_counter[0], "paid": False, "created_at": datetime.now().isoformat()}
    sales_db.append(new)
    sales_counter[0] += 1
    return new

@app.put("/api/sales/{sale_id}/pay")
def mark_sale_paid(sale_id: int):
    s = next((s for s in sales_db if s["id"] == sale_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="판매를 찾을 수 없습니다")
    s["paid"] = True
    return s

@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: int):
    idx = next((i for i, s in enumerate(sales_db) if s["id"] == sale_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="판매를 찾을 수 없습니다")
    sales_db.pop(idx)
    return {"ok": True}


# ===== 재고 관리 =====

@app.get("/api/inventory")
def get_inventory():
    return inventory_db

@app.post("/api/inventory")
def create_inventory(body: InventoryCreate):
    new = {**body.model_dump(), "id": inventory_counter[0], "created_at": datetime.now().isoformat()}
    inventory_db.append(new)
    inventory_counter[0] += 1
    return new

@app.put("/api/inventory/{inventory_id}")
def update_inventory(inventory_id: int, body: InventoryUpdate):
    item = next((i for i in inventory_db if i["id"] == inventory_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="재고를 찾을 수 없습니다")
    for k, v in body.model_dump(exclude_none=True).items():
        item[k] = v
    return item

@app.delete("/api/inventory/{inventory_id}")
def delete_inventory(inventory_id: int):
    idx = next((i for i, item in enumerate(inventory_db) if item["id"] == inventory_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="재고를 찾을 수 없습니다")
    inventory_db.pop(idx)
    return {"ok": True}


# ===== 네트워크 장비 관리 (NAS, 공유기 등) =====

@app.get("/api/network-devices")
def get_network_devices(customer_id: Optional[int] = None, device_type: Optional[str] = None):
    result = network_devices_db
    if customer_id:
        result = [d for d in result if d["customer_id"] == customer_id]
    if device_type:
        result = [d for d in result if d["device_type"] == device_type]
    return result

@app.get("/api/network-devices/{device_id}")
def get_network_device(device_id: int):
    d = next((d for d in network_devices_db if d["id"] == device_id), None)
    if not d:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    return d

@app.post("/api/network-devices")
def create_network_device(body: NetworkDeviceCreate):
    new = {**body.model_dump(), "id": network_devices_counter[0], "created_at": datetime.now().isoformat()}
    network_devices_db.append(new)
    network_devices_counter[0] += 1
    return new

@app.put("/api/network-devices/{device_id}")
def update_network_device(device_id: int, body: NetworkDeviceCreate):
    d = next((d for d in network_devices_db if d["id"] == device_id), None)
    if not d:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    for k, v in body.model_dump().items():
        d[k] = v
    return d

@app.delete("/api/network-devices/{device_id}")
def delete_network_device(device_id: int):
    idx = next((i for i, d in enumerate(network_devices_db) if d["id"] == device_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    network_devices_db.pop(idx)
    return {"ok": True}


# ===== 결제 관리 =====

@app.get("/api/payments")
def get_payments(status: Optional[str] = None):
    if status:
        return [p for p in payments_db if p["payment_status"] == status]
    return payments_db

@app.post("/api/payments")
def create_payment(body: PaymentCreate):
    new = {**body.model_dump(), "id": payments_counter[0], "payment_status": "pending", "paid_at": None, "created_at": datetime.now().isoformat()}
    payments_db.append(new)
    payments_counter[0] += 1
    return new

@app.put("/api/payments/{payment_id}/complete")
def complete_payment(payment_id: int):
    p = next((p for p in payments_db if p["id"] == payment_id), None)
    if not p:
        raise HTTPException(status_code=404, detail="결제를 찾을 수 없습니다")
    p["payment_status"] = "completed"
    p["paid_at"] = datetime.now().isoformat()
    return p


# ===== 대시보드 =====

@app.get("/api/dashboard")
def get_dashboard():
    today = datetime.now().date().isoformat()
    today_receptions = [r for r in receptions_db if r["received_at"][:10] == today]
    return {
        "today_new": len([r for r in today_receptions if r["status"] == "new"]),
        "assigned_pending": len([r for r in receptions_db if r["status"] == "assigned"]),
        "in_progress": len([r for r in receptions_db if r["status"] == "in_progress"]),
        "completed_today": len([r for r in today_receptions if r["status"] == "completed"]),
        "total_outstanding": sum(c["outstanding_amount"] for c in customers_db),
        "low_stock_count": len([i for i in inventory_db if i["quantity"] <= i["reorder_level"]]),
        "engineers": engineers_db,
        "pending_receptions": [r for r in receptions_db if r["status"] in ["new", "assigned"]],
    }


# ===== 통계 =====

@app.get("/api/stats")
def get_stats():
    completed_jobs = [j for j in jobs_db if j["status"] == "completed"]
    total_revenue = sum(j["total_cost"] for j in completed_jobs)
    sales_revenue = sum(s["total_price"] for s in sales_db if s["paid"])

    channel_counts = {}
    for r in receptions_db:
        ch = r["reception_channel"]
        channel_counts[ch] = channel_counts.get(ch, 0) + 1

    engineer_stats = []
    for e in engineers_db:
        e_jobs = [j for j in jobs_db if j["engineer_id"] == e["id"]]
        e_revenue = sum(j["total_cost"] for j in e_jobs if j["status"] == "completed")
        engineer_stats.append({
            "id": e["id"],
            "name": e["name"],
            "total_jobs": len(e_jobs),
            "completed_jobs": len([j for j in e_jobs if j["status"] == "completed"]),
            "revenue": e_revenue,
        })

    return {
        "total_customers": len(customers_db),
        "total_receptions": len(receptions_db),
        "completed_jobs": len(completed_jobs),
        "repair_revenue": total_revenue,
        "sales_revenue": sales_revenue,
        "total_revenue": total_revenue + sales_revenue,
        "total_outstanding": sum(c["outstanding_amount"] for c in customers_db),
        "channel_counts": channel_counts,
        "engineer_stats": engineer_stats,
        "inventory_low_stock": [i for i in inventory_db if i["quantity"] <= i["reorder_level"]],
    }


# ===== 전화 수신 (CTI) =====

def normalize_phone(phone: str) -> str:
    """전화번호에서 숫자만 추출 (010-1234-5678 → 01012345678)"""
    return ''.join(filter(str.isdigit, phone))

@app.post("/api/incoming-call")
def incoming_call(phone: str):
    """Android 앱이 전화 수신 시 호출 — 고객 매칭 후 대기열에 추가"""
    clean = normalize_phone(phone)
    matched = next(
        (c for c in customers_db if normalize_phone(c.get("phone", "")) == clean or normalize_phone(c.get("phone2", "") or "") == clean),
        None
    )
    recent = []
    if matched:
        recent = sorted(
            [r for r in receptions_db if r["customer_id"] == matched["id"]],
            key=lambda r: r["received_at"], reverse=True
        )[:3]

    call = {
        "id": incoming_calls_counter[0],
        "phone": clean,
        "customer": matched,
        "recent_receptions": recent,
        "received_at": datetime.now().isoformat(),
        "dismissed": False,
    }
    incoming_calls_db.append(call)
    incoming_calls_counter[0] += 1
    return call

@app.get("/api/incoming-call/pending")
def get_pending_calls():
    """PC가 폴링하여 미처리 수신 전화 확인"""
    return [c for c in incoming_calls_db if not c["dismissed"]]

@app.delete("/api/incoming-call/{call_id}")
def dismiss_call(call_id: int):
    """전화 팝업 닫기 (무시 또는 접수 완료 후)"""
    call = next((c for c in incoming_calls_db if c["id"] == call_id), None)
    if call:
        call["dismissed"] = True
    return {"ok": True}


# ===== SMS 수신 =====

@app.post("/api/incoming-sms")
def incoming_sms(body: SmsReceived):
    """Android 앱이 SMS 수신 시 호출 — 고객 매칭 후 대기열에 추가"""
    clean = normalize_phone(body.phone)
    matched = next(
        (c for c in customers_db if normalize_phone(c.get("phone", "")) == clean or normalize_phone(c.get("phone2", "") or "") == clean),
        None
    )
    recent = []
    if matched:
        recent = sorted(
            [r for r in receptions_db if r["customer_id"] == matched["id"]],
            key=lambda r: r["received_at"], reverse=True
        )[:3]

    sms = {
        "id": incoming_sms_counter[0],
        "phone": clean,
        "message": body.message,
        "customer": matched,
        "recent_receptions": recent,
        "received_at": body.received_at,
        "dismissed": False,
    }
    incoming_sms_db.append(sms)
    incoming_sms_counter[0] += 1
    return sms

@app.get("/api/incoming-sms/pending")
def get_pending_sms():
    """PC가 폴링하여 미처리 수신 SMS 확인"""
    return [s for s in incoming_sms_db if not s["dismissed"]]

@app.delete("/api/incoming-sms/{sms_id}")
def dismiss_sms(sms_id: int):
    """SMS 팝업 닫기 (무시 또는 접수 완료 후)"""
    sms = next((s for s in incoming_sms_db if s["id"] == sms_id), None)
    if sms:
        sms["dismissed"] = True
    return {"ok": True}


# ===== 헬스체크 =====

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"name": "CSEP API", "version": "1.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
