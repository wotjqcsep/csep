import './Dashboard.css'

const STATUS_LABELS = { idle: '대기', on_the_way: '출동', working: '작업중', off_duty: '퇴근' }
const STATUS_COLORS = { idle: 'var(--gray-400)', on_the_way: 'var(--success)', working: 'var(--primary)', off_duty: 'var(--gray-300)' }
const CHANNEL_ICONS = { phone: '📞', sms: '💬', kakao: '💭', direct: '📋' }

function Dashboard({ dashboard, loading }) {
  if (loading && !dashboard) return <div className="loading">불러오는 중...</div>
  if (!dashboard) return <div className="loading">서버에 연결 중...</div>

  return (
    <div className="dashboard">
      {/* 상단 통계 */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">오늘 신규 접수</div>
          <div className="stat-value">{dashboard.today_new}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">배정 대기</div>
          <div className="stat-value" style={{ color: dashboard.assigned_pending > 0 ? 'var(--warning)' : 'var(--gray-400)' }}>
            {dashboard.assigned_pending}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">진행 중</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{dashboard.in_progress}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">오늘 완료</div>
          <div className="stat-value" style={{ color: 'var(--gray-500)' }}>{dashboard.completed_today}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">총 미수금</div>
          <div className="stat-value" style={{ fontSize: 20, color: dashboard.total_outstanding > 0 ? 'var(--danger)' : 'var(--gray-400)' }}>
            ₩{(dashboard.total_outstanding || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">재고 부족</div>
          <div className="stat-value" style={{ fontSize: 24, color: dashboard.low_stock_count > 0 ? 'var(--danger)' : 'var(--gray-400)' }}>
            {dashboard.low_stock_count}종
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 기사 현황 */}
        <div className="dashboard-section">
          <h3>기사 현황</h3>
          {dashboard.engineers.length === 0
            ? <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>등록된 기사 없음</div>
            : dashboard.engineers.map((e) => (
                <div key={e.id} className="list-item" style={{ marginBottom: 8 }}>
                  <div>
                    <div className="list-item-name">{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{e.phone}</div>
                  </div>
                  <div className="list-item-status">
                    <span className={`status-dot ${e.status}`} style={{ background: STATUS_COLORS[e.status] }} />
                    <span>{STATUS_LABELS[e.status] || e.status}</span>
                    {e.location && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>- {e.location}</span>}
                  </div>
                </div>
              ))
          }
        </div>

        {/* 배정 대기 접수 */}
        <div className="dashboard-section">
          <h3>처리 대기 접수 ({dashboard.pending_receptions.length}건)</h3>
          {dashboard.pending_receptions.length === 0
            ? <div style={{ color: 'var(--success)', fontSize: 13 }}>대기 중인 접수 없음 ✓</div>
            : dashboard.pending_receptions.map((r) => (
                <div key={r.id} className="list-item" style={{ marginBottom: 8 }}>
                  <div>
                    <div className="list-item-name" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{CHANNEL_ICONS[r.reception_channel] || '📋'}</span>
                      <span>고객 #{r.customer_id}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{r.symptom}</div>
                  </div>
                  <span className={`badge ${r.status}`}>
                    {r.status === 'new' ? '신규' : '배정중'}
                  </span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}

export default Dashboard
