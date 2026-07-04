from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
import psycopg2
import psycopg2.extras

app = FastAPI(title="CSEP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")

def get_conn():
    return psycopg2.connect(DATABASE_URL, sslmode="require")

def db_exec(sql, params=None, fetch=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            if fetch == "all":
                result = [dict(r) for r in cur.fetchall()]
            elif fetch == "one":
                r = cur.fetchone()
                result = dict(r) if r else None
            else:
                result = None
            conn.commit()
            return result
    finally:
        conn.close()

def normalize_phone(phone: str) -> str:
    return ''.join(filter(str.isdigit, phone))

def init_db():
    if not DATABASE_URL:
        return
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS customers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    customer_type VARCHAR DEFAULT 'personal',
                    company_name VARCHAR,
                    contact_person VARCHAR,
                    phone VARCHAR NOT NULL,
                    phone2 VARCHAR,
                    email VARCHAR,
                    address VARCHAR,
                    address_detail VARCHAR,
                    memo TEXT,
                    outstanding_amount FLOAT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS computers (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
                    name VARCHAR,
                    device_type VARCHAR DEFAULT 'desktop',
                    cpu VARCHAR, ram VARCHAR, ssd VARCHAR, hdd VARCHAR,
                    motherboard VARCHAR, gpu VARCHAR, os VARCHAR, os_version VARCHAR,
                    office_installed BOOLEAN DEFAULT FALSE, office_version VARCHAR,
                    antivirus VARCHAR, ip_address VARCHAR, mac_address VARCHAR,
                    serial_number VARCHAR, assembled BOOLEAN DEFAULT FALSE,
                    purchase_date VARCHAR, warranty_expiry VARCHAR,
                    power VARCHAR, printer VARCHAR, monitor VARCHAR,
                    nas_name VARCHAR, nas_model VARCHAR, nas_ip VARCHAR,
                    nas_hdd_count INTEGER, nas_hdd_detail VARCHAR,
                    nas_total_capacity VARCHAR, nas_partition_info VARCHAR,
                    nas_maintenance_period VARCHAR, nas_maintenance_notes VARCHAR,
                    nas_admin_id VARCHAR, nas_admin_password VARCHAR,
                    router_name VARCHAR, router_model VARCHAR, router_ip VARCHAR,
                    router_admin_id VARCHAR, router_admin_password VARCHAR,
                    notes TEXT, created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS engineers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL, phone VARCHAR NOT NULL,
                    status VARCHAR DEFAULT 'idle', location VARCHAR,
                    total_jobs INTEGER DEFAULT 0, total_revenue FLOAT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS receptions (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
                    computer_id INTEGER REFERENCES computers(id) ON DELETE SET NULL,
                    reception_channel VARCHAR, reception_phone VARCHAR,
                    symptom TEXT, initial_memo TEXT, status VARCHAR DEFAULT 'new',
                    assigned_engineer_id INTEGER REFERENCES engineers(id) ON DELETE SET NULL,
                    assigned_at TIMESTAMP, completed_at TIMESTAMP, solution TEXT,
                    received_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id SERIAL PRIMARY KEY,
                    reception_id INTEGER REFERENCES receptions(id) ON DELETE SET NULL,
                    engineer_id INTEGER REFERENCES engineers(id) ON DELETE SET NULL,
                    scheduled_date VARCHAR, status VARCHAR DEFAULT 'assigned',
                    started_at TIMESTAMP, completed_at TIMESTAMP,
                    work_description TEXT, parts_used TEXT,
                    cost_parts FLOAT DEFAULT 0, cost_labor FLOAT DEFAULT 0,
                    total_cost FLOAT DEFAULT 0, created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS sales (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
                    engineer_id INTEGER REFERENCES engineers(id) ON DELETE SET NULL,
                    item_type VARCHAR, item_name VARCHAR, quantity INTEGER,
                    unit_price FLOAT, total_price FLOAT, sale_date VARCHAR,
                    payment_method VARCHAR, paid BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS inventory (
                    id SERIAL PRIMARY KEY,
                    part_name VARCHAR NOT NULL, part_code VARCHAR, category VARCHAR,
                    quantity INTEGER DEFAULT 0, reorder_level INTEGER DEFAULT 5,
                    unit_cost FLOAT, unit_price FLOAT,
                    supplier VARCHAR, supplier_phone VARCHAR, location VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS payments (
                    id SERIAL PRIMARY KEY,
                    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
                    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
                    amount FLOAT, payment_method VARCHAR,
                    payment_status VARCHAR DEFAULT 'pending',
                    paid_at TIMESTAMP, due_date VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS network_devices (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
                    device_type VARCHAR, name VARCHAR, model VARCHAR,
                    ip_address VARCHAR, hdd_count INTEGER, hdd_detail VARCHAR,
                    total_capacity VARCHAR, partition_info VARCHAR,
                    maintenance_period VARCHAR, maintenance_notes VARCHAR,
                    admin_id VARCHAR, admin_password VARCHAR,
                    notes TEXT, created_at TIMESTAMP DEFAULT NOW()
                );
            """)
        conn.commit()
    finally:
        conn.close()

init_db()

# 수신 전화/SMS 는 임시 메모리 (재시작 시 초기화 - 의도된 동작)
incoming_calls_db = []
incoming_calls_counter = [1]
incoming_sms_db = []
incoming_sms_counter = [1]


# ===== Pydantic 모델 =====

class CustomerCreate(BaseModel):
    name: str
    phone: str
    customer_type: str = "personal"
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
    device_type: str
    name: str
    model: Optional[str] = None
    ip_address: Optional[str] = None
    hdd_count: Optional[int] = None
    hdd_detail: Optional[str] = None
    total_capacity: Optional[str] = None
    partition_info: Optional[str] = None
    maintenance_period: Optional[str] = None
    maintenance_notes: Optional[str] = None
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
        return db_exec(
            "SELECT * FROM customers WHERE name ILIKE %s OR phone ILIKE %s OR phone2 ILIKE %s ORDER BY id",
            (f"%{search}%", f"%{search}%", f"%{search}%"), fetch="all"
        )
    return db_exec("SELECT * FROM customers ORDER BY id", fetch="all")

@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: int):
    c = db_exec("SELECT * FROM customers WHERE id=%s", (customer_id,), fetch="one")
    if not c:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return c

@app.post("/api/customers")
def create_customer(body: CustomerCreate):
    d = body.model_dump()
    return db_exec(
        """INSERT INTO customers (name,customer_type,company_name,contact_person,phone,phone2,email,address,address_detail,memo,outstanding_amount)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0) RETURNING *""",
        (d["name"],d["customer_type"],d["company_name"],d["contact_person"],d["phone"],d["phone2"],d["email"],d["address"],d["address_detail"],d["memo"]),
        fetch="one"
    )

@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, body: CustomerUpdate):
    c = db_exec("SELECT * FROM customers WHERE id=%s", (customer_id,), fetch="one")
    if not c:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return c
    sets = ", ".join(f"{k}=%s" for k in updates)
    return db_exec(f"UPDATE customers SET {sets} WHERE id=%s RETURNING *",
                   (*updates.values(), customer_id), fetch="one")

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    db_exec("DELETE FROM customers WHERE id=%s", (customer_id,))
    return {"ok": True}

@app.get("/api/customers/{customer_id}/computers")
def get_customer_computers(customer_id: int):
    return db_exec("SELECT * FROM computers WHERE customer_id=%s ORDER BY id", (customer_id,), fetch="all")

@app.get("/api/customers/{customer_id}/receptions")
def get_customer_receptions(customer_id: int):
    return db_exec("SELECT * FROM receptions WHERE customer_id=%s ORDER BY received_at DESC", (customer_id,), fetch="all")


# ===== 컴퓨터 관리 =====

@app.get("/api/computers")
def get_computers(customer_id: Optional[int] = None):
    if customer_id:
        return db_exec("SELECT * FROM computers WHERE customer_id=%s ORDER BY id", (customer_id,), fetch="all")
    return db_exec("SELECT * FROM computers ORDER BY id", fetch="all")

@app.get("/api/computers/{computer_id}")
def get_computer(computer_id: int):
    c = db_exec("SELECT * FROM computers WHERE id=%s", (computer_id,), fetch="one")
    if not c:
        raise HTTPException(status_code=404, detail="컴퓨터를 찾을 수 없습니다")
    return c

@app.post("/api/computers")
def create_computer(body: ComputerCreate):
    d = body.model_dump()
    cols = ", ".join(d.keys())
    placeholders = ", ".join(["%s"] * len(d))
    return db_exec(f"INSERT INTO computers ({cols}) VALUES ({placeholders}) RETURNING *",
                   tuple(d.values()), fetch="one")

@app.put("/api/computers/{computer_id}")
def update_computer(computer_id: int, body: ComputerCreate):
    c = db_exec("SELECT * FROM computers WHERE id=%s", (computer_id,), fetch="one")
    if not c:
        raise HTTPException(status_code=404, detail="컴퓨터를 찾을 수 없습니다")
    d = body.model_dump(exclude_none=True)
    if not d:
        return c
    sets = ", ".join(f"{k}=%s" for k in d)
    return db_exec(f"UPDATE computers SET {sets} WHERE id=%s RETURNING *",
                   (*d.values(), computer_id), fetch="one")

@app.delete("/api/computers/{computer_id}")
def delete_computer(computer_id: int):
    db_exec("DELETE FROM computers WHERE id=%s", (computer_id,))
    return {"ok": True}


# ===== 기사 관리 =====

@app.get("/api/engineers")
def get_engineers():
    return db_exec("SELECT * FROM engineers ORDER BY id", fetch="all")

@app.get("/api/engineers/{engineer_id}")
def get_engineer(engineer_id: int):
    e = db_exec("SELECT * FROM engineers WHERE id=%s", (engineer_id,), fetch="one")
    if not e:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return e

@app.post("/api/engineers")
def create_engineer(body: EngineerCreate):
    return db_exec(
        "INSERT INTO engineers (name,phone,status,total_jobs,total_revenue) VALUES (%s,%s,'idle',0,0) RETURNING *",
        (body.name, body.phone), fetch="one"
    )

@app.put("/api/engineers/{engineer_id}/status")
def update_engineer_status(engineer_id: int, status: str):
    e = db_exec("UPDATE engineers SET status=%s WHERE id=%s RETURNING *", (status, engineer_id), fetch="one")
    if not e:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return e

@app.put("/api/engineers/{engineer_id}/location")
def update_engineer_location(engineer_id: int, location: str):
    e = db_exec("UPDATE engineers SET location=%s WHERE id=%s RETURNING *", (location, engineer_id), fetch="one")
    if not e:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return e

@app.delete("/api/engineers/{engineer_id}")
def delete_engineer(engineer_id: int):
    db_exec("DELETE FROM engineers WHERE id=%s", (engineer_id,))
    return {"ok": True}


# ===== 접수 관리 =====

@app.get("/api/receptions")
def get_receptions(status: Optional[str] = None):
    if status:
        return db_exec("SELECT * FROM receptions WHERE status=%s ORDER BY received_at DESC", (status,), fetch="all")
    return db_exec("SELECT * FROM receptions ORDER BY received_at DESC", fetch="all")

@app.get("/api/receptions/{reception_id}")
def get_reception(reception_id: int):
    r = db_exec("SELECT * FROM receptions WHERE id=%s", (reception_id,), fetch="one")
    if not r:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    return r

@app.post("/api/receptions")
def create_reception(body: ReceptionCreate):
    d = body.model_dump()
    return db_exec(
        """INSERT INTO receptions (customer_id,computer_id,reception_channel,reception_phone,symptom,initial_memo,status,received_at)
           VALUES (%s,%s,%s,%s,%s,%s,'new',NOW()) RETURNING *""",
        (d["customer_id"],d["computer_id"],d["reception_channel"],d["reception_phone"],d["symptom"],d["initial_memo"]),
        fetch="one"
    )

@app.put("/api/receptions/{reception_id}/assign")
def assign_reception(reception_id: int, engineer_id: int):
    r = db_exec(
        "UPDATE receptions SET assigned_engineer_id=%s, status='assigned', assigned_at=NOW() WHERE id=%s RETURNING *",
        (engineer_id, reception_id), fetch="one"
    )
    if not r:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    return r

@app.put("/api/receptions/{reception_id}/status")
def update_reception_status(reception_id: int, status: str):
    if status == "completed":
        r = db_exec("UPDATE receptions SET status=%s, completed_at=NOW() WHERE id=%s RETURNING *",
                    (status, reception_id), fetch="one")
    else:
        r = db_exec("UPDATE receptions SET status=%s WHERE id=%s RETURNING *",
                    (status, reception_id), fetch="one")
    if not r:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    return r

@app.delete("/api/receptions/{reception_id}")
def delete_reception(reception_id: int):
    db_exec("DELETE FROM receptions WHERE id=%s", (reception_id,))
    return {"ok": True}


# ===== 작업 이력 =====

@app.get("/api/jobs")
def get_jobs(engineer_id: Optional[int] = None, status: Optional[str] = None):
    if engineer_id and status:
        return db_exec("SELECT * FROM jobs WHERE engineer_id=%s AND status=%s ORDER BY id", (engineer_id, status), fetch="all")
    elif engineer_id:
        return db_exec("SELECT * FROM jobs WHERE engineer_id=%s ORDER BY id", (engineer_id,), fetch="all")
    elif status:
        return db_exec("SELECT * FROM jobs WHERE status=%s ORDER BY id", (status,), fetch="all")
    return db_exec("SELECT * FROM jobs ORDER BY id", fetch="all")

@app.get("/api/jobs/{job_id}")
def get_job(job_id: int):
    j = db_exec("SELECT * FROM jobs WHERE id=%s", (job_id,), fetch="one")
    if not j:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return j

@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, body: JobUpdate):
    d = body.model_dump(exclude_none=True)
    if not d:
        j = db_exec("SELECT * FROM jobs WHERE id=%s", (job_id,), fetch="one")
        if not j:
            raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
        return j
    if d.get("status") == "completed":
        d["completed_at"] = datetime.now().isoformat()
    sets = ", ".join(f"{k}=%s" for k in d)
    j = db_exec(f"UPDATE jobs SET {sets} WHERE id=%s RETURNING *", (*d.values(), job_id), fetch="one")
    if not j:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return j


# ===== 판매 관리 =====

@app.get("/api/sales")
def get_sales(paid: Optional[bool] = None):
    if paid is not None:
        return db_exec("SELECT * FROM sales WHERE paid=%s ORDER BY id", (paid,), fetch="all")
    return db_exec("SELECT * FROM sales ORDER BY id", fetch="all")

@app.post("/api/sales")
def create_sale(body: SaleCreate):
    d = body.model_dump()
    return db_exec(
        """INSERT INTO sales (customer_id,engineer_id,item_type,item_name,quantity,unit_price,total_price,sale_date,payment_method,paid)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE) RETURNING *""",
        (d["customer_id"],d["engineer_id"],d["item_type"],d["item_name"],d["quantity"],d["unit_price"],d["total_price"],d["sale_date"],d["payment_method"]),
        fetch="one"
    )

@app.put("/api/sales/{sale_id}/pay")
def mark_sale_paid(sale_id: int):
    s = db_exec("UPDATE sales SET paid=TRUE WHERE id=%s RETURNING *", (sale_id,), fetch="one")
    if not s:
        raise HTTPException(status_code=404, detail="판매를 찾을 수 없습니다")
    return s

@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: int):
    db_exec("DELETE FROM sales WHERE id=%s", (sale_id,))
    return {"ok": True}


# ===== 재고 관리 =====

@app.get("/api/inventory")
def get_inventory():
    return db_exec("SELECT * FROM inventory ORDER BY id", fetch="all")

@app.post("/api/inventory")
def create_inventory(body: InventoryCreate):
    d = body.model_dump()
    return db_exec(
        """INSERT INTO inventory (part_name,part_code,category,quantity,reorder_level,unit_cost,unit_price,supplier,supplier_phone,location)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        (d["part_name"],d["part_code"],d["category"],d["quantity"],d["reorder_level"],d["unit_cost"],d["unit_price"],d["supplier"],d["supplier_phone"],d["location"]),
        fetch="one"
    )

@app.put("/api/inventory/{inventory_id}")
def update_inventory(inventory_id: int, body: InventoryUpdate):
    d = body.model_dump(exclude_none=True)
    if not d:
        item = db_exec("SELECT * FROM inventory WHERE id=%s", (inventory_id,), fetch="one")
        if not item:
            raise HTTPException(status_code=404, detail="재고를 찾을 수 없습니다")
        return item
    sets = ", ".join(f"{k}=%s" for k in d)
    item = db_exec(f"UPDATE inventory SET {sets} WHERE id=%s RETURNING *", (*d.values(), inventory_id), fetch="one")
    if not item:
        raise HTTPException(status_code=404, detail="재고를 찾을 수 없습니다")
    return item

@app.delete("/api/inventory/{inventory_id}")
def delete_inventory(inventory_id: int):
    db_exec("DELETE FROM inventory WHERE id=%s", (inventory_id,))
    return {"ok": True}


# ===== 네트워크 장비 관리 =====

@app.get("/api/network-devices")
def get_network_devices(customer_id: Optional[int] = None, device_type: Optional[str] = None):
    if customer_id and device_type:
        return db_exec("SELECT * FROM network_devices WHERE customer_id=%s AND device_type=%s ORDER BY id",
                       (customer_id, device_type), fetch="all")
    elif customer_id:
        return db_exec("SELECT * FROM network_devices WHERE customer_id=%s ORDER BY id", (customer_id,), fetch="all")
    elif device_type:
        return db_exec("SELECT * FROM network_devices WHERE device_type=%s ORDER BY id", (device_type,), fetch="all")
    return db_exec("SELECT * FROM network_devices ORDER BY id", fetch="all")

@app.get("/api/network-devices/{device_id}")
def get_network_device(device_id: int):
    d = db_exec("SELECT * FROM network_devices WHERE id=%s", (device_id,), fetch="one")
    if not d:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    return d

@app.post("/api/network-devices")
def create_network_device(body: NetworkDeviceCreate):
    d = body.model_dump()
    return db_exec(
        """INSERT INTO network_devices (customer_id,device_type,name,model,ip_address,hdd_count,hdd_detail,total_capacity,partition_info,maintenance_period,maintenance_notes,admin_id,admin_password,notes)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        (d["customer_id"],d["device_type"],d["name"],d["model"],d["ip_address"],d["hdd_count"],d["hdd_detail"],d["total_capacity"],d["partition_info"],d["maintenance_period"],d["maintenance_notes"],d["admin_id"],d["admin_password"],d["notes"]),
        fetch="one"
    )

@app.put("/api/network-devices/{device_id}")
def update_network_device(device_id: int, body: NetworkDeviceCreate):
    d = body.model_dump(exclude_none=True)
    if not d:
        dev = db_exec("SELECT * FROM network_devices WHERE id=%s", (device_id,), fetch="one")
        if not dev:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
        return dev
    sets = ", ".join(f"{k}=%s" for k in d)
    dev = db_exec(f"UPDATE network_devices SET {sets} WHERE id=%s RETURNING *", (*d.values(), device_id), fetch="one")
    if not dev:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    return dev

@app.delete("/api/network-devices/{device_id}")
def delete_network_device(device_id: int):
    db_exec("DELETE FROM network_devices WHERE id=%s", (device_id,))
    return {"ok": True}


# ===== 결제 관리 =====

@app.get("/api/payments")
def get_payments(status: Optional[str] = None):
    if status:
        return db_exec("SELECT * FROM payments WHERE payment_status=%s ORDER BY id", (status,), fetch="all")
    return db_exec("SELECT * FROM payments ORDER BY id", fetch="all")

@app.post("/api/payments")
def create_payment(body: PaymentCreate):
    d = body.model_dump()
    return db_exec(
        "INSERT INTO payments (job_id,sale_id,amount,payment_method,payment_status,due_date) VALUES (%s,%s,%s,%s,'pending',%s) RETURNING *",
        (d["job_id"],d["sale_id"],d["amount"],d["payment_method"],d["due_date"]),
        fetch="one"
    )

@app.put("/api/payments/{payment_id}/complete")
def complete_payment(payment_id: int):
    p = db_exec("UPDATE payments SET payment_status='completed', paid_at=NOW() WHERE id=%s RETURNING *",
                (payment_id,), fetch="one")
    if not p:
        raise HTTPException(status_code=404, detail="결제를 찾을 수 없습니다")
    return p


# ===== 대시보드 =====

@app.get("/api/dashboard")
def get_dashboard():
    today = datetime.now().date().isoformat()
    today_new = db_exec("SELECT COUNT(*) as cnt FROM receptions WHERE received_at::date=%s AND status='new'", (today,), fetch="one")
    assigned = db_exec("SELECT COUNT(*) as cnt FROM receptions WHERE status='assigned'", fetch="one")
    in_prog = db_exec("SELECT COUNT(*) as cnt FROM receptions WHERE status='in_progress'", fetch="one")
    comp_today = db_exec("SELECT COUNT(*) as cnt FROM receptions WHERE received_at::date=%s AND status='completed'", (today,), fetch="one")
    outstanding = db_exec("SELECT COALESCE(SUM(outstanding_amount),0) as total FROM customers", fetch="one")
    low_stock = db_exec("SELECT COUNT(*) as cnt FROM inventory WHERE quantity <= reorder_level", fetch="one")
    engineers = db_exec("SELECT * FROM engineers ORDER BY id", fetch="all")
    pending = db_exec("SELECT * FROM receptions WHERE status IN ('new','assigned') ORDER BY received_at DESC", fetch="all")
    return {
        "today_new": today_new["cnt"] if today_new else 0,
        "assigned_pending": assigned["cnt"] if assigned else 0,
        "in_progress": in_prog["cnt"] if in_prog else 0,
        "completed_today": comp_today["cnt"] if comp_today else 0,
        "total_outstanding": outstanding["total"] if outstanding else 0,
        "low_stock_count": low_stock["cnt"] if low_stock else 0,
        "engineers": engineers,
        "pending_receptions": pending,
    }


# ===== 통계 =====

@app.get("/api/stats")
def get_stats():
    total_customers = db_exec("SELECT COUNT(*) as cnt FROM customers", fetch="one")
    total_receptions = db_exec("SELECT COUNT(*) as cnt FROM receptions", fetch="one")
    repair_data = db_exec("SELECT COUNT(*) as cnt, COALESCE(SUM(total_cost),0) as rev FROM jobs WHERE status='completed'", fetch="one")
    sales_data = db_exec("SELECT COALESCE(SUM(total_price),0) as rev FROM sales WHERE paid=TRUE", fetch="one")
    outstanding = db_exec("SELECT COALESCE(SUM(outstanding_amount),0) as total FROM customers", fetch="one")
    channels = db_exec("SELECT reception_channel, COUNT(*) as cnt FROM receptions GROUP BY reception_channel", fetch="all")
    engineers = db_exec("SELECT * FROM engineers ORDER BY id", fetch="all")
    low_stock = db_exec("SELECT * FROM inventory WHERE quantity <= reorder_level ORDER BY id", fetch="all")

    channel_counts = {r["reception_channel"]: r["cnt"] for r in channels}
    repair_rev = repair_data["rev"] if repair_data else 0
    sales_rev = sales_data["rev"] if sales_data else 0

    engineer_stats = []
    for e in engineers:
        e_data = db_exec(
            "SELECT COUNT(*) as cnt, COALESCE(SUM(total_cost),0) as rev FROM jobs WHERE engineer_id=%s AND status='completed'",
            (e["id"],), fetch="one"
        )
        total_e = db_exec("SELECT COUNT(*) as cnt FROM jobs WHERE engineer_id=%s", (e["id"],), fetch="one")
        engineer_stats.append({
            "id": e["id"], "name": e["name"],
            "total_jobs": total_e["cnt"] if total_e else 0,
            "completed_jobs": e_data["cnt"] if e_data else 0,
            "revenue": e_data["rev"] if e_data else 0,
        })

    return {
        "total_customers": total_customers["cnt"] if total_customers else 0,
        "total_receptions": total_receptions["cnt"] if total_receptions else 0,
        "completed_jobs": repair_data["cnt"] if repair_data else 0,
        "repair_revenue": repair_rev,
        "sales_revenue": sales_rev,
        "total_revenue": repair_rev + sales_rev,
        "total_outstanding": outstanding["total"] if outstanding else 0,
        "channel_counts": channel_counts,
        "engineer_stats": engineer_stats,
        "inventory_low_stock": low_stock,
    }


# ===== 전화 수신 (CTI) =====

@app.post("/api/incoming-call")
def incoming_call(phone: str):
    clean = normalize_phone(phone)
    customers = db_exec("SELECT * FROM customers", fetch="all")
    matched = next(
        (c for c in customers if normalize_phone(c.get("phone","")) == clean or normalize_phone(c.get("phone2","") or "") == clean),
        None
    )
    recent = []
    if matched:
        recent = db_exec(
            "SELECT * FROM receptions WHERE customer_id=%s ORDER BY received_at DESC LIMIT 3",
            (matched["id"],), fetch="all"
        )
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
    return [c for c in incoming_calls_db if not c["dismissed"]]

@app.delete("/api/incoming-call/{call_id}")
def dismiss_call(call_id: int):
    call = next((c for c in incoming_calls_db if c["id"] == call_id), None)
    if call:
        call["dismissed"] = True
    return {"ok": True}


# ===== SMS 수신 =====

@app.post("/api/incoming-sms")
def incoming_sms(body: SmsReceived):
    clean = normalize_phone(body.phone)
    customers = db_exec("SELECT * FROM customers", fetch="all")
    matched = next(
        (c for c in customers if normalize_phone(c.get("phone","")) == clean or normalize_phone(c.get("phone2","") or "") == clean),
        None
    )
    recent = []
    if matched:
        recent = db_exec(
            "SELECT * FROM receptions WHERE customer_id=%s ORDER BY received_at DESC LIMIT 3",
            (matched["id"],), fetch="all"
        )
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
    return [s for s in incoming_sms_db if not s["dismissed"]]

@app.delete("/api/incoming-sms/{sms_id}")
def dismiss_sms(sms_id: int):
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
