import { useState } from 'react'
import Modal from '../components/Modal'
import { createComputer, updateComputer, deleteComputer } from '../api'

const DEVICE_TYPES = {
  desktop: '데스크톱', laptop: '노트북', server: '서버', printer: '프린터', other: '기타',
}

// 장비 종류별 표시할 필드 범위
const TYPE_CONFIG = {
  desktop: { showHW: true,  showPower: true,  powerLabel: '파워 (모델명/와트)', showAssembled: true,  showSW: true,  showNet: true  },
  laptop:  { showHW: true,  showPower: true,  powerLabel: '어댑터 (출력/모델)',  showAssembled: false, showSW: true,  showNet: true  },
  server:  { showHW: true,  showPower: true,  powerLabel: '파워 (모델명/와트)', showAssembled: false, showSW: true,  showNet: true  },
  printer: { showHW: false, showPower: false, powerLabel: '',                   showAssembled: false, showSW: false, showNet: false },
  other:   { showHW: false, showPower: false, powerLabel: '',                   showAssembled: false, showSW: false, showNet: false },
}

const EMPTY = {
  customer_id: '', name: '', device_type: 'desktop',
  cpu: '', ram: '', ssd: '', hdd: '', motherboard: '', gpu: '',
  os: '', os_version: '', office_version: '', antivirus: '',
  ip_address: '', mac_address: '', serial_number: '', assembled: false,
  power: '', purchase_date: '', warranty_expiry: '', printer: '', monitor: '',
  // NAS
  nas_name: '', nas_model: '', nas_ip: '', nas_hdd_count: '', nas_hdd_detail: '',
  nas_total_capacity: '', nas_partition_info: '', nas_maintenance_period: '', nas_maintenance_notes: '',
  nas_admin_id: '', nas_admin_password: '',
  // 공유기
  router_name: '', router_model: '', router_ip: '', router_admin_id: '', router_admin_password: '',
  notes: '',
}

function ClientEquipment({ computers, networkDevices, customers, loading, onRefresh }) {
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const getCustomerName = (id) => customers.find(c => c.id === id)?.name || `고객 ${id}`

  const filtered = computers.filter(c => {
    if (filterCustomer && String(c.customer_id) !== filterCustomer) return false
    if (filterType && c.device_type !== filterType) return false
    return true
  })

  const openAdd = () => { setForm(EMPTY); setShowAdd(true) }
  const openEdit = (c) => { setForm({ ...c }); setSelected(c); setShowEdit(true) }

  const handleSave = async () => {
    if (!form.customer_id) return alert('고객을 선택하세요')
    if (!form.name) return alert('장비명을 입력하세요')
    await createComputer({ ...form, customer_id: Number(form.customer_id), nas_hdd_count: form.nas_hdd_count ? Number(form.nas_hdd_count) : null })
    setShowAdd(false)
    onRefresh()
  }

  const handleUpdate = async () => {
    await updateComputer(selected.id, { ...form, customer_id: Number(form.customer_id), nas_hdd_count: form.nas_hdd_count ? Number(form.nas_hdd_count) : null })
    setShowEdit(false)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 장비를 삭제하시겠습니까?')) return
    await deleteComputer(id)
    setSelected(null)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const hasNas = (c) => c.nas_name || c.nas_ip
  const hasRouter = (c) => c.router_name || c.router_ip

  return (
    <div>
      <div className="page-header">
        <h2>거래처 장비 ({computers.length}대)</h2>
        <button className="btn" onClick={openAdd}>+ 장비 등록</button>
      </div>

      <div className="filter-bar">
        <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid var(--gray-300)', fontSize: 13 }}>
          <option value="">전체 고객</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid var(--gray-300)', fontSize: 13 }}>
          <option value="">전체 장비</option>
          {Object.entries(DEVICE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className={selected ? 'split-layout' : ''}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>고객</th>
                <th>장비 종류</th>
                <th>장비명</th>
                <th>CPU</th>
                <th>RAM</th>
                <th>OS</th>
                <th>NAS</th>
                <th>공유기</th>
                <th>보증만료</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="empty-state">등록된 장비가 없습니다</td></tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  style={{ cursor: 'pointer', background: selected?.id === c.id ? '#e3f2fd' : '' }}
                >
                  <td><strong>{getCustomerName(c.customer_id)}</strong></td>
                  <td><span className="badge new" style={{ fontSize: 11 }}>{DEVICE_TYPES[c.device_type] || c.device_type}</span></td>
                  <td>{c.name || '-'}</td>
                  <td style={{ fontSize: 12 }}>{c.cpu || '-'}</td>
                  <td style={{ fontSize: 12 }}>{c.ram || '-'}</td>
                  <td style={{ fontSize: 12 }}>{c.os || '-'}</td>
                  <td style={{ fontSize: 12 }}>
                    {hasNas(c) ? <span className="badge in_progress" style={{ fontSize: 10 }}>NAS</span> : <span style={{ color: 'var(--gray-300)' }}>-</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {hasRouter(c) ? <span className="badge assigned" style={{ fontSize: 10 }}>공유기</span> : <span style={{ color: 'var(--gray-300)' }}>-</span>}
                  </td>
                  <td style={{ fontSize: 12, color: isExpired(c.warranty_expiry) ? 'var(--danger)' : '' }}>{c.warranty_expiry || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="detail-panel">
            <h3>
              {selected.name || '장비 상세'}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(selected)}>수정</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>삭제</button>
              </div>
            </h3>

            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge new">{DEVICE_TYPES[selected.device_type] || selected.device_type}</span>
              <span>고객: <strong>{getCustomerName(selected.customer_id)}</strong></span>
            </div>

            <DetailSection title="컴퓨터" rows={[
              ['CPU', selected.cpu], ['RAM', selected.ram], ['SSD', selected.ssd], ['HDD', selected.hdd],
              ['파워', selected.power], ['메인보드', selected.motherboard], ['GPU', selected.gpu],
              ['OS', selected.os], ['Office', selected.office_version], ['백신', selected.antivirus],
              ['IP', selected.ip_address], ['MAC', selected.mac_address],
              ['시리얼번호', selected.serial_number], ['프린터', selected.printer], ['모니터', selected.monitor],
              ['구입일', selected.purchase_date], ['보증만료', selected.warranty_expiry],
              ['조립여부', selected.assembled ? '조립PC' : '완제품'],
            ]} />

            {hasNas(selected) && (
              <DetailSection title="NAS" rows={[
                ['이름', selected.nas_name], ['모델', selected.nas_model], ['IP', selected.nas_ip],
                ['HDD 개수', selected.nas_hdd_count ? `${selected.nas_hdd_count}개` : null],
                ['HDD 상세', selected.nas_hdd_detail], ['총 용량', selected.nas_total_capacity],
                ['파티션', selected.nas_partition_info],
                ['유지보수 주기', selected.nas_maintenance_period], ['유지보수 내용', selected.nas_maintenance_notes],
                ['관리자 ID', selected.nas_admin_id], ['관리자 PW', selected.nas_admin_password],
              ]} mono={['관리자 ID', '관리자 PW']} />
            )}

            {hasRouter(selected) && (
              <DetailSection title="공유기" rows={[
                ['이름', selected.router_name], ['모델', selected.router_model], ['IP', selected.router_ip],
                ['관리자 ID', selected.router_admin_id], ['관리자 PW', selected.router_admin_password],
              ]} mono={['관리자 ID', '관리자 PW']} />
            )}

            {selected.notes && (
              <div className="detail-row" style={{ marginTop: 8 }}>
                <span className="detail-label">메모</span>
                <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{selected.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {(showAdd || showEdit) && (
        <Modal title={showAdd ? '장비 등록' : '장비 수정'} onClose={() => { setShowAdd(false); setShowEdit(false) }} wide>
          <EquipmentForm form={form} set={set} customers={customers} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setShowEdit(false) }}>취소</button>
            <button className="btn" onClick={showAdd ? handleSave : handleUpdate}>저장</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DetailSection({ title, rows, mono = [] }) {
  const filled = rows.filter(([, val]) => val)
  if (!filled.length) return null
  return (
    <>
      <div style={{ margin: '12px 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-200)', paddingTop: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
      {filled.map(([label, val]) => (
        <div className="detail-row" key={label}>
          <span className="detail-label">{label}</span>
          <span className="detail-value" style={{ fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: mono.includes(label) ? 'monospace' : undefined }}>{val}</span>
        </div>
      ))}
    </>
  )
}

function EquipmentForm({ form, set, customers }) {
  const type = form.device_type || 'desktop'
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other
  const isPrinter = type === 'printer'

  return (
    <>
      {/* 기본 정보 */}
      <div className="form-row">
        <div className="form-group">
          <label>고객 *</label>
          <select value={form.customer_id || ''} onChange={set('customer_id')}>
            <option value="">선택</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>장비 종류 *</label>
          <select value={type} onChange={set('device_type')}>
            <option value="desktop">데스크톱</option>
            <option value="laptop">노트북</option>
            <option value="server">서버</option>
            <option value="printer">프린터</option>
            <option value="other">기타</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>장비명 *</label>
          <input value={form.name || ''} onChange={set('name')} placeholder={isPrinter ? '사무용 프린터' : '사무용 PC'} />
        </div>
        <div className="form-group">
          <label>시리얼번호</label>
          <input value={form.serial_number || ''} onChange={set('serial_number')} />
        </div>
      </div>

      {/* 프린터 전용 */}
      {isPrinter && <>
        <FormSection label="프린터 정보" />
        <div className="form-row">
          <div className="form-group"><label>모델명</label><input value={form.cpu || ''} onChange={set('cpu')} placeholder="HP LaserJet Pro M404dn" /></div>
          <div className="form-group">
            <label>연결 방식</label>
            <select value={form.ip_address || ''} onChange={set('ip_address')}>
              <option value="">선택</option>
              <option value="USB">USB</option>
              <option value="유선 네트워크">유선 네트워크</option>
              <option value="WiFi">WiFi</option>
              <option value="USB + 네트워크">USB + 네트워크</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>프린터 IP</label><input value={form.mac_address || ''} onChange={set('mac_address')} placeholder="192.168.1.x (네트워크 연결 시)" /></div>
          <div className="form-group"><label>구입일</label><input type="date" value={form.purchase_date || ''} onChange={set('purchase_date')} /></div>
        </div>
      </>}

      {/* 기타 전용 */}
      {type === 'other' && <>
        <FormSection label="장비 정보" />
        <div className="form-row">
          <div className="form-group"><label>모델명</label><input value={form.cpu || ''} onChange={set('cpu')} /></div>
          <div className="form-group"><label>구입일</label><input type="date" value={form.purchase_date || ''} onChange={set('purchase_date')} /></div>
        </div>
      </>}

      {/* PC 계열 (데스크톱 / 노트북 / 서버) */}
      {cfg.showHW && <>
        <FormSection label="하드웨어" />
        <div className="form-row">
          <div className="form-group"><label>CPU</label><input value={form.cpu || ''} onChange={set('cpu')} placeholder="Intel i5-12400" /></div>
          <div className="form-group"><label>RAM</label><input value={form.ram || ''} onChange={set('ram')} placeholder="16GB DDR4" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>SSD</label><input value={form.ssd || ''} onChange={set('ssd')} placeholder="Samsung 500GB" /></div>
          <div className="form-group"><label>HDD</label><input value={form.hdd || ''} onChange={set('hdd')} placeholder="WD 1TB (없으면 빈칸)" /></div>
        </div>
        {type !== 'laptop' && (
          <div className="form-row">
            <div className="form-group"><label>메인보드</label><input value={form.motherboard || ''} onChange={set('motherboard')} /></div>
            <div className="form-group"><label>GPU</label><input value={form.gpu || ''} onChange={set('gpu')} placeholder="없으면 빈칸" /></div>
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label>{cfg.powerLabel}</label>
            <input value={form.power || ''} onChange={set('power')} placeholder={type === 'laptop' ? '65W, 삼성 45W USB-C 등' : '시소닉 650W 등'} />
          </div>
          {cfg.showAssembled && (
            <div className="form-group" style={{ justifyContent: 'center' }}>
              <label>조립 PC</label>
              <input type="checkbox" checked={form.assembled || false} onChange={set('assembled')} style={{ width: 18, height: 18, marginTop: 4 }} />
            </div>
          )}
        </div>

        <FormSection label="소프트웨어" />
        <div className="form-row">
          <div className="form-group">
            <label>OS</label>
            <select value={form.os || ''} onChange={set('os')}>
              <option value="">선택</option>
              <option>Windows 11</option>
              <option>Windows 10</option>
              <option>Windows Server 2022</option>
              <option>Windows Server 2019</option>
            </select>
          </div>
          <div className="form-group"><label>OS 버전</label><input value={form.os_version || ''} onChange={set('os_version')} placeholder="22H2" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>백신</label><input value={form.antivirus || ''} onChange={set('antivirus')} placeholder="V3, 알약 등" /></div>
          <div className="form-group"><label>Office 버전</label><input value={form.office_version || ''} onChange={set('office_version')} placeholder="Office 2021" /></div>
        </div>

        <FormSection label="네트워크 / 기타" />
        <div className="form-row">
          <div className="form-group"><label>IP 주소</label><input value={form.ip_address || ''} onChange={set('ip_address')} /></div>
          <div className="form-group"><label>MAC 주소</label><input value={form.mac_address || ''} onChange={set('mac_address')} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>프린터</label><input value={form.printer || ''} onChange={set('printer')} placeholder="HP LaserJet 등" /></div>
          <div className="form-group"><label>모니터</label><input value={form.monitor || ''} onChange={set('monitor')} placeholder="삼성 24인치 등" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>구입일</label><input type="date" value={form.purchase_date || ''} onChange={set('purchase_date')} /></div>
          <div className="form-group"><label>보증만료일</label><input type="date" value={form.warranty_expiry || ''} onChange={set('warranty_expiry')} /></div>
        </div>

        {/* NAS */}
        <FormSection label="NAS (없으면 빈칸)" />
        <div className="form-row">
          <div className="form-group"><label>NAS 이름</label><input value={form.nas_name || ''} onChange={set('nas_name')} placeholder="사무실 NAS" /></div>
          <div className="form-group"><label>모델</label><input value={form.nas_model || ''} onChange={set('nas_model')} placeholder="Synology DS923+" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>NAS IP</label><input value={form.nas_ip || ''} onChange={set('nas_ip')} placeholder="192.168.1.200" /></div>
          <div className="form-group"><label>HDD 개수</label><input type="number" min="0" value={form.nas_hdd_count || ''} onChange={set('nas_hdd_count')} placeholder="4" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>총 용량</label><input value={form.nas_total_capacity || ''} onChange={set('nas_total_capacity')} placeholder="16TB" /></div>
          <div className="form-group"><label>유지보수 주기</label><input value={form.nas_maintenance_period || ''} onChange={set('nas_maintenance_period')} placeholder="6개월마다" /></div>
        </div>
        <div className="form-group">
          <label>HDD 상세 (슬롯별)</label>
          <textarea value={form.nas_hdd_detail || ''} onChange={set('nas_hdd_detail')} placeholder="슬롯1: WD Red 4TB&#10;슬롯2: Seagate 4TB" rows={2} />
        </div>
        <div className="form-group">
          <label>파티션 / 볼륨 정보</label>
          <textarea value={form.nas_partition_info || ''} onChange={set('nas_partition_info')} placeholder="볼륨1: SHR 12TB - 공유폴더" rows={2} />
        </div>
        <div className="form-group">
          <label>유지보수 내용</label>
          <textarea value={form.nas_maintenance_notes || ''} onChange={set('nas_maintenance_notes')} placeholder="HDD 점검, 펌웨어 업데이트 등" rows={2} />
        </div>
        <div className="form-row">
          <div className="form-group"><label>NAS 관리자 ID</label><input value={form.nas_admin_id || ''} onChange={set('nas_admin_id')} placeholder="admin" /></div>
          <div className="form-group"><label>NAS 관리자 PW</label><input value={form.nas_admin_password || ''} onChange={set('nas_admin_password')} /></div>
        </div>

        {/* 공유기 */}
        <FormSection label="공유기 (없으면 빈칸)" />
        <div className="form-row">
          <div className="form-group"><label>공유기 이름</label><input value={form.router_name || ''} onChange={set('router_name')} placeholder="사무실 공유기" /></div>
          <div className="form-group"><label>모델</label><input value={form.router_model || ''} onChange={set('router_model')} placeholder="ipTIME A3004NS" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>공유기 IP</label><input value={form.router_ip || ''} onChange={set('router_ip')} placeholder="192.168.0.1" /></div>
          <div className="form-group"></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>관리자 ID</label><input value={form.router_admin_id || ''} onChange={set('router_admin_id')} placeholder="admin" /></div>
          <div className="form-group"><label>관리자 PW</label><input value={form.router_admin_password || ''} onChange={set('router_admin_password')} /></div>
        </div>
      </>}

      <div className="form-group" style={{ marginTop: 8 }}>
        <label>메모</label>
        <textarea value={form.notes || ''} onChange={set('notes')} placeholder="특이사항 등" />
      </div>
    </>
  )
}

function FormSection({ label }) {
  return (
    <div style={{ margin: '12px 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', borderTop: '1px solid var(--gray-200)', paddingTop: 10 }}>
      {label}
    </div>
  )
}

function isExpired(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

export default ClientEquipment
