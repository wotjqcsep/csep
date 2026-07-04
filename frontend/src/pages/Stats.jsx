const CHANNEL_LABELS = { phone: '전화', sms: 'SMS', kakao: '카카오톡', direct: '직접등록' }

function Stats({ stats, loading }) {
  if (loading && !stats) return <div className="loading">불러오는 중...</div>
  if (!stats) return <div className="loading">데이터 없음</div>

  return (
    <div>
      <div className="page-header">
        <h2>통계</h2>
      </div>

      {/* 전체 요약 */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">총 고객 수</div>
          <div className="stat-value">{stats.total_customers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">총 접수 건</div>
          <div className="stat-value">{stats.total_receptions}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">완료 작업</div>
          <div className="stat-value">{stats.completed_jobs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">수리 매출</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₩{(stats.repair_revenue || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">판매 매출</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₩{(stats.sales_revenue || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">총 매출</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₩{(stats.total_revenue || 0).toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 접수 채널 분포 */}
        <div className="section">
          <h3>접수 채널 분포</h3>
          {Object.entries(stats.channel_counts || {}).length === 0
            ? <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>데이터 없음</div>
            : Object.entries(stats.channel_counts).map(([channel, count]) => {
                const total = Object.values(stats.channel_counts).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={channel} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{CHANNEL_LABELS[channel] || channel}</span>
                      <span style={{ fontWeight: 600 }}>{count}건 ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* 재고 부족 알림 */}
        <div className="section">
          <h3>재고 부족 알림 ({(stats.inventory_low_stock || []).length})</h3>
          {(stats.inventory_low_stock || []).length === 0
            ? <div style={{ color: 'var(--success)', fontSize: 13 }}>모든 재고 충분 ✓</div>
            : (stats.inventory_low_stock || []).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                  <span>{item.part_name}</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    {item.quantity}개 / 기준 {item.reorder_level}개
                  </span>
                </div>
              ))
          }
        </div>
      </div>

      {/* 기사별 실적 */}
      <div className="section" style={{ marginTop: 0 }}>
        <h3>기사별 실적</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>기사</th>
                <th>총 작업</th>
                <th>완료 작업</th>
                <th>완료율</th>
                <th>수리 매출</th>
              </tr>
            </thead>
            <tbody>
              {(stats.engineer_stats || []).length === 0 && (
                <tr><td colSpan={5} className="empty-state">데이터 없음</td></tr>
              )}
              {(stats.engineer_stats || []).map((e) => {
                const rate = e.total_jobs > 0 ? Math.round((e.completed_jobs / e.total_jobs) * 100) : 0
                return (
                  <tr key={e.id}>
                    <td><strong>{e.name}</strong></td>
                    <td style={{ textAlign: 'center' }}>{e.total_jobs}건</td>
                    <td style={{ textAlign: 'center' }}>{e.completed_jobs}건</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--gray-200)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${rate}%`, background: rate === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--gray-600)', width: 36 }}>{rate}%</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, textAlign: 'right' }}>₩{(e.revenue || 0).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 미수금 */}
      {stats.total_outstanding > 0 && (
        <div className="section" style={{ borderColor: 'var(--danger)', background: '#fff5f5' }}>
          <h3 style={{ color: 'var(--danger)' }}>⚠ 미수금 현황</h3>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>
            ₩{(stats.total_outstanding || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
            고객 관리 페이지에서 상세 확인 가능
          </div>
        </div>
      )}
    </div>
  )
}

export default Stats
