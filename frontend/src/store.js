import { reactive } from 'vue'
import * as API from './api/index.js'
import { setToken } from './api/client.js'

export const store = reactive({
  user: null,
  baseMonth: '2026-08',
  toast: null,

  get isCustomer() { return this.user?.role === 'CUSTOMER' },
  get isIssuer()   { return this.user?.role === 'ISSUER_MANAGER' },

  async login(email, password) {
    const r = await API.login({ email, password })
    setToken(r.accessToken)
    this.user = r.user
    return r.user
  },
  async signup(body) { return API.signup(body) },
  async logout() { try { await API.logout() } catch {} ; setToken(null); this.user = null },

  notify(message, type = 'ok') {
    this.toast = { message, type, id: Date.now() }
    setTimeout(() => { if (this.toast && Date.now() - this.toast.id >= 2600) this.toast = null }, 2800)
  },
})

/* ---------- 포맷터 ---------- */
export const won  = n => (n == null ? '-' : Number(n).toLocaleString('ko-KR'))
export const won원 = n => (n == null ? '-' : Number(n).toLocaleString('ko-KR') + '원')
export const pct  = (n, d = 1) => (n == null ? '-' : (n * 100).toFixed(d) + '%')
export const pct0 = n => (n == null ? '-' : Math.round(n * 100) + '%')
export const eok  = n => {
  if (n == null) return '-'
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + '억'
  if (Math.abs(n) >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만'
  return Number(n).toLocaleString()
}
export const dt = s => (s ? String(s).replace('T', ' ').slice(0, 16) : '-')
export const d10 = s => (s ? String(s).slice(0, 10) : '-')

export const ym = m => (m ? `${m.slice(0,4)}년 ${Number(m.slice(5,7))}월` : '-')
