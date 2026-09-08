/* ============================================================
   API 클라이언트
   MODE = 'mock' → 브라우저 내 목 핸들러 (백엔드 없이 동작)
   MODE = 'http' → 실제 Spring Boot 서버 (http://localhost:8080/api)
   두 모드의 요청/응답 형태는 OAS 명세로 동일하다.
   ============================================================ */
import { handlers } from './mock/handlers.js'

export const MODE = import.meta.env?.VITE_API_MODE || 'mock'
export const BASE_URL = 'http://localhost:8080/api'
const LATENCY = 220   // 실제 네트워크 느낌

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || '요청을 처리하지 못했습니다.')
    this.status = status
    this.code = body?.code
    this.field = body?.field
    this.detail = body?.detail
    this.body = body
  }
}

/** '/me/cards/101/sync' → 핸들러 키 매칭 + path params 추출 */
function matchHandler(method, path) {
  const key = `${method} ${path}`
  if (handlers[key]) return { fn: handlers[key], params: {} }

  const segs = path.split('/').filter(Boolean)
  for (const hk of Object.keys(handlers)) {
    const [hm, hp] = hk.split(' ')
    if (hm !== method) continue
    const hsegs = hp.split('/').filter(Boolean)
    if (hsegs.length !== segs.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < hsegs.length; i++) {
      if (hsegs[i].startsWith(':')) params[hsegs[i].slice(1)] = segs[i]
      else if (hsegs[i] !== segs[i]) { ok = false; break }
    }
    if (ok) return { fn: handlers[hk], params }
  }
  return null
}

export async function request(method, path, { query, body } = {}) {
  if (MODE === 'http') {
    const qs = query ? '?' + new URLSearchParams(
      Object.entries(query).filter(([, v]) => v != null && v !== '')).toString() : ''
    const res = await fetch(BASE_URL + path + qs, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 204) return null
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, data)
    return data
  }

  // ---- mock ----
  await new Promise(r => setTimeout(r, LATENCY))
  const m = matchHandler(method, path)
  if (!m) throw new ApiError(404, { code: 'NOT_FOUND', message: `정의되지 않은 엔드포인트: ${method} ${path}` })
  try {
    const res = method === 'GET' || method === 'DELETE'
      ? m.fn(query || {}, m.params)
      : m.fn(body || {}, m.params)
    return res.data ?? null
  } catch (e) {
    if (e.status) throw new ApiError(e.status, e.body)
    throw e
  }
}

let _token = null
export const setToken = t => { _token = t; try { t ? localStorage.setItem('pm_token', t) : localStorage.removeItem('pm_token') } catch {} }
export const getToken = () => { if (_token) return _token; try { return localStorage.getItem('pm_token') } catch { return null } }

export const api = {
  get:    (p, query)      => request('GET', p, { query }),
  post:   (p, body, query)=> request('POST', p, { body, query }),
  put:    (p, body)       => request('PUT', p, { body }),
  patch:  (p, body)       => request('PATCH', p, { body }),
  delete: (p)             => request('DELETE', p),
}
