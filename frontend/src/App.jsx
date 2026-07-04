import { useState, useEffect } from 'react'
import { getDashboard, getReceptions, getEngineers, getCustomers, getComputers, getJobs, getSales, getInventory, getPayments, getStats, getNetworkDevices, getPendingCalls, notifyIncomingCall, getPendingSms } from './api'
import IncomingCallPopup from './components/IncomingCallPopup'
import IncomingSmsPopup from './components/IncomingSmsPopup'
import Dashboard from './pages/Dashboard'
import Receptions from './pages/Receptions'
import Customers from './pages/Customers'
import Engineers from './pages/Engineers'
import Computers from './pages/Computers'
import History from './pages/History'
import Sales from './pages/Sales'
import Inventory from './pages/Inventory'
import Payments from './pages/Payments'
import Stats from './pages/Stats'
import Sidebar from './components/Sidebar'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [data, setData] = useState({
    dashboard: null,
    receptions: [],
    engineers: [],
    customers: [],
    computers: [],
    networkDevices: [],
    jobs: [],
    sales: [],
    inventory: [],
    payments: [],
    stats: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [incomingCalls, setIncomingCalls] = useState([])
  const [incomingSms, setIncomingSms] = useState([])

  const loadAll = async () => {
    try {
      setLoading(true)
      const results = await Promise.allSettled([
        getDashboard(), getReceptions(), getEngineers(), getCustomers(),
        getComputers(), getNetworkDevices(), getJobs(), getSales(), getInventory(), getPayments(), getStats(),
      ])
      const [dashboard, receptions, engineers, customers, computers, networkDevices, jobs, sales, inventory, payments, stats] = results
      const get = (r, fallback) => r.status === 'fulfilled' ? r.value.data : fallback
      setData({
        dashboard: get(dashboard, null),
        receptions: get(receptions, []),
        engineers: get(engineers, []),
        customers: get(customers, []),
        computers: get(computers, []),
        networkDevices: get(networkDevices, []),
        jobs: get(jobs, []),
        sales: get(sales, []),
        inventory: get(inventory, []),
        payments: get(payments, []),
        stats: get(stats, null),
      })
      const failed = results.filter(r => r.status === 'rejected')
      setError(failed.length === results.length ? '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.' : null)
    } catch (err) {
      setError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.')
    } finally {
      setLoading(false)
    }
  }

  // 수신 전화 폴링 (2초마다)
  useEffect(() => {
    const pollCalls = async () => {
      try {
        const res = await getPendingCalls()
        setIncomingCalls(res.data)
      } catch {}
    }
    pollCalls()
    const interval = setInterval(pollCalls, 2000)
    return () => clearInterval(interval)
  }, [])

  // 수신 SMS 폴링 (2초마다)
  useEffect(() => {
    const pollSms = async () => {
      try {
        const res = await getPendingSms()
        setIncomingSms(res.data)
      } catch {}
    }
    pollSms()
    const interval = setInterval(pollSms, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 10000)
    return () => clearInterval(interval)
  }, [])

  const refresh = loadAll

  const commonProps = { loading, onRefresh: refresh, engineers: data.engineers, customers: data.customers }

  return (
    <div className="app">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="main-content">
        <header className="app-header">
          <h1>{pageTitle(currentPage)}</h1>
          <div className="user-info">
            <button
              title="전화 수신 테스트"
              onClick={async () => {
                const phone = prompt('테스트할 전화번호를 입력하세요:', '01012341234')
                if (phone) await notifyIncomingCall(phone)
              }}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-300)', background: 'white', cursor: 'pointer', color: 'var(--gray-600)' }}
            >📞 수신 테스트</button>
            <span className="server-status">● 서버 연결</span>
            <span>관리자</span>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="page-content">
          {currentPage === 'dashboard' && <Dashboard dashboard={data.dashboard} loading={loading} />}
          {currentPage === 'receptions' && <Receptions receptions={data.receptions} {...commonProps} />}
          {currentPage === 'customers' && <Customers customers={data.customers} {...commonProps} />}
          {currentPage === 'engineers' && <Engineers engineers={data.engineers} {...commonProps} />}
          {currentPage === 'computers' && <Computers computers={data.computers} networkDevices={data.networkDevices} customers={data.customers} loading={loading} onRefresh={refresh} />}
          {currentPage === 'history' && <History jobs={data.jobs} receptions={data.receptions} customers={data.customers} engineers={data.engineers} loading={loading} onRefresh={refresh} />}
          {currentPage === 'sales' && <Sales sales={data.sales} customers={data.customers} engineers={data.engineers} loading={loading} onRefresh={refresh} />}
          {currentPage === 'inventory' && <Inventory inventory={data.inventory} loading={loading} onRefresh={refresh} />}
          {currentPage === 'payments' && <Payments payments={data.payments} jobs={data.jobs} sales={data.sales} loading={loading} onRefresh={refresh} />}
          {currentPage === 'stats' && <Stats stats={data.stats} loading={loading} />}
        </div>
      </main>
      {incomingCalls.length > 0 && (
        <IncomingCallPopup
          calls={incomingCalls}
          customers={data.customers}
          onDismiss={async () => {
            const res = await getPendingCalls()
            setIncomingCalls(res.data)
          }}
          onRefresh={refresh}
        />
      )}
      {incomingSms.length > 0 && (
        <IncomingSmsPopup
          smsList={incomingSms}
          onDismiss={async () => {
            const res = await getPendingSms()
            setIncomingSms(res.data)
          }}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}

function pageTitle(page) {
  const titles = {
    dashboard: '대시보드',
    receptions: '접수 관리',
    customers: '고객 관리',
    engineers: '기사 관리',
    computers: '거래처 관리',
    history: '수리 이력',
    sales: '판매 관리',
    inventory: '재고 관리',
    payments: '결제 관리',
    stats: '통계',
  }
  return titles[page] || 'CSEP'
}

export default App
