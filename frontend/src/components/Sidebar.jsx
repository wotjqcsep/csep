import './Sidebar.css'

const sections = [
  {
    label: '현황',
    items: [
      { id: 'dashboard', label: '대시보드', icon: '📊' },
    ],
  },
  {
    label: '접수 / 현장',
    items: [
      { id: 'receptions', label: '접수 관리', icon: '📞' },
      { id: 'engineers', label: '기사 관리', icon: '🔧' },
    ],
  },
  {
    label: '고객',
    items: [
      { id: 'customers', label: '고객 관리', icon: '👥' },
      { id: 'history', label: '수리 이력', icon: '📋' },
    ],
  },
  {
    label: 'ERP',
    items: [
      { id: 'sales', label: '판매 관리', icon: '🛒' },
      { id: 'inventory', label: '재고 관리', icon: '📦' },
      { id: 'payments', label: '결제 관리', icon: '💳' },
    ],
  },
  {
    label: '분석',
    items: [
      { id: 'stats', label: '통계', icon: '📈' },
    ],
  },
]

function Sidebar({ currentPage, setCurrentPage }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>CSEP</h2>
        <span>컴퓨터 A/S ERP</span>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.label} className="nav-section">
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => setCurrentPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>© 2026 CSEP v1.0</p>
      </div>
    </aside>
  )
}

export default Sidebar
