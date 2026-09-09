/* ============================================================
   Mock API 핸들러 — OAS 3.0 명세(38 operation)를 그대로 구현
   실제 백엔드 연결 시 client.js 의 MODE 만 'http' 로 바꾸면 된다.
   ============================================================ */
import * as S from './seed.js'
import * as E from './engine.js'

const clone = o => JSON.parse(JSON.stringify(o))
const err = (status, code, message, extra = {}) => {
  const e = new Error(message)
  e.status = status
  e.body = { code, message, timestamp: new Date().toISOString().slice(0, 19), ...extra }
  return e
}

/* 런타임 상태 (세션 내 변경분) */
const state = {
  token: null,
  userId: null,
  seqUser: 100,
  seqCC: 900,
  seqReco: 9000,
  recommendations: [],      // 산출 이력
  customerCards: clone(S.customerCards),
  subscriptions: clone(S.subscriptions),
  cards: clone(S.cards),
  cardChannelRates: clone(S.cardChannelRates),
  benefitRules: clone(S.benefitRules),
  tiers: clone(S.cardPerformanceTiers),
  users: clone(S.users),
  customers: clone(S.customers),
}

const currentUser = () => {
  if (!state.userId) throw err(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  return state.users.find(u => u.id === state.userId)
}
const requireCustomer = () => {
  const u = currentUser()
  if (u.role !== 'CUSTOMER') throw err(403, 'FORBIDDEN', '고객 전용 기능입니다.')
  return state.customers.find(c => c.userId === u.id)
}
const requireIssuer = () => {
  const u = currentUser()
  if (u.role !== 'ISSUER_MANAGER') throw err(403, 'FORBIDDEN', '카드사 담당자만 접근할 수 있습니다.')
  return u
}

/** 진단 가능 여부 — 화면 3 예외 시나리오 (422) */
function assertDiagnosable(customer) {
  const NOW = new Date('2026-09-08')
  const joined = new Date(customer.joinedAt)
  const days = Math.floor((NOW - joined) / 86400000)
  const txCount = E.txOf(customer.id).length
  if (days < 30 || txCount < 5) {
    throw err(422, 'INSUFFICIENT_TRANSACTION_DATA',
      '가입 후 1개월이 지나야 진단할 수 있습니다. 결제 데이터가 쌓이면 자동으로 안내해 드릴게요.',
      { detail: `가입일 ${customer.joinedAt} / 필요 거래 기간 30일 / 현재 ${days}일`,
        joinedAt: customer.joinedAt, requiredDays: 30, elapsedDays: days, transactionCount: txCount })
  }
}

/* ============================================================
   라우팅 테이블
   ============================================================ */
export const handlers = {

  /* ---------- [화면 1] Auth ---------- */
  'POST /auth/signup': (body) => {
    if (!body.email || !body.password || !body.name || !body.role)
      throw err(400, 'INVALID_PARAMETER', '필수 항목을 모두 입력해 주세요.')
    if (body.password.length < 8)
      throw err(400, 'INVALID_PARAMETER', '비밀번호는 8자 이상이어야 합니다.', { field: 'password' })
    if (state.users.some(u => u.email === body.email))
      throw err(409, 'DUPLICATE_EMAIL', '이미 가입된 이메일입니다.', { field: 'email' })

    const user = { id: ++state.seqUser, email: body.email, passwordHash: body.password,
                   name: body.name, role: body.role, createdAt: new Date().toISOString().slice(0, 19) }
    state.users.push(user)
    if (body.role === 'CUSTOMER') {
      state.customers.push({ id: user.id, userId: user.id, birthYear: body.birthYear ?? null,
                             joinedAt: new Date().toISOString().slice(0, 10) })
    }
    return { status: 201, data: publicUser(user) }
  },

  'POST /auth/login': (body) => {
    const u = state.users.find(x => x.email === body.email)
    if (!u || u.passwordHash !== body.password)
      throw err(401, 'UNAUTHORIZED', '이메일 또는 비밀번호가 올바르지 않습니다.')
    state.userId = u.id
    state.token = `mock-token-${u.id}`
    return { status: 200, data: { accessToken: state.token, user: publicUser(u) } }
  },

  'GET /auth/me': () => ({ status: 200, data: publicUser(currentUser()) }),

  'POST /auth/logout': () => { state.userId = null; state.token = null; return { status: 204 } },

  /* ---------- [화면 2] 카드 데이터 연결 ---------- */
  'GET /cards/catalog': () => {
    currentUser()
    return { status: 200, data: state.cards.filter(c => c.isActive).map(clone) }
  },

  'GET /me/cards': (q = {}) => {
    const cust = requireCustomer()
    let list = state.customerCards.filter(c => c.customerId === cust.id)
    if (q.linkedOnly !== false) list = list.filter(c => c.isLinked)
    return { status: 200, data: list.map(cc => {
      const card = state.cards.find(c => c.id === cc.cardId)
      const pb = S.pointBalances.find(p => p.customerCardId === cc.id)
      return { id: cc.id, cardId: card.id, cardCode: card.cardCode, cardName: card.name,
               cardAlias: cc.cardAlias, maskedNumber: cc.maskedNumber,
               annualFee: card.annualFee, brand: card.brand, imageUrl: card.imageUrl || null,
               description: card.description, totalMonthlyBenefitLimit: card.totalMonthlyBenefitLimit,
               isLinked: cc.isLinked, linkedAt: cc.linkedAt, lastSyncedAt: cc.lastSyncedAt,
               pointBalance: pb ? pb.balance : 0 }
    }) }
  },

  'POST /me/cards': (body) => {
    const cust = requireCustomer()
    if (!body.cardId || !body.maskedNumber)
      throw err(400, 'INVALID_PARAMETER', '카드 상품과 카드번호를 입력해 주세요.')
    if (!/^\d{4}-\*{4}-\*{4}-\d{4}$/.test(body.maskedNumber))
      throw err(400, 'INVALID_PARAMETER', '카드번호 형식이 올바르지 않습니다. (1234-****-****-5678)', { field: 'maskedNumber' })
    const card = state.cards.find(c => c.id === Number(body.cardId))
    if (!card) throw err(404, 'NOT_FOUND', '해당 카드 상품을 찾을 수 없습니다.')
    if (!card.isActive) throw err(409, 'INACTIVE_CARD', '판매가 중지된 카드 상품입니다.')
    if (state.customerCards.some(c => c.customerId === cust.id && c.maskedNumber === body.maskedNumber && c.isLinked))
      throw err(409, 'ALREADY_LINKED_CARD', '이미 연결된 카드입니다.', { field: 'maskedNumber' })

    const cc = { id: ++state.seqCC, customerId: cust.id, cardId: card.id,
                 maskedNumber: body.maskedNumber, cardAlias: body.cardAlias || null,
                 isLinked: true, linkedAt: new Date().toISOString().slice(0, 19), lastSyncedAt: null }
    state.customerCards.push(cc)
    return { status: 201, data: { ...cc, cardName: card.name, annualFee: card.annualFee } }
  },

  'DELETE /me/cards/:id': (_, p) => {
    const cust = requireCustomer()
    const cc = state.customerCards.find(c => c.id === Number(p.id) && c.customerId === cust.id)
    if (!cc) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    cc.isLinked = false
    return { status: 204 }
  },

  'POST /me/cards/:id/sync': (_, p) => {
    const cust = requireCustomer()
    const cc = state.customerCards.find(c => c.id === Number(p.id) && c.customerId === cust.id)
    if (!cc) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    cc.lastSyncedAt = new Date().toISOString().slice(0, 19)
    const count = S.transactions.filter(t => t.customerCardId === cc.id).length
    return { status: 200, data: { customerCardId: cc.id, syncedTransactionCount: count, lastSyncedAt: cc.lastSyncedAt } }
  },

  /* ---------- [화면 3] 실적·연회비 진단 ---------- */
  'GET /me/diagnosis/performance': (q = {}) => {
    const cust = requireCustomer()
    assertDiagnosable(cust)
    const baseMonth = q.baseMonth || S.BASE_MONTH
    const ccs = state.customerCards.filter(c => c.customerId === cust.id && c.isLinked)
    const cards = ccs.map(cc => E.diagnoseCard(cc.id, baseMonth))
    return { status: 200, data: {
      baseMonth,
      totalAnnualNetBenefit: cards.reduce((s, c) => s + c.annualNetBenefit, 0),
      totalSpending: cards.reduce((s, c) => s + c.totalSpending, 0),
      totalRecognized: cards.reduce((s, c) => s + c.recognizedPerformance, 0),
      cards,
    } }
  },

  'GET /me/cards/:id/exclusions': (q = {}, p) => {
    const cust = requireCustomer()
    const cc = state.customerCards.find(c => c.id === Number(p.id) && c.customerId === cust.id)
    if (!cc) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    return { status: 200, data: E.exclusions(cc.id, q.baseMonth || S.BASE_MONTH) }
  },

  'GET /me/cards/:id/benefit-blocks': (q = {}, p) => {
    const cust = requireCustomer()
    const cc = state.customerCards.find(c => c.id === Number(p.id) && c.customerId === cust.id)
    if (!cc) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    return { status: 200, data: E.benefitBlocks(cc.id, q.baseMonth || S.BASE_MONTH) }
  },

  'GET /me/points': () => {
    const cust = requireCustomer()
    const ccs = state.customerCards.filter(c => c.customerId === cust.id && c.isLinked)
    return { status: 200, data: ccs.map(cc => {
      const pb = S.pointBalances.find(p => p.customerCardId === cc.id)
      const card = state.cards.find(c => c.id === cc.cardId)
      return { customerCardId: cc.id, cardName: card.name,
               balance: pb ? pb.balance : 0, expiringAmount: pb ? pb.expiringAmount : 0,
               expiringAt: pb ? pb.expiringAt : null }
    }) }
  },

  /* ---------- [화면 4] 페이·정기결제 현황 ---------- */
  'GET /me/channels/usage': (q = {}) => {
    const cust = requireCustomer()
    assertDiagnosable(cust)
    return { status: 200, data: E.channelUsage(cust.id, q.baseMonth || S.BASE_MONTH) }
  },

  'GET /me/subscriptions': (q = {}) => {
    const cust = requireCustomer()
    return { status: 200, data: E.subscriptionsOf(cust.id, q.status ?? 'ACTIVE') }
  },

  'PATCH /me/subscriptions/:id': (body, p) => {
    const cust = requireCustomer()
    const sub = state.subscriptions.find(s => s.id === Number(p.id) && s.customerId === cust.id)
    if (!sub) throw err(404, 'NOT_FOUND', '해당 정기결제를 찾을 수 없습니다.')
    if (body.customerCardId != null) {
      const cc = state.customerCards.find(c => c.id === Number(body.customerCardId) && c.customerId === cust.id && c.isLinked)
      if (!cc) throw err(400, 'INVALID_PARAMETER', '보유하신 카드만 선택할 수 있습니다.', { field: 'customerCardId' })
      sub.customerCardId = cc.id
      // 해당 정기결제 거래의 카드도 함께 이동 (재계산 반영)
      S.transactions.filter(t => t.subscriptionId === sub.id).forEach(t => { t.customerCardId = cc.id })
    }
    if (body.status) sub.status = body.status
    sub.updatedAt = new Date().toISOString().slice(0, 19)
    const out = E.subscriptionsOf(cust.id, null).find(s => s.id === sub.id)
    return { status: 200, data: out }
  },

  /* ---------- [화면 5] 개선 제안 ---------- */
  'POST /me/recommendations': (body = {}) => {
    const cust = requireCustomer()
    assertDiagnosable(cust)
    const r = E.optimize(cust.id, body.baseMonth || S.BASE_MONTH)
    const saved = { id: ++state.seqReco, customerId: cust.id, ...r }
    state.recommendations.push(saved)
    return { status: 201, data: clone(saved) }
  },

  'GET /me/recommendations/latest': () => {
    const cust = requireCustomer()
    const list = state.recommendations.filter(r => r.customerId === cust.id)
    if (!list.length) throw err(404, 'NOT_FOUND', '아직 산출된 제안이 없습니다.')
    return { status: 200, data: clone(list[list.length - 1]) }
  },

  'GET /me/recommendations/:id': (_, p) => {
    const cust = requireCustomer()
    const r = state.recommendations.find(x => x.id === Number(p.id))
    if (!r) throw err(404, 'NOT_FOUND', '해당 제안을 찾을 수 없습니다.')
    if (r.customerId !== cust.id) throw err(403, 'FORBIDDEN', '접근 권한이 없습니다.')
    return { status: 200, data: clone(r) }
  },

  'POST /me/recommendations/:id/accept': (_, p) => {
    const cust = requireCustomer()
    const r = state.recommendations.find(x => x.id === Number(p.id) && x.customerId === cust.id)
    if (!r) throw err(404, 'NOT_FOUND', '해당 제안을 찾을 수 없습니다.')
    if (r.status === 'NO_CHANGE_NEEDED')
      throw err(409, 'NOT_ACCEPTABLE_RECOMMENDATION', '변경 실익이 없는 제안은 수락할 수 없습니다.')
    if (r.status === 'ACCEPTED')
      throw err(409, 'ALREADY_ACCEPTED', '이미 수락한 제안입니다.')
    r.status = 'ACCEPTED'
    r.acceptedAt = new Date().toISOString().slice(0, 19)
    return { status: 200, data: clone(r) }
  },

  'GET /me/benefit-utilization': (q = {}) => {
    const cust = requireCustomer()
    assertDiagnosable(cust)
    return { status: 200, data: E.categoryUtilization(cust.id, q.baseMonth || S.BASE_MONTH) }
  },

  'GET /me/card-suggestions': (q = {}) => {
    const cust = requireCustomer()
    assertDiagnosable(cust)
    return { status: 200, data: E.newCardCandidates(cust.id, q.baseMonth || S.BASE_MONTH) }
  },

  'GET /me/alerts/tier-gap': (q = {}) => {
    const cust = requireCustomer()
    assertDiagnosable(cust)
    return { status: 200, data: E.tierGapAlerts(cust.id, q.baseMonth || S.BASE_MONTH) }
  },

  /* ---------- [화면 6] 카드사 대시보드 ---------- */
  'GET /issuer/dashboard/summary': (q = {}) => {
    requireIssuer()
    return { status: 200, data: E.issuerSummary(q.baseMonth || S.BASE_MONTH) }
  },

  'GET /issuer/dashboard/channels': (q = {}) => {
    requireIssuer()
    const months = q.months == null ? 6 : Number(q.months)
    if (months < 1 || months > 12)
      throw err(400, 'INVALID_PARAMETER', '추이 조회 개월 수는 1~12 사이여야 합니다.', { field: 'months' })
    return { status: 200, data: E.channelPositions(q.baseMonth || S.BASE_MONTH, months) }
  },

  /* ---------- [화면 7] 시뮬레이션 / 세그먼트 ---------- */
  'POST /issuer/simulations': (body) => {
    requireIssuer()
    if (!body.cardId) throw err(400, 'INVALID_PARAMETER', '대상 카드를 선택해 주세요.', { field: 'cardId' })
    if (!state.cards.some(c => c.id === Number(body.cardId)))
      throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')

    /* --- 파라미터 범위 검증 (화면 7 예외 시나리오) --- */
    const errors = []
    ;(body.channelRates || []).forEach((r, i) => {
      if (r.performanceRate < 0 || r.performanceRate > 1)
        errors.push({ field: `channelRates[${i}].performanceRate`,
                      message: '채널 인정률은 0 이상 1 이하여야 합니다.' })
    })
    if (body.totalMonthlyBenefitLimit != null && body.totalMonthlyBenefitLimit < 0)
      errors.push({ field: 'totalMonthlyBenefitLimit', message: '통합 월한도는 0 이상이어야 합니다.' })

    const tiers = [...(body.tierAdjustments || [])].sort((a, b) => a.tierLevel - b.tierLevel)
    tiers.forEach((t, i) => {
      if (t.minPerformance < 0)
        errors.push({ field: `tierAdjustments[${i}].minPerformance`, message: '실적 구간 하한은 0 이상이어야 합니다.' })
      if (i > 0 && t.minPerformance <= tiers[i - 1].minPerformance)
        errors.push({ field: `tierAdjustments[${i}].minPerformance`,
                      message: '상위 구간의 하한이 하위 구간보다 작거나 같을 수 없습니다.' })
    })
    if (errors.length)
      throw err(400, 'INVALID_PARAMETER', errors[0].message, { field: errors[0].field, errors })

    return { status: 200, data: E.simulate({ ...body, cardId: Number(body.cardId) }) }
  },

  'POST /issuer/segments': (body = {}) => {
    requireIssuer()
    if (body.minSpending != null && body.minSpending < 0)
      throw err(400, 'INVALID_PARAMETER', '최소 결제액은 0 이상이어야 합니다.', { field: 'minSpending' })
    return { status: 200, data: E.extractSegment(body) }
  },

  /* ---------- [화면 8] 카드·혜택 규칙 관리 ---------- */
  'GET /issuer/cards': () => {
    requireIssuer()
    return { status: 200, data: { content: state.cards.map(clone), page: 0, size: 20,
                                  totalElements: state.cards.length, totalPages: 1 } }
  },

  'POST /issuer/cards': (body) => {
    requireIssuer()
    if (!body.cardCode || !body.name || body.annualFee == null)
      throw err(400, 'INVALID_PARAMETER', '상품 코드·상품명·연회비는 필수입니다.')
    if (body.annualFee < 0) throw err(400, 'INVALID_PARAMETER', '연회비는 0 이상이어야 합니다.', { field: 'annualFee' })
    if (state.cards.some(c => c.cardCode === body.cardCode))
      throw err(409, 'DUPLICATE_CARD_CODE', '이미 존재하는 상품 코드입니다.', { field: 'cardCode' })
    const card = { id: Math.max(...state.cards.map(c => c.id)) + 1, isActive: true, ...body }
    state.cards.push(card)
    return { status: 201, data: clone(card) }
  },

  'GET /issuer/cards/:id': (_, p) => {
    requireIssuer()
    const card = state.cards.find(c => c.id === Number(p.id))
    if (!card) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    return { status: 200, data: {
      ...clone(card),
      tiers: state.tiers.filter(t => t.cardId === card.id).sort((a, b) => a.tierLevel - b.tierLevel),
      benefitRules: state.benefitRules.filter(r => r.cardId === card.id).map(r => ({
        ...r,
        categoryName: S.spendingCategories.find(c => c.id === r.categoryId).name,
        tierLevel: state.tiers.find(t => t.id === r.tierId).tierLevel,
      })),
      channelRates: state.cardChannelRates.filter(r => r.cardId === card.id).map(r => ({
        ...r,
        channelName: S.payChannels.find(c => c.id === r.channelId).name,
        channelType: S.payChannels.find(c => c.id === r.channelId).channelType,
      })),
    } }
  },

  'PUT /issuer/cards/:id': (body, p) => {
    requireIssuer()
    const card = state.cards.find(c => c.id === Number(p.id))
    if (!card) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    if (body.annualFee != null && body.annualFee < 0)
      throw err(400, 'INVALID_PARAMETER', '연회비는 0 이상이어야 합니다.', { field: 'annualFee' })
    if (body.totalMonthlyBenefitLimit != null && body.totalMonthlyBenefitLimit < 0)
      throw err(400, 'INVALID_PARAMETER', '통합 월한도는 0 이상이어야 합니다.', { field: 'totalMonthlyBenefitLimit' })
    Object.assign(card, body)
    return { status: 200, data: clone(card) }
  },

  'GET /issuer/cards/:id/tiers': (_, p) => {
    requireIssuer()
    return { status: 200, data: state.tiers.filter(t => t.cardId === Number(p.id)).sort((a, b) => a.tierLevel - b.tierLevel) }
  },

  'PUT /issuer/cards/:id/tiers': (body, p) => {
    requireIssuer()
    const cardId = Number(p.id)
    if (!state.cards.some(c => c.id === cardId)) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    const list = [...body].sort((a, b) => a.tierLevel - b.tierLevel)
    list.forEach((t, i) => {
      if (t.minPerformance < 0)
        throw err(400, 'INVALID_PARAMETER', '실적 구간 하한은 0 이상이어야 합니다.', { field: `[${i}].minPerformance` })
      if (i > 0 && t.minPerformance <= list[i - 1].minPerformance)
        throw err(400, 'INVALID_PARAMETER', '상위 구간의 하한이 하위 구간보다 작거나 같을 수 없습니다.', { field: `[${i}].minPerformance` })
    })
    state.tiers = state.tiers.filter(t => t.cardId !== cardId)
      .concat(list.map((t, i) => ({ id: cardId * 10 + i + 1, cardId, ...t })))
    return { status: 200, data: state.tiers.filter(t => t.cardId === cardId) }
  },

  'GET /issuer/cards/:id/benefit-rules': (q = {}, p) => {
    requireIssuer()
    let rules = state.benefitRules.filter(r => r.cardId === Number(p.id))
    if (q.tierLevel != null) {
      const tierIds = state.tiers.filter(t => t.cardId === Number(p.id) && t.tierLevel === Number(q.tierLevel)).map(t => t.id)
      rules = rules.filter(r => tierIds.includes(r.tierId))
    }
    return { status: 200, data: rules.map(r => ({
      ...r,
      categoryName: S.spendingCategories.find(c => c.id === r.categoryId).name,
      tierLevel: state.tiers.find(t => t.id === r.tierId)?.tierLevel,
    })) }
  },

  'POST /issuer/cards/:id/benefit-rules': (body, p) => {
    requireIssuer()
    const cardId = Number(p.id)
    if (!state.cards.some(c => c.id === cardId)) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    if (body.rate < 0 || body.rate > 1)
      throw err(400, 'INVALID_PARAMETER', '비율은 0 이상 1 이하여야 합니다.', { field: 'rate' })
    if (state.benefitRules.some(r => r.cardId === cardId && r.categoryId === body.categoryId && r.tierId === body.tierId))
      throw err(409, 'DUPLICATE_BENEFIT_RULE', '동일한 카테고리·구간 조합의 규칙이 이미 존재합니다.')
    const rule = { id: Math.max(...state.benefitRules.map(r => r.id)) + 1, cardId, isActive: true,
                   minTransactionAmount: 0, perTransactionLimit: null, monthlyItemLimit: null, ...body }
    state.benefitRules.push(rule)
    return { status: 201, data: clone(rule) }
  },

  'PUT /issuer/benefit-rules/:id': (body, p) => {
    requireIssuer()
    const rule = state.benefitRules.find(r => r.id === Number(p.id))
    if (!rule) throw err(404, 'NOT_FOUND', '해당 혜택 규칙을 찾을 수 없습니다.')
    if (body.rate != null && (body.rate < 0 || body.rate > 1))
      throw err(400, 'INVALID_PARAMETER', '비율은 0 이상 1 이하여야 합니다.', { field: 'rate' })
    Object.assign(rule, body)
    return { status: 200, data: clone(rule) }
  },

  'DELETE /issuer/benefit-rules/:id': (_, p) => {
    requireIssuer()
    const i = state.benefitRules.findIndex(r => r.id === Number(p.id))
    if (i < 0) throw err(404, 'NOT_FOUND', '해당 혜택 규칙을 찾을 수 없습니다.')
    state.benefitRules.splice(i, 1)
    return { status: 204 }
  },

  'GET /issuer/cards/:id/channel-rates': (_, p) => {
    requireIssuer()
    return { status: 200, data: state.cardChannelRates.filter(r => r.cardId === Number(p.id)).map(r => ({
      ...r,
      channelName: S.payChannels.find(c => c.id === r.channelId).name,
      channelType: S.payChannels.find(c => c.id === r.channelId).channelType,
    })) }
  },

  'PUT /issuer/cards/:id/channel-rates': (body, p) => {
    const user = requireIssuer()
    const cardId = Number(p.id)
    if (!state.cards.some(c => c.id === cardId)) throw err(404, 'NOT_FOUND', '해당 카드를 찾을 수 없습니다.')
    body.forEach((r, i) => {
      if (r.performanceRate < 0 || r.performanceRate > 1)
        throw err(400, 'INVALID_PARAMETER', '채널 인정률은 0 이상 1 이하여야 합니다.', { field: `[${i}].performanceRate` })
    })
    for (const r of body) {
      const target = state.cardChannelRates.find(x => x.cardId === cardId && x.channelId === r.channelId)
      const patch = { performanceRate: r.performanceRate,
                      isBenefitEligible: r.isBenefitEligible !== false,
                      effectiveFrom: r.effectiveFrom || new Date().toISOString().slice(0, 10),
                      updatedBy: user.id, updatedAt: new Date().toISOString().slice(0, 19) }
      if (target) Object.assign(target, patch)
      else state.cardChannelRates.push({ id: Date.now() + r.channelId, cardId, channelId: r.channelId, ...patch })
    }
    // 엔진이 참조하는 원본에도 반영 (고객 화면에 즉시 전파)
    S.cardChannelRates.length = 0
    S.cardChannelRates.push(...state.cardChannelRates)
    return { status: 200, data: state.cardChannelRates.filter(r => r.cardId === cardId).map(r => ({
      ...r, channelName: S.payChannels.find(c => c.id === r.channelId).name })) }
  },

  /* ---------- 공통 기준 정보 ---------- */
  'GET /channels':   () => ({ status: 200, data: S.payChannels.map(clone) }),
  'GET /categories': () => ({ status: 200, data: S.spendingCategories.map(clone) }),

  /* ---------- 외부 시스템 (명세만 · 데모용 최소 구현) ---------- */
  'POST /external/transactions': (body) => {
    if (!body.transactions?.length) throw err(400, 'INVALID_PARAMETER', 'transactions 는 1건 이상이어야 합니다.')
    let saved = 0, dup = 0
    for (const t of body.transactions) {
      if (S.transactions.some(x => x.externalTxId === t.externalTxId)) { dup++; continue }
      saved++
    }
    return { status: 201, data: { receivedCount: body.transactions.length, savedCount: saved,
                                  duplicatedCount: dup, normalizationFailedCount: 0 } }
  },
}

function publicUser(u) {
  const c = state.customers.find(x => x.userId === u.id)
  return { id: u.id, email: u.email, name: u.name, role: u.role,
           joinedAt: c ? c.joinedAt : null, createdAt: u.createdAt }
}

export { state as mockState }
