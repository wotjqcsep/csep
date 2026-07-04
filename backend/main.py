from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
from supabase import create_client, Client

app = FastAPI(title="CSEP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

sb: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def db(table: str):
    return sb.table(table)

def normalize_phone(phone: str) -> str:
    return ''.join(filter(str.isdigit, phone))

# 수신 전화/SMS 임시 메모리
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
    q = db("customers").select("*").order("id")
    if search:
        result = db("customers").select("*").or_(
            f"name.ilike.%{search}%,phone.ilike.%{search}%,phone2.ilike.%{search}%"
        ).order("id").execute()
    else:
        result = q.execute()
    return result.data

@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: int):
    result = db("customers").select("*").eq("id", customer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return result.data[0]

@app.post("/api/customers")
def create_customer(body: CustomerCreate):
    d = body.model_dump()
    d["outstanding_amount"] = 0
    result = db("customers").insert(d).execute()
    return result.data[0]

@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, body: CustomerUpdate):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return get_customer(customer_id)
    result = db("customers").update(updates).eq("id", customer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return result.data[0]

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    db("customers").delete().eq("id", customer_id).execute()
    return {"ok": True}

@app.get("/api/customers/{customer_id}/computers")
def get_customer_computers(customer_id: int):
    result = db("computers").select("*").eq("customer_id", customer_id).order("id").execute()
    return result.data

@app.get("/api/customers/{customer_id}/receptions")
def get_customer_receptions(customer_id: int):
    result = db("receptions").select("*").eq("customer_id", customer_id).order("received_at", desc=True).execute()
    return result.data


# ===== 컴퓨터 관리 =====

@app.get("/api/computers")
def get_computers(customer_id: Optional[int] = None):
    q = db("computers").select("*").order("id")
    if customer_id:
        q = db("computers").select("*").eq("customer_id", customer_id).order("id")
    return q.execute().data

@app.get("/api/computers/{computer_id}")
def get_computer(computer_id: int):
    result = db("computers").select("*").eq("id", computer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="컴퓨터를 찾을 수 없습니다")
    return result.data[0]

@app.post("/api/computers")
def create_computer(body: ComputerCreate):
    result = db("computers").insert(body.model_dump()).execute()
    return result.data[0]

@app.put("/api/computers/{computer_id}")
def update_computer(computer_id: int, body: ComputerCreate):
    d = body.model_dump(exclude_none=True)
    result = db("computers").update(d).eq("id", computer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="컴퓨터를 찾을 수 없습니다")
    return result.data[0]

@app.delete("/api/computers/{computer_id}")
def delete_computer(computer_id: int):
    db("computers").delete().eq("id", computer_id).execute()
    return {"ok": True}


# ===== 기사 관리 =====

@app.get("/api/engineers")
def get_engineers():
    return db("engineers").select("*").order("id").execute().data

@app.get("/api/engineers/{engineer_id}")
def get_engineer(engineer_id: int):
    result = db("engineers").select("*").eq("id", engineer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return result.data[0]

@app.post("/api/engineers")
def create_engineer(body: EngineerCreate):
    result = db("engineers").insert({
        "name": body.name, "phone": body.phone,
        "status": "idle", "total_jobs": 0, "total_revenue": 0
    }).execute()
    return result.data[0]

@app.put("/api/engineers/{engineer_id}/status")
def update_engineer_status(engineer_id: int, status: str):
    result = db("engineers").update({"status": status}).eq("id", engineer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return result.data[0]

@app.put("/api/engineers/{engineer_id}/location")
def update_engineer_location(engineer_id: int, location: str):
    result = db("engineers").update({"location": location}).eq("id", engineer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return result.data[0]

@app.delete("/api/engineers/{engineer_id}")
def delete_engineer(engineer_id: int):
    db("engineers").delete().eq("id", engineer_id).execute()
    return {"ok": True}


# ===== 접수 관리 =====

@app.get("/api/receptions")
def get_receptions(status: Optional[str] = None):
    q = db("receptions").select("*").order("received_at", desc=True)
    if status:
        q = db("receptions").select("*").eq("status", status).order("received_at", desc=True)
    return q.execute().data

@app.get("/api/receptions/{reception_id}")
def get_reception(reception_id: int):
    result = db("receptions").select("*").eq("id", reception_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    return result.data[0]

@app.post("/api/receptions")
def create_reception(body: ReceptionCreate):
    d = body.model_dump()
    d["status"] = "new"
    d["received_at"] = datetime.now().isoformat()
    result = db("receptions").insert(d).execute()
    return result.data[0]

@app.put("/api/receptions/{reception_id}/assign")
def assign_reception(reception_id: int, engineer_id: int):
    result = db("receptions").update({
        "assigned_engineer_id": engineer_id,
        "status": "assigned",
        "assigned_at": datetime.now().isoformat()
    }).eq("id", reception_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    return result.data[0]

@app.put("/api/receptions/{reception_id}/status")
def update_reception_status(reception_id: int, status: str):
    upd = {"status": status}
    if status == "completed":
        upd["completed_at"] = datetime.now().isoformat()
    result = db("receptions").update(upd).eq("id", reception_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="접수를 찾을 수 없습니다")
    return result.data[0]

@app.delete("/api/receptions/{reception_id}")
def delete_reception(reception_id: int):
    db("receptions").delete().eq("id", reception_id).execute()
    return {"ok": True}


# ===== 작업 이력 =====

@app.get("/api/jobs")
def get_jobs(engineer_id: Optional[int] = None, status: Optional[str] = None):
    q = db("jobs").select("*").order("id")
    if engineer_id and status:
        q = db("jobs").select("*").eq("engineer_id", engineer_id).eq("status", status).order("id")
    elif engineer_id:
        q = db("jobs").select("*").eq("engineer_id", engineer_id).order("id")
    elif status:
        q = db("jobs").select("*").eq("status", status).order("id")
    return q.execute().data

@app.get("/api/jobs/{job_id}")
def get_job(job_id: int):
    result = db("jobs").select("*").eq("id", job_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return result.data[0]

@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, body: JobUpdate):
    d = body.model_dump(exclude_none=True)
    if not d:
        return get_job(job_id)
    if d.get("status") == "completed":
        d["completed_at"] = datetime.now().isoformat()
    result = db("jobs").update(d).eq("id", job_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return result.data[0]


# ===== 판매 관리 =====

@app.get("/api/sales")
def get_sales(paid: Optional[bool] = None):
    if paid is not None:
        return db("sales").select("*").eq("paid", paid).order("id").execute().data
    return db("sales").select("*").order("id").execute().data

@app.post("/api/sales")
def create_sale(body: SaleCreate):
    d = body.model_dump()
    d["paid"] = False
    result = db("sales").insert(d).execute()
    return result.data[0]

@app.put("/api/sales/{sale_id}/pay")
def mark_sale_paid(sale_id: int):
    result = db("sales").update({"paid": True}).eq("id", sale_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="판매를 찾을 수 없습니다")
    return result.data[0]

@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: int):
    db("sales").delete().eq("id", sale_id).execute()
    return {"ok": True}


# ===== 재고 관리 =====

@app.get("/api/inventory")
def get_inventory():
    return db("inventory").select("*").order("id").execute().data

@app.post("/api/inventory")
def create_inventory(body: InventoryCreate):
    result = db("inventory").insert(body.model_dump()).execute()
    return result.data[0]

@app.put("/api/inventory/{inventory_id}")
def update_inventory(inventory_id: int, body: InventoryUpdate):
    d = body.model_dump(exclude_none=True)
    if not d:
        return get_inventory()
    result = db("inventory").update(d).eq("id", inventory_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="재고를 찾을 수 없습니다")
    return result.data[0]

@app.delete("/api/inventory/{inventory_id}")
def delete_inventory(inventory_id: int):
    db("inventory").delete().eq("id", inventory_id).execute()
    return {"ok": True}


# ===== 네트워크 장비 관리 =====

@app.get("/api/network-devices")
def get_network_devices(customer_id: Optional[int] = None, device_type: Optional[str] = None):
    q = db("network_devices").select("*").order("id")
    if customer_id and device_type:
        q = db("network_devices").select("*").eq("customer_id", customer_id).eq("device_type", device_type).order("id")
    elif customer_id:
        q = db("network_devices").select("*").eq("customer_id", customer_id).order("id")
    elif device_type:
        q = db("network_devices").select("*").eq("device_type", device_type).order("id")
    return q.execute().data

@app.get("/api/network-devices/{device_id}")
def get_network_device(device_id: int):
    result = db("network_devices").select("*").eq("id", device_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    return result.data[0]

@app.post("/api/network-devices")
def create_network_device(body: NetworkDeviceCreate):
    result = db("network_devices").insert(body.model_dump()).execute()
    return result.data[0]

@app.put("/api/network-devices/{device_id}")
def update_network_device(device_id: int, body: NetworkDeviceCreate):
    d = body.model_dump(exclude_none=True)
    result = db("network_devices").update(d).eq("id", device_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
    return result.data[0]

@app.delete("/api/network-devices/{device_id}")
def delete_network_device(device_id: int):
    db("network_devices").delete().eq("id", device_id).execute()
    return {"ok": True}


# ===== 결제 관리 =====

@app.get("/api/payments")
def get_payments(status: Optional[str] = None):
    if status:
        return db("payments").select("*").eq("payment_status", status).order("id").execute().data
    return db("payments").select("*").order("id").execute().data

@app.post("/api/payments")
def create_payment(body: PaymentCreate):
    d = body.model_dump()
    d["payment_status"] = "pending"
    result = db("payments").insert(d).execute()
    return result.data[0]

@app.put("/api/payments/{payment_id}/complete")
def complete_payment(payment_id: int):
    result = db("payments").update({
        "payment_status": "completed",
        "paid_at": datetime.now().isoformat()
    }).eq("id", payment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="결제를 찾을 수 없습니다")
    return result.data[0]


# ===== 대시보드 =====

@app.get("/api/dashboard")
def get_dashboard():
    today = datetime.now().date().isoformat()
    receptions = db("receptions").select("*").execute().data
    customers = db("customers").select("id,outstanding_amount").execute().data
    inventory = db("inventory").select("id,quantity,reorder_level").execute().data
    engineers = db("engineers").select("*").order("id").execute().data

    today_receptions = [r for r in receptions if (r.get("received_at") or "")[:10] == today]
    return {
        "today_new": len([r for r in today_receptions if r["status"] == "new"]),
        "assigned_pending": len([r for r in receptions if r["status"] == "assigned"]),
        "in_progress": len([r for r in receptions if r["status"] == "in_progress"]),
        "completed_today": len([r for r in today_receptions if r["status"] == "completed"]),
        "total_outstanding": sum(c.get("outstanding_amount", 0) or 0 for c in customers),
        "low_stock_count": len([i for i in inventory if i["quantity"] <= i["reorder_level"]]),
        "engineers": engineers,
        "pending_receptions": [r for r in receptions if r["status"] in ["new", "assigned"]],
    }


# ===== 통계 =====

@app.get("/api/stats")
def get_stats():
    receptions = db("receptions").select("*").execute().data
    jobs = db("jobs").select("*").execute().data
    sales = db("sales").select("*").execute().data
    customers = db("customers").select("id,outstanding_amount").execute().data
    engineers = db("engineers").select("*").order("id").execute().data
    inventory = db("inventory").select("*").execute().data

    completed_jobs = [j for j in jobs if j["status"] == "completed"]
    repair_rev = sum(j.get("total_cost", 0) or 0 for j in completed_jobs)
    sales_rev = sum(s.get("total_price", 0) or 0 for s in sales if s.get("paid"))

    channel_counts = {}
    for r in receptions:
        ch = r.get("reception_channel", "unknown")
        channel_counts[ch] = channel_counts.get(ch, 0) + 1

    engineer_stats = []
    for e in engineers:
        e_jobs = [j for j in jobs if j.get("engineer_id") == e["id"]]
        e_rev = sum(j.get("total_cost", 0) or 0 for j in e_jobs if j["status"] == "completed")
        engineer_stats.append({
            "id": e["id"], "name": e["name"],
            "total_jobs": len(e_jobs),
            "completed_jobs": len([j for j in e_jobs if j["status"] == "completed"]),
            "revenue": e_rev,
        })

    return {
        "total_customers": len(customers),
        "total_receptions": len(receptions),
        "completed_jobs": len(completed_jobs),
        "repair_revenue": repair_rev,
        "sales_revenue": sales_rev,
        "total_revenue": repair_rev + sales_rev,
        "total_outstanding": sum(c.get("outstanding_amount", 0) or 0 for c in customers),
        "channel_counts": channel_counts,
        "engineer_stats": engineer_stats,
        "inventory_low_stock": [i for i in inventory if i["quantity"] <= i["reorder_level"]],
    }


# ===== 전화 수신 (CTI) =====

@app.post("/api/incoming-call")
def incoming_call(phone: str):
    clean = normalize_phone(phone)
    customers = db("customers").select("*").execute().data
    matched = next(
        (c for c in customers if normalize_phone(c.get("phone","")) == clean or normalize_phone(c.get("phone2","") or "") == clean),
        None
    )
    recent = []
    if matched:
        recent = db("receptions").select("*").eq("customer_id", matched["id"]).order("received_at", desc=True).limit(3).execute().data

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
    customers = db("customers").select("*").execute().data
    matched = next(
        (c for c in customers if normalize_phone(c.get("phone","")) == clean or normalize_phone(c.get("phone2","") or "") == clean),
        None
    )
    recent = []
    if matched:
        recent = db("receptions").select("*").eq("customer_id", matched["id"]).order("received_at", desc=True).limit(3).execute().data

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
