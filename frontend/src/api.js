import axios from 'axios'

const API_URL = 'http://127.0.0.1:8000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// 고객
export const getCustomers = (search = null) => api.get('/customers', { params: search ? { search } : {} })
export const getCustomer = (id) => api.get(`/customers/${id}`)
export const createCustomer = (data) => api.post('/customers', data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`)
export const getCustomerComputers = (id) => api.get(`/customers/${id}/computers`)
export const getCustomerReceptions = (id) => api.get(`/customers/${id}/receptions`)

// 컴퓨터
export const getComputers = (customerId = null) => api.get('/computers', { params: customerId ? { customer_id: customerId } : {} })
export const getComputer = (id) => api.get(`/computers/${id}`)
export const createComputer = (data) => api.post('/computers', data)
export const updateComputer = (id, data) => api.put(`/computers/${id}`, data)
export const deleteComputer = (id) => api.delete(`/computers/${id}`)

// 기사
export const getEngineers = () => api.get('/engineers')
export const getEngineer = (id) => api.get(`/engineers/${id}`)
export const createEngineer = (data) => api.post('/engineers', data)
export const updateEngineerStatus = (id, status) => api.put(`/engineers/${id}/status`, null, { params: { status } })
export const updateEngineerLocation = (id, location) => api.put(`/engineers/${id}/location`, null, { params: { location } })
export const deleteEngineer = (id) => api.delete(`/engineers/${id}`)

// 접수
export const getReceptions = (status = null) => api.get('/receptions', { params: status ? { status } : {} })
export const getReception = (id) => api.get(`/receptions/${id}`)
export const createReception = (data) => api.post('/receptions', data)
export const assignReception = (id, engineerId) => api.put(`/receptions/${id}/assign`, null, { params: { engineer_id: engineerId } })
export const updateReceptionStatus = (id, status) => api.put(`/receptions/${id}/status`, null, { params: { status } })
export const deleteReception = (id) => api.delete(`/receptions/${id}`)

// 작업 이력
export const getJobs = (params = {}) => api.get('/jobs', { params })
export const getJob = (id) => api.get(`/jobs/${id}`)
export const updateJob = (id, data) => api.put(`/jobs/${id}`, data)

// 판매
export const getSales = (paid = null) => api.get('/sales', { params: paid !== null ? { paid } : {} })
export const createSale = (data) => api.post('/sales', data)
export const markSalePaid = (id) => api.put(`/sales/${id}/pay`)
export const deleteSale = (id) => api.delete(`/sales/${id}`)

// 재고
export const getInventory = () => api.get('/inventory')
export const createInventory = (data) => api.post('/inventory', data)
export const updateInventory = (id, data) => api.put(`/inventory/${id}`, data)
export const deleteInventory = (id) => api.delete(`/inventory/${id}`)

// 결제
export const getPayments = (status = null) => api.get('/payments', { params: status ? { status } : {} })
export const createPayment = (data) => api.post('/payments', data)
export const completePayment = (id) => api.put(`/payments/${id}/complete`)

// 네트워크 장비
export const getNetworkDevices = (params = {}) => api.get('/network-devices', { params })
export const getNetworkDevice = (id) => api.get(`/network-devices/${id}`)
export const createNetworkDevice = (data) => api.post('/network-devices', data)
export const updateNetworkDevice = (id, data) => api.put(`/network-devices/${id}`, data)
export const deleteNetworkDevice = (id) => api.delete(`/network-devices/${id}`)

// 전화 수신 (CTI)
export const notifyIncomingCall = (phone) => api.post('/incoming-call', null, { params: { phone } })
export const getPendingCalls = () => api.get('/incoming-call/pending')
export const dismissCall = (id) => api.delete(`/incoming-call/${id}`)

// SMS 수신
export const getPendingSms = () => api.get('/incoming-sms/pending')
export const dismissSms = (id) => api.delete(`/incoming-sms/${id}`)

// 대시보드
export const getDashboard = () => api.get('/dashboard')

// 통계
export const getStats = () => api.get('/stats')

export default api
