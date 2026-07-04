import { useState } from 'react'
import { dismissSms, createReception } from '../api'
import './IncomingCallPopup.css'

const STATUS_LABELS = { new: '신규', assigned: '배정', in_progress: '진행중', completed: '완료', cancelled: '취소' }

function IncomingSmsPopup({ smsList, onDismiss, onRefresh }) {
  const [activeSms, setActiveSms] = useState(null)
  const [form, setForm] = useState({ symptom: '', initial_memo: '' })
  const [saving, setSaving] = useState(false)

  const sms = activeSms || smsList[0]
  if (!sms) return null

  const customer = sms.customer
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleDismiss = async () => {
    await dismissSms(sms.id)
    onDismiss()
  }

  const handleRegister = async () => {
    if (!form.symptom) return alert('증상을 입력하세요')
    if (!customer) return alert('고객을 먼저 등록하세요')
    setSaving(true)
    try {
      await createReception({
        customer_id: customer.id,
        symptom: form.symptom,
        reception_channel: 'sms',
        reception_phone: sms.phone,
        initial_memo: form.initial_memo || null,
      })
      await dismissSms(sms.id)
      onRefresh()
      onDismiss()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="call-overlay" style={{ bottom: 24, left: 24, right: 'auto' }}>
      {smsList.length > 1 && (
        <div className="call-tabs">
          {smsList.map((s) => (
            <button
              key={s.id}
              className={`call-tab ${sms.id === s.id ? 'active' : ''}`}
              onClick={() => setActiveSms(s)}
            >
              💬 {formatPhone(s.phone)}
            </button>
          ))}
        </div>
      )}

      <div className="call-popup">
        {/* 헤더 */}
        <div className="call-header" style={{ background: 'linear-gradient(135deg, #065f46, #10b981)' }}>
          <div className="call-icon" style={{ animation: 'none' }}>💬</div>
          <div className="call-info">
            <div className="call-phone">{formatPhone(sms.phone)}</div>
            <div className="call-time">{new Date(sms.received_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 문자 수신</div>
          </div>
          <button className="call-close" onClick={handleDismiss}>✕</button>
        </div>

        {/* 문자 내용 */}
        <div style={{ padding: '10px 16px', background: '#f0fdf4', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>수신 문자</div>
          <div style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sms.message}</div>
        </div>

        {/* 고객 정보 */}
        {customer ? (
          <div className="call-customer found">
            <div className="call-customer-name">
              <span className={`badge ${customer.customer_type === 'business' ? 'assigned' : 'new'}`} style={{ fontSize: 11 }}>
                {customer.customer_type === 'business' ? '기업' : '개인'}
              </span>
              <strong>{customer.name}</strong>
              {customer.company_name && <span style={{ fontSize: 13, color: 'var(--gray-500)' }}> · {customer.company_name}</span>}
            </div>
            {customer.address && <div className="call-customer-addr">📍 {customer.address}</div>}
            {customer.outstanding_amount > 0 && (
              <div className="call-outstanding">미수금 ₩{customer.outstanding_amount.toLocaleString()}</div>
            )}
          </div>
        ) : (
          <div className="call-customer new">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-600)' }}>신규 고객</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>등록된 고객 정보가 없습니다</div>
          </div>
        )}

        {/* 최근 접수 이력 */}
        {sms.recent_receptions?.length > 0 && (
          <div className="call-history">
            <div className="call-history-title">최근 접수 이력</div>
            {sms.recent_receptions.map((r, i) => (
              <div key={i} className="call-history-item">
                <span className={`badge ${r.status}`} style={{ fontSize: 10 }}>{STATUS_LABELS[r.status] || r.status}</span>
                <span className="call-history-symptom">{r.symptom}</span>
                <span className="call-history-date">{r.received_at?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 접수 폼 */}
        {customer && (
          <div className="call-form">
            <textarea
              className="call-textarea"
              value={form.symptom}
              onChange={set('symptom')}
              placeholder="증상을 입력하세요..."
              rows={2}
            />
            <textarea
              className="call-textarea"
              value={form.initial_memo}
              onChange={set('initial_memo')}
              placeholder="메모 (선택사항)"
              rows={1}
            />
          </div>
        )}

        {/* 버튼 */}
        <div className="call-actions">
          <button className="call-btn-dismiss" onClick={handleDismiss}>무시</button>
          {customer ? (
            <button className="call-btn-register" onClick={handleRegister} disabled={saving}
              style={{ background: '#059669' }}
            >
              {saving ? '등록 중...' : '📋 접수 등록'}
            </button>
          ) : (
            <button className="call-btn-new" onClick={handleDismiss}>
              고객 등록 후 접수
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatPhone(phone) {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return phone
}

export default IncomingSmsPopup
