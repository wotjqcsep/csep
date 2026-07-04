import { useState } from 'react'
import Modal from '../components/Modal'
import { createNetworkDevice, updateNetworkDevice, deleteNetworkDevice } from '../api'

const DEVICE_TYPES = { nas: 'NAS', router: '공유기', switch: '스위치', ap: 'AP', other: '기타' }

const EMPTY = {
  customer_id: '', device_type: 'nas', name: '', model: '', ip_address: '',
  hdd_count: '', hdd_detail: '', total_capacity: '', partition_info: '',
  maintenance_period: '', maintenance_notes: '',
  admin_id: '', admin_password: '', notes: '',
}

function NetworkDevices({ networkDevices, customers, loading, onRefresh }) {
  const [filterType, setFilterType] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const getCustomerName = (id) => customers.find(c => c.id === id)?.name || `고객 ${id}`

  const filtered = networkDevices.filter(d => {
    if (filterType && d.device_type !== filterType) return false
    if (filterCustomer && String(d.customer_id) !== filterCustomer) return false
    return true
  })

  const openAdd = () => { setForm(EMPTY); setShowAdd(true) }
  const openEdit = (d) => { setForm({ ...d }); setSelected(d); setShowEdit(true) }

  const handleSave = async () => {
    if (!form.name) return alert('장비 이름을 입력하세요')
    await createNetworkDevice({ ...form, customer_id: form.customer_id ? Number(form.customer_id) : null, hdd_count: form.hdd_count ? Number(form.hdd_count) : null })
    setShowAdd(false)
    onRefresh()
  }

  const handleUpdate = async () => {
    await updateNetworkDevice(selected.id, { ...form, customer_id: form.customer_id ? Number(form.customer_id) : null, hdd_count: form.hdd_count ? Number(form.hdd_count) : null })
    setShowEdit(false)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 장비를 삭제하시겠습니까?')) return
    await deleteNetworkDevice(id)
    setSelected(null)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  if (loading && !networkDevices.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>네트워크 장비 관리 ({networkDevices.length}대)</h2>
        <button className="btn" onClick={openAdd}>+ 장비 등록</button>
      </div>

      <div className="filter-bar">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid var(--gray-300)', fontSize: 13 }}>
          <option value="">전체 종류</option>
          {Object.entries(DEVICE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid var(--gray-300)', fontSize: 13 }}>
          <option value="">전체 고객</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className={selected ? 'split-layout' : ''}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>종류</th>
                <th>장비명</th>
                <th>고객</th>
                <th>모델</th>
                <th>IP 주소</th>
                <th>HDD</th>
                <th>유지보수 주기</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="empty-state">등록된 네트워크 장비가 없습니다</td></tr>
              )}
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setSelected(selected?.id === d.id ? null : d)}
                  style={{ cursor: 'pointer', background: selected?.id === d.id ? '#e3f2fd' : '' }}
                >
                  <td><span className="badge new" style={{ fontSize: 11 }}>{DEVICE_TYPES[d.device_type] || d.device_type}</span></td>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.customer_id ? getCustomerName(d.customer_id) : <span style={{ color: 'var(--gray-400)' }}>-</span>}</td>
                  <td style={{ fontSize: 12 }}>{d.model || '-'}</td>
                  <td style={{ fontSize: 12 }}>{d.ip_address || '-'}</td>
                  <td style={{ fontSize: 12 }}>{d.hdd_count ? `${d.hdd_count}개` : '-'}</td>
                  <td style={{ fontSize: 12 }}>{d.maintenance_period || '-'}</td>
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

            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>
              <span className="badge new">{DEVICE_TYPES[selected.device_type] || selected.device_type}</span>
              {selected.customer_id && <span style={{ marginLeft: 8 }}>고객: <strong>{getCustomerName(selected.customer_id)}</strong></span>}
            </div>

            {[
              ['모델', 'model'], ['IP 주소', 'ip_address'],
            ].map(([label, key]) => selected[key] ? (
              <div className="detail-row" key={key}>
                <span className="detail-label">{label}</span>
                <span className="detail-value">{selected[key]}</span>
              </div>
            ) : null)}

            {selected.device_type === 'nas' && <>
              <div style={{ margin: '12px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', borderTop: '1px solid var(--gray-200)', paddingTop: 10 }}>HDD / 스토리지</div>
              {[
                ['HDD 개수', selected.hdd_count ? `${selected.hdd_count}개` : null],
                ['HDD 상세', selected.hdd_detail],
                ['총 용량', selected.total_capacity],
                ['파티션 정보', selected.partition_info],
              ].map(([label, val]) => val ? (
                <div className="detail-row" key={label}>
                  <span className="detail-label">{label}</span>
                  <span className="detail-value" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{val}</span>
                </div>
              ) : null)}

              <div style={{ margin: '12px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', borderTop: '1px solid var(--gray-200)', paddingTop: 10 }}>유지보수</div>
              {[
                ['유지보수 주기', selected.maintenance_period],
                ['유지보수 내용', selected.maintenance_notes],
              ].map(([label, val]) => val ? (
                <div className="detail-row" key={label}>
                  <span className="detail-label">{label}</span>
                  <span className="detail-value" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{val}</span>
                </div>
              ) : null)}
            </>}

            <div style={{ margin: '12px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', borderTop: '1px solid var(--gray-200)', paddingTop: 10 }}>관리자 정보</div>
            {[
              ['관리자 ID', selected.admin_id],
              ['관리자 PW', selected.admin_password],
            ].map(([label, val]) => val ? (
              <div className="detail-row" key={label}>
                <span className="detail-label">{label}</span>
                <span className="detail-value" style={{ fontSize: 13, fontFamily: 'monospace' }}>{val}</span>
              </div>
            ) : null)}

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
        <Modal title={showAdd ? '네트워크 장비 등록' : '네트워크 장비 수정'} onClose={() => { setShowAdd(false); setShowEdit(false) }} wide>
          <NetworkDeviceForm form={form} set={set} customers={customers} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setShowEdit(false) }}>취소</button>
            <button className="btn" onClick={showAdd ? handleSave : handleUpdate}>저장</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function NetworkDeviceForm({ form, set, customers }) {
  const isNas = form.device_type === 'nas'
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>장비 종류 *</label>
          <select value={form.device_type || 'nas'} onChange={set('device_type')}>
            <option value="nas">NAS</option>
            <option value="router">공유기</option>
            <option value="switch">스위치</option>
            <option value="ap">AP</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div className="form-group">
          <label>고객</label>
          <select value={form.customer_id || ''} onChange={set('customer_id')}>
            <option value="">선택 (선택사항)</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>장비명 *</label>
          <input value={form.name || ''} onChange={set('name')} placeholder="사무실 NAS, 본사 공유기 등" />
        </div>
        <div className="form-group">
          <label>모델명</label>
          <input value={form.model || ''} onChange={set('model')} placeholder="DS220+, ASUS RT-AX88U 등" />
        </div>
      </div>

      <div className="form-group">
        <label>관리 IP 주소</label>
        <input value={form.ip_address || ''} onChange={set('ip_address')} placeholder="192.168.1.1" />
      </div>

      {isNas && (
        <>
          <div style={{ marginBottom: 8, marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
            HDD / 스토리지
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>HDD 개수</label>
              <input type="number" min="0" value={form.hdd_count || ''} onChange={set('hdd_count')} placeholder="4" />
            </div>
            <div className="form-group">
              <label>총 용량</label>
              <input value={form.total_capacity || ''} onChange={set('total_capacity')} placeholder="16TB" />
            </div>
          </div>
          <div className="form-group">
            <label>HDD 상세 (슬롯별 용량/제조사)</label>
            <textarea value={form.hdd_detail || ''} onChange={set('hdd_detail')} placeholder="슬롯1: WD Red 4TB&#10;슬롯2: Seagate 4TB&#10;슬롯3: 비어있음" rows={3} />
          </div>
          <div className="form-group">
            <label>파티션 / 볼륨 정보</label>
            <textarea value={form.partition_info || ''} onChange={set('partition_info')} placeholder="볼륨1: SHR (4TB) - 공유 폴더용&#10;볼륨2: RAID1 (2TB) - 백업용" rows={3} />
          </div>

          <div style={{ marginBottom: 8, marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
            유지보수
          </div>
          <div className="form-group">
            <label>유지보수 주기</label>
            <input value={form.maintenance_period || ''} onChange={set('maintenance_period')} placeholder="3개월마다, 매년 1회 등" />
          </div>
          <div className="form-group">
            <label>유지보수 내용</label>
            <textarea value={form.maintenance_notes || ''} onChange={set('maintenance_notes')} placeholder="HDD 상태 점검, 펌웨어 업데이트, 백업 상태 확인 등" rows={2} />
          </div>
        </>
      )}

      <div style={{ marginBottom: 8, marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
        관리자 정보
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>관리자 ID</label>
          <input value={form.admin_id || ''} onChange={set('admin_id')} placeholder="admin" />
        </div>
        <div className="form-group">
          <label>관리자 비밀번호</label>
          <input value={form.admin_password || ''} onChange={set('admin_password')} placeholder="비밀번호" />
        </div>
      </div>

      <div className="form-group">
        <label>메모</label>
        <textarea value={form.notes || ''} onChange={set('notes')} placeholder="특이사항, 설치 위치 등" />
      </div>
    </>
  )
}

export default NetworkDevices
