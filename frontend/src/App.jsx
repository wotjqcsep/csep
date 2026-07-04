import { useState, useEffect, useRef } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [incomingCalls, setIncomingCalls] = useState([])
  const [incomingSms, setIncomingSms] = useState([])
  const initialLoad = useRef(true)

  const loadAll = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true)
      const results = await Promise.allSettled([
        getDashboard(), getReceptions(), getEngineers(), getCustomers(),
        getComputers(), getNetworkDevices(), getJobs(), getSales(), getInventory(), getPayments(), getStats(),
      ])
      const [dashboard, receptions, engineers, customers, computers, networkDevices, jobs, sales, inventory, payments, stats] = results
      const get = (r, prev) => r.status === 'fulfilled' ? r.value.data : prev
      setData(prev => ({
        dashboard: get(dashboard, prev.dashboard),
        receptions: get(receptions, prev.receptions),
        engineers: get(engineers, prev.engineers),
        customers: get(customers, prev.customers),
        computers: get(computers, prev.computers),
        networkDevices: get(networkDevices, prev.networkDevices),
        jobs: get(jobs, prev.jobs),
        sales: get(sales, prev.sales),
        inventory: get(inventory, prev.inventory),
        payments: get(payments, prev.payments),
        stats: get(stats, prev.stats),
      }))
      const failed = results.filter(r => r.status === 'rejected')
      setError(failed.length === results.length ? '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.' : null)
    } catch (err) {
      setError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.')
    } finally {
      if (initialLoad.current) { setLoading(false); initialLoad.current = false }
    }
  }

  // 수신 전화 폴링 (3초마다, 변경시만 업데이트)
  useEffect(() => {
    const pollCalls = async () => {
      try {
        const res = await getPendingCalls()
        setIncomingCalls(prev => {
          const next = res.data
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev
          return next
        })
      } catch {}
    }
    pollCalls()
    const interval = setInterval(pollCalls, 3000)
    return () => clearInterval(interval)
  }, [])

  // 수신 SMS 폴링 (3초마다, 변경시만 업데이트)
  useEffect(() => {
    const pollSms = async () => {
      try {
        const res = await getPendingSms()
        setIncomingSms(prev => {
          const next = res.data
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev
          return next
        })
      } catch {}
    }
    pollSms()
    const interval = setInterval(pollSms, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadAll(true)
    const interval = setInterval(() => loadAll(false), 30000)
    return () => clearInterval(interval)
  }, [])

  const refresh = () => loadAll(true)

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
          {currentPage === 'customers' && <Customers customers={data.customers} computers={data.computers} loading={loading} onRefresh={refresh} />}
          {currentPage === 'engineers' && <Engineers engineers={data.engineers} {...commonProps} />}
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
