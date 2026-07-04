import { useState } from 'react'
import Modal from '../components/Modal'
import { createCustomer, updateCustomer, deleteCustomer, createComputer, updateComputer, deleteComputer } from '../api'

const DEVICE_TYPES = {
  desktop: '데스크톱', laptop: '노트북', server: '서버', printer: '프린터', other: '기타',
}

const TYPE_CONFIG = {
  desktop: { showHW: true,  showPower: true,  powerLabel: '파워 (모델명/와트)', showAssembled: true,  showSW: true,  showNet: true  },
  laptop:  { showHW: true,  showPower: true,  powerLabel: '어댑터 (출력/모델)',  showAssembled: false, showSW: true,  showNet: true  },
  server:  { showHW: true,  showPower: true,  powerLabel: '파워 (모델명/와트)', showAssembled: false, showSW: true,  showNet: true  },
  printer: { showHW: false, showPower: false, powerLabel: '',                   showAssembled: false, showSW: false, showNet: false },
  other:   { showHW: false, showPower: false, powerLabel: '',                   showAssembled: false, showSW: false, showNet: false },
}

const EMPTY_CUSTOMER = { name: '', customer_type: 'personal', company_name: '', contact_person: '', phone: '', phone2: '', email: '', address: '', address_detail: '', memo: '' }

const EMPTY_COMPUTER = {
  customer_id: '', name: '', device_type: 'desktop',
  cpu: '', ram: '', ssd: '', hdd: '', motherboard: '', gpu: '',
  os: '', os_version: '', office_version: '', antivirus: '',
  ip_address: '', mac_address: '', serial_number: '', assembled: false,
  power: '', purchase_date: '', warranty_expiry: '', printer: '', monitor: '',
  nas_name: '', nas_model: '', nas_ip: '', nas_hdd_count: '', nas_hdd_detail: '',
  nas_total_capacity: '', nas_partition_info: '', nas_maintenance_period: '', nas_maintenance_notes: '',
  nas_admin_id: '', nas_admin_password: '',
  router_name: '', router_model: '', router_ip: '', router_admin_id: '', router_admin_password: '',
  notes: '',
}

function Customers({ customers, computers, loading, onRefresh }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selected, setSelected] = useState(null)
  const [detailTab, setDetailTab] = useState('info')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState(EMPTY_CUSTOMER)

  const [selectedComputer, setSelectedComputer] = useState(null)
  const [showAddComputer, setShowAddComputer] = useState(false)
  const [showEditComputer, setShowEditComputer] = useState(false)
  const [computerForm, setComputerForm] = useState(EMPTY_COMPUTER)

  const filtered = customers.filter(c => {
    const matchSearch = c.name.includes(search) || (c.phone && c.phone.includes(search)) || (c.company_name && c.company_name.includes(search))
    const matchType = filterType === 'all' || c.customer_type === filterType
    return matchSearch && matchType
  })

  const customerComputers = selected ? (computers || []).filter(c => c.customer_id === selected.id) : []

  const selectCustomer = (c) => {
    setSelected(selected?.id === c.id ? null : c)
    setSelectedComputer(null)
    setDetailTab('info')
  }

  const openAdd = () => { setForm(EMPTY_CUSTOMER); setShowAdd(true) }
  const openEdit = (c) => { setForm({ ...c }); setShowEdit(true) }

  const handleSave = async () => {
    await createCustomer(form)
    setShowAdd(false)
    onRefresh()
  }

  const handleUpdate = async () => {
    await updateCustomer(selected.id, form)
    setShowEdit(false)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 고객을 삭제하시겠습니까?')) return
    await deleteCustomer(id)
    setSelected(null)
    onRefresh()
  }

  const openAddComputer = () => {
    setComputerForm({ ...EMPTY_COMPUTER, customer_id: selected.id })
    setShowAddComputer(true)
  }

  const openEditComputer = (c) => {
    setSelectedComputer(c)
    setComputerForm({ ...c })
    setShowEditComputer(true)
  }

  const handleSaveComputer = async () => {
    await createComputer({ ...computerForm, customer_id: Number(computerForm.customer_id), nas_hdd_count: computerForm.nas_hdd_count ? Number(computerForm.nas_hdd_count) : null })
    setShowAddComputer(false)
    onRefresh()
  }

  const handleUpdateComputer = async () => {
    await updateComputer(selectedComputer.id, { ...computerForm, customer_id: Number(computerForm.customer_id), nas_hdd_count: computerForm.nas_hdd_count ? Number(computerForm.nas_hdd_count) : null })
    setShowEditComputer(false)
    onRefresh()
  }

  const handleDeleteComputer = async (id) => {
    if (!confirm('이 장비를 삭제하시겠습니까?')) return
    await deleteComputer(id)
    setSelectedComputer(null)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const setC = (k) => (e) => setComputerForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  if (loading && !customers.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>고객 관리 ({customers.length}명)</h2>
        <button className="btn" onClick={openAdd}>+ 고객 추가</button>
      </div>

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="이름, 회사명, 전화번호 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={`filter-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>전체 ({customers.length})</button>
        <button className={`filter-btn ${filterType === 'personal' ? 'active' : ''}`} onClick={() => setFilterType('personal')}>개인 ({customers.filter(c => c.customer_type === 'personal').length})</button>
        <button className={`filter-btn ${filterType === 'business' ? 'active' : ''}`} onClick={() => setFilterType('business')}>기업 ({customers.filter(c => c.customer_type === 'business').length})</button>
      </div>

      <div className={selected ? 'split-layout' : ''}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>구분</th>
                <th>명칭 / 식별명</th>
                <th>회사명</th>
                <th>전화</th>
                <th>주소</th>
                <th>미수금</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="empty-state">고객이 없습니다</td></tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  style={{ cursor: 'pointer', background: selected?.id === c.id ? '#e3f2fd' : '' }}
                >
                  <td>
                    <span className={`badge ${c.customer_type === 'business' ? 'assigned' : 'new'}`}>
                      {c.customer_type === 'business' ? '기업' : '개인'}
                    </span>
                  </td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.company_name || <span style={{ color: 'var(--gray-300)' }}>-</span>}</td>
                  <td>{c.phone}</td>
                  <td>{c.address || '-'}</td>
                  <td>
                    {c.outstanding_amount > 0
                      ? <span className="outstanding">₩{c.outstanding_amount.toLocaleString()}</span>
                      : <span style={{ color: 'var(--gray-400)' }}>없음</span>
                    }
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '12px' }}>{c.memo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="detail-panel">
            <h3>
              {selected.name}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(selected)}>수정</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>삭제</button>
              </div>
            </h3>

            {/* 탭 */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid var(--gray-200)' }}>
              {[['info', '기본 정보'], ['equipment', `장비 (${customerComputers.length})`]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setDetailTab(id)}
                  style={{
                    padding: '6px 14px', fontSize: 13, fontWeight: detailTab === id ? 700 : 400,
                    border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: detailTab === id ? '2px solid var(--primary)' : '2px solid transparent',
                    color: detailTab === id ? 'var(--primary)' : 'var(--gray-500)',
                    marginBottom: -2,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {detailTab === 'info' && (
              <>
                <div className="detail-row">
                  <span className="detail-label">구분</span>
                  <span className="detail-value">
                    <span className={`badge ${selected.customer_type === 'business' ? 'assigned' : 'new'}`}>
                      {selected.customer_type === 'business' ? '기업' : '개인'}
                    </span>
                  </span>
                </div>
                {selected.company_name && <div className="detail-row"><span className="detail-label">회사명</span><span className="detail-value">{selected.company_name}</span></div>}
                {selected.contact_person && <div className="detail-row"><span className="detail-label">담당자</span><span className="detail-value">{selected.contact_person}</span></div>}
                <div className="detail-row"><span className="detail-label">전화</span><span className="detail-value">{selected.phone}</span></div>
                {selected.phone2 && <div className="detail-row"><span className="detail-label">보조전화</span><span className="detail-value">{selected.phone2}</span></div>}
                {selected.email && <div className="detail-row"><span className="detail-label">이메일</span><span className="detail-value">{selected.email}</span></div>}
                <div className="detail-row"><span className="detail-label">주소</span><span className="detail-value">{selected.address || '-'} {selected.address_detail || ''}</span></div>
                <div className="detail-row">
                  <span className="detail-label">미수금</span>
                  <span className={`detail-value ${selected.outstanding_amount > 0 ? 'outstanding' : ''}`}>
                    {selected.outstanding_amount > 0 ? `₩${selected.outstanding_amount.toLocaleString()}` : '없음'}
                  </span>
                </div>
                {selected.memo && <div className="detail-row"><span className="detail-label">메모</span><span className="detail-value">{selected.memo}</span></div>}
                <div className="detail-row"><span className="detail-label">등록일</span><span className="detail-value">{selected.created_at?.slice(0, 10)}</span></div>
              </>
            )}

            {detailTab === 'equipment' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button className="btn btn-sm" onClick={openAddComputer}>+ 장비 추가</button>
                </div>
                {customerComputers.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--gray-400)' }}>등록된 장비가 없습니다</div>
                ) : (
                  customerComputers.map(comp => (
                    <div
                      key={comp.id}
                      style={{
                        padding: '10px 12px', marginBottom: 6, borderRadius: 8,
                        border: '1px solid var(--gray-200)', cursor: 'pointer',
                        background: selectedComputer?.id === comp.id ? '#e3f2fd' : 'white',
                      }}
                      onClick={() => setSelectedComputer(selectedComputer?.id === comp.id ? null : comp)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="badge new" style={{ fontSize: 10, marginRight: 6 }}>{DEVICE_TYPES[comp.device_type] || comp.device_type}</span>
                          <strong style={{ fontSize: 13 }}>{comp.name || '(이름 없음)'}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); openEditComputer(comp) }}>수정</button>
                          <button className="btn btn-sm btn-danger" style={{ padding: '2px 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); handleDeleteComputer(comp.id) }}>삭제</button>
                        </div>
                      </div>
                      {selectedComputer?.id === comp.id && (
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-600)' }}>
                          <ComputerDetail comp={comp} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="고객 추가" onClose={() => setShowAdd(false)}>
          <CustomerForm form={form} set={set} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn" onClick={handleSave}>저장</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="고객 수정" onClose={() => setShowEdit(false)}>
          <CustomerForm form={form} set={set} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>취소</button>
            <button className="btn" onClick={handleUpdate}>저장</button>
          </div>
        </Modal>
      )}

      {(showAddComputer || showEditComputer) && (
        <Modal title={showAddComputer ? '장비 추가' : '장비 수정'} onClose={() => { setShowAddComputer(false); setShowEditComputer(false) }} wide>
          <EquipmentForm form={computerForm} set={setC} customers={customers} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowAddComputer(false); setShowEditComputer(false) }}>취소</button>
            <button className="btn" onClick={showAddComputer ? handleSaveComputer : handleUpdateComputer}>저장</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ComputerDetail({ comp }) {
  const rows = [
    ['CPU', comp.cpu], ['RAM', comp.ram], ['SSD', comp.ssd], ['HDD', comp.hdd],
    ['OS', comp.os], ['Office', comp.office_version], ['백신', comp.antivirus],
    ['IP', comp.ip_address], ['시리얼', comp.serial_number],
    ['구입일', comp.purchase_date], ['보증만료', comp.warranty_expiry],
    ['NAS', comp.nas_name ? `${comp.nas_name} (${comp.nas_ip || '-'})` : null],
    ['공유기', comp.router_name ? `${comp.router_name} (${comp.router_ip || '-'})` : null],
    ['메모', comp.notes],
  ].filter(([, v]) => v)
  return rows.map(([k, v]) => (
    <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
      <span style={{ color: 'var(--gray-400)', minWidth: 60 }}>{k}</span>
      <span>{v}</span>
    </div>
  ))
}

function CustomerForm({ form, set }) {
  const isBusiness = form.customer_type === 'business'
  return (
    <>
      <div className="form-group">
        <label>고객 구분 *</label>
        <select value={form.customer_type || 'personal'} onChange={set('customer_type')}>
          <option value="personal">개인</option>
          <option value="business">기업</option>
        </select>
      </div>
      {isBusiness && (
        <div className="form-row">
          <div className="form-group">
            <label>회사명 *</label>
            <input value={form.company_name || ''} onChange={set('company_name')} placeholder="(주)홍길동기업" />
          </div>
          <div className="form-group">
            <label>담당자명</label>
            <input value={form.contact_person || ''} onChange={set('contact_person')} placeholder="홍길동" />
          </div>
        </div>
      )}
      <div className="form-row">
        <div className="form-group">
          <label>{isBusiness ? '담당자 / 식별명' : '고객명 / 식별명'} *</label>
          <input value={form.name || ''} onChange={set('name')} placeholder="이름, 별칭, 주소, 회사명 등 식별 가능한 것" />
        </div>
        <div className="form-group">
          <label>전화번호 *</label>
          <input value={form.phone || ''} onChange={set('phone')} placeholder="01012345678" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>보조 전화</label>
          <input value={form.phone2 || ''} onChange={set('phone2')} placeholder="선택" />
        </div>
        <div className="form-group">
          <label>이메일</label>
          <input value={form.email || ''} onChange={set('email')} placeholder="선택" />
        </div>
      </div>
      <div className="form-group">
        <label>주소</label>
        <input value={form.address || ''} onChange={set('address')} placeholder="서울시 강남구..." />
      </div>
      <div className="form-group">
        <label>상세주소</label>
        <input value={form.address_detail || ''} onChange={set('address_detail')} placeholder="101호..." />
      </div>
      <div className="form-group">
        <label>메모</label>
        <textarea value={form.memo || ''} onChange={set('memo')} placeholder="특이사항..." />
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

function EquipmentForm({ form, set, customers }) {
  const type = form.device_type || 'desktop'
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other
  const isPrinter = type === 'printer'

  return (
    <>
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
          <div className="form-group"><label>프린터 IP</label><input value={form.mac_address || ''} onChange={set('mac_address')} placeholder="192.168.1.x" /></div>
          <div className="form-group"><label>구입일</label><input type="date" value={form.purchase_date || ''} onChange={set('purchase_date')} /></div>
        </div>
      </>}

      {type === 'other' && <>
        <FormSection label="장비 정보" />
        <div className="form-row">
          <div className="form-group"><label>모델명</label><input value={form.cpu || ''} onChange={set('cpu')} /></div>
          <div className="form-group"><label>구입일</label><input type="date" value={form.purchase_date || ''} onChange={set('purchase_date')} /></div>
        </div>
      </>}

      {cfg.showHW && <>
        <FormSection label="하드웨어" />
        <div className="form-row">
          <div className="form-group"><label>CPU</label><input value={form.cpu || ''} onChange={set('cpu')} placeholder="Intel i5-12400" /></div>
          <div className="form-group"><label>RAM</label><input value={form.ram || ''} onChange={set('ram')} placeholder="16GB DDR4" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>SSD</label><input value={form.ssd || ''} onChange={set('ssd')} placeholder="Samsung 500GB" /></div>
          <div className="form-group"><label>HDD</label><input value={form.hdd || ''} onChange={set('hdd')} placeholder="WD 1TB" /></div>
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
            <input value={form.power || ''} onChange={set('power')} />
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
          <div className="form-group"><label>프린터</label><input value={form.printer || ''} onChange={set('printer')} /></div>
          <div className="form-group"><label>모니터</label><input value={form.monitor || ''} onChange={set('monitor')} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>구입일</label><input type="date" value={form.purchase_date || ''} onChange={set('purchase_date')} /></div>
          <div className="form-group"><label>보증만료일</label><input type="date" value={form.warranty_expiry || ''} onChange={set('warranty_expiry')} /></div>
        </div>

        <FormSection label="NAS (없으면 빈칸)" />
        <div className="form-row">
          <div className="form-group"><label>NAS 이름</label><input value={form.nas_name || ''} onChange={set('nas_name')} placeholder="사무실 NAS" /></div>
          <div className="form-group"><label>모델</label><input value={form.nas_model || ''} onChange={set('nas_model')} placeholder="Synology DS923+" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>NAS IP</label><input value={form.nas_ip || ''} onChange={set('nas_ip')} /></div>
          <div className="form-group"><label>HDD 개수</label><input type="number" min="0" value={form.nas_hdd_count || ''} onChange={set('nas_hdd_count')} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>총 용량</label><input value={form.nas_total_capacity || ''} onChange={set('nas_total_capacity')} /></div>
          <div className="form-group"><label>유지보수 주기</label><input value={form.nas_maintenance_period || ''} onChange={set('nas_maintenance_period')} /></div>
        </div>
        <div className="form-group">
          <label>HDD 상세</label>
          <textarea value={form.nas_hdd_detail || ''} onChange={set('nas_hdd_detail')} rows={2} />
        </div>
        <div className="form-row">
          <div className="form-group"><label>NAS 관리자 ID</label><input value={form.nas_admin_id || ''} onChange={set('nas_admin_id')} /></div>
          <div className="form-group"><label>NAS 관리자 PW</label><input value={form.nas_admin_password || ''} onChange={set('nas_admin_password')} /></div>
        </div>

        <FormSection label="공유기 (없으면 빈칸)" />
        <div className="form-row">
          <div className="form-group"><label>공유기 이름</label><input value={form.router_name || ''} onChange={set('router_name')} /></div>
          <div className="form-group"><label>모델</label><input value={form.router_model || ''} onChange={set('router_model')} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>공유기 IP</label><input value={form.router_ip || ''} onChange={set('router_ip')} /></div>
          <div className="form-group"></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>관리자 ID</label><input value={form.router_admin_id || ''} onChange={set('router_admin_id')} /></div>
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

export default Customers
