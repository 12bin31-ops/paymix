/* ============================================================
   엔드포인트 함수 — OAS operationId 와 1:1 대응
   ============================================================ */
import { api } from './client.js'

/* [화면 1] Auth */
export const signup        = (body) => api.post('/auth/signup', body)
export const login         = (body) => api.post('/auth/login', body)
export const getMyAccount  = ()     => api.get('/auth/me')
export const logout        = ()     => api.post('/auth/logout')

/* [화면 2] 카드 데이터 연결 */
export const getCardCatalog      = ()      => api.get('/cards/catalog')
export const getMyCards          = (q)     => api.get('/me/cards', q)
export const linkCard            = (body)  => api.post('/me/cards', body)
export const unlinkCard          = (id)    => api.delete(`/me/cards/${id}`)
export const syncCardTransactions= (id)    => api.post(`/me/cards/${id}/sync`)

/* [화면 3] 실적·연회비 진단 */
export const getPerformanceDiagnosis = (q) => api.get('/me/diagnosis/performance', q)
export const getPerformanceExclusions= (id, q) => api.get(`/me/cards/${id}/exclusions`, q)
export const getBenefitBlocks        = (id, q) => api.get(`/me/cards/${id}/benefit-blocks`, q)
export const getMyPoints             = ()  => api.get('/me/points')

/* [화면 4] 페이·정기결제 현황 */
export const getChannelUsage        = (q)  => api.get('/me/channels/usage', q)
export const getMySubscriptions     = (q)  => api.get('/me/subscriptions', q)
export const updateSubscriptionCard = (id, body) => api.patch(`/me/subscriptions/${id}`, body)

/* [화면 5] 개선 제안 */
export const createRecommendation    = (body) => api.post('/me/recommendations', body)
export const getLatestRecommendation = ()     => api.get('/me/recommendations/latest')
export const getRecommendation       = (id)   => api.get(`/me/recommendations/${id}`)
export const acceptRecommendation    = (id)   => api.post(`/me/recommendations/${id}/accept`)
export const getTierGapAlerts        = (q)    => api.get('/me/alerts/tier-gap', q)
export const getBenefitUtilization   = (q)    => api.get('/me/benefit-utilization', q)
export const getCardSuggestions      = (q)    => api.get('/me/card-suggestions', q)

/* [화면 6] 카드사 대시보드 */
export const getIssuerDashboardSummary = (q) => api.get('/issuer/dashboard/summary', q)
export const getChannelPositions       = (q) => api.get('/issuer/dashboard/channels', q)

/* [화면 7] 시뮬레이션 / 세그먼트 */
export const runSimulation  = (body) => api.post('/issuer/simulations', body)
export const extractSegment = (body) => api.post('/issuer/segments', body)

/* [화면 8] 카드·혜택 규칙 관리 */
export const getIssuerCards        = ()          => api.get('/issuer/cards')
export const createCard            = (body)      => api.post('/issuer/cards', body)
export const getCardDetail         = (id)        => api.get(`/issuer/cards/${id}`)
export const updateCard            = (id, body)  => api.put(`/issuer/cards/${id}`, body)
export const getPerformanceTiers   = (id)        => api.get(`/issuer/cards/${id}/tiers`)
export const updatePerformanceTiers= (id, body)  => api.put(`/issuer/cards/${id}/tiers`, body)
export const getBenefitRules       = (id, q)     => api.get(`/issuer/cards/${id}/benefit-rules`, q)
export const createBenefitRule     = (id, body)  => api.post(`/issuer/cards/${id}/benefit-rules`, body)
export const updateBenefitRule     = (id, body)  => api.put(`/issuer/benefit-rules/${id}`, body)
export const deleteBenefitRule     = (id)        => api.delete(`/issuer/benefit-rules/${id}`)
export const getCardChannelRates   = (id)        => api.get(`/issuer/cards/${id}/channel-rates`)
export const updateCardChannelRates= (id, body)  => api.put(`/issuer/cards/${id}/channel-rates`, body)

/* 공통 기준 정보 */
export const getPayChannels        = () => api.get('/channels')
export const getSpendingCategories = () => api.get('/categories')

/* 외부 시스템 */
export const ingestTransactions = (body) => api.post('/external/transactions', body)

export { ApiError, MODE } from './client.js'
