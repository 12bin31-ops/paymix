/* ============================================================
   시드 데이터 — DBML 14개 테이블과 1:1 대응
   고객 3명으로 예외 시나리오 3종을 모두 재현한다.
     subin@paymix.co.kr  정상 (제안 있음)
     newbie@paymix.co.kr 가입 1개월 미만 → 화면3 진단 불가 (422)
     optimal@paymix.co.kr 이미 최적    → 화면5 변경 실익 없음
     issuer@paymix.co.kr 카드사 담당자
   ============================================================ */

export const BASE_MONTH = '2026-08'

/* ---------- users ---------- */
export const users = [
  { id: 1, email: 'subin@paymix.co.kr',   passwordHash: 'paymix123', name: '박수빈', role: 'CUSTOMER',       createdAt: '2025-03-14T10:00:00' },
  { id: 2, email: 'newbie@paymix.co.kr',  passwordHash: 'paymix123', name: '김신규', role: 'CUSTOMER',       createdAt: '2026-08-25T10:00:00' },
  { id: 3, email: 'optimal@paymix.co.kr', passwordHash: 'paymix123', name: '이최적', role: 'CUSTOMER',       createdAt: '2024-11-02T10:00:00' },
  { id: 9, email: 'issuer@paymix.co.kr',  passwordHash: 'paymix123', name: '이담당', role: 'ISSUER_MANAGER', createdAt: '2025-01-02T10:00:00' },
]

/* ---------- customers ---------- */
export const customers = [
  { id: 1, userId: 1, birthYear: 1999, joinedAt: '2025-03-14' },
  { id: 2, userId: 2, birthYear: 2001, joinedAt: '2026-08-25' },  // 가입 14일 → 진단 불가
  { id: 3, userId: 3, birthYear: 1988, joinedAt: '2024-11-02' },
]

/* ---------- spending_categories ---------- */
export const spendingCategories = [
  { id: 1, code: 'FOOD',      name: '외식',   defaultPerformanceRate: 1.0, isExcludedByDefault: false, displayOrder: 1 },
  { id: 2, code: 'SHOPPING',  name: '쇼핑',   defaultPerformanceRate: 1.0, isExcludedByDefault: false, displayOrder: 2 },
  { id: 3, code: 'TRANSPORT', name: '교통',   defaultPerformanceRate: 1.0, isExcludedByDefault: false, displayOrder: 3 },
  { id: 4, code: 'CAFE',      name: '카페',   defaultPerformanceRate: 1.0, isExcludedByDefault: false, displayOrder: 4 },
  { id: 5, code: 'TELECOM',   name: '통신비', defaultPerformanceRate: 0.0, isExcludedByDefault: true,  displayOrder: 5 },
  { id: 6, code: 'UTILITY',   name: '공과금', defaultPerformanceRate: 0.0, isExcludedByDefault: true,  displayOrder: 6 },
  { id: 7, code: 'SUBSCRIPTION', name: '구독', defaultPerformanceRate: 0.0, isExcludedByDefault: true, displayOrder: 7 },
  { id: 8, code: 'MEDICAL',   name: '의료',   defaultPerformanceRate: 1.0, isExcludedByDefault: false, displayOrder: 8 },
  { id: 9, code: 'PREPAID_CHARGE', name: '선불 충전', defaultPerformanceRate: 0.0, isExcludedByDefault: true, displayOrder: 9 },
]

/* ---------- pay_channels ---------- */
export const payChannels = [
  { id: 1, code: 'PHYSICAL',    name: '실물카드',   channelType: 'PHYSICAL',   rewardRate: 0.000, isActive: true },
  { id: 2, code: 'SAMSUNG_PAY', name: '삼성페이',   channelType: 'MOBILE_PAY', rewardRate: 0.005, isActive: true },
  { id: 3, code: 'NAVER_PAY',   name: '네이버페이', channelType: 'ONLINE_PAY', rewardRate: 0.020, isActive: true },
  { id: 4, code: 'KAKAO_PAY',   name: '카카오페이', channelType: 'ONLINE_PAY', rewardRate: 0.015, isActive: true },
  { id: 5, code: 'APPLE_PAY',   name: '애플페이',   channelType: 'MOBILE_PAY', rewardRate: 0.000, isActive: true },
]

/* ---------- cards ---------- */
export const cards = [
  { id: 1, cardCode: 'PM-PLATINUM', name: 'PayMix 플래티넘', brand: 'VISA',   annualFee: 30000,
    totalMonthlyBenefitLimit: 50000, description: '간편결제 전 채널 실적 100% 인정', isActive: true },
  { id: 2, cardCode: 'PM-CLASSIC',  name: 'PayMix 클래식',   brand: 'MASTER', annualFee: 15000,
    totalMonthlyBenefitLimit: 30000, description: '실물 결제 중심 · 외식 10% 할인', isActive: true },
  { id: 3, cardCode: 'PM-TRAVEL',   name: 'PayMix 트래블',   brand: 'VISA',   annualFee: 50000,
    totalMonthlyBenefitLimit: 80000, description: '해외·항공 특화 · 온라인페이 50% 인정', isActive: true },
  { id: 4, cardCode: 'PM-BASIC',    name: 'PayMix 베이직',   brand: 'MASTER', annualFee: 0,
    totalMonthlyBenefitLimit: 10000, description: '연회비 없는 입문형', isActive: false },
]

/* ---------- card_performance_tiers ---------- */
export const cardPerformanceTiers = [
  // 플래티넘
  { id: 11, cardId: 1, tierLevel: 0, tierName: '실적 미달',   minPerformance: 0,      maxPerformance: 299999 },
  { id: 12, cardId: 1, tierLevel: 1, tierName: '30만원 이상', minPerformance: 300000, maxPerformance: 499999 },
  { id: 13, cardId: 1, tierLevel: 2, tierName: '50만원 이상', minPerformance: 500000, maxPerformance: null },
  // 클래식
  { id: 21, cardId: 2, tierLevel: 0, tierName: '실적 미달',   minPerformance: 0,      maxPerformance: 199999 },
  { id: 22, cardId: 2, tierLevel: 1, tierName: '20만원 이상', minPerformance: 200000, maxPerformance: 399999 },
  { id: 23, cardId: 2, tierLevel: 2, tierName: '40만원 이상', minPerformance: 400000, maxPerformance: null },
  // 트래블
  { id: 31, cardId: 3, tierLevel: 0, tierName: '실적 미달',   minPerformance: 0,      maxPerformance: 499999 },
  { id: 32, cardId: 3, tierLevel: 1, tierName: '50만원 이상', minPerformance: 500000, maxPerformance: null },
  // 베이직
  { id: 41, cardId: 4, tierLevel: 0, tierName: '실적 미달',   minPerformance: 0,      maxPerformance: 99999 },
  { id: 42, cardId: 4, tierLevel: 1, tierName: '10만원 이상', minPerformance: 100000, maxPerformance: null },
]

/* ---------- benefit_rules ----------
   card × category × tier 단위. 3종 한도(건당/항목월/통합월) 중첩 적용 */
let brId = 3000
const R = (cardId, tierId, categoryId, benefitType, rate, perTx, monthlyItem, minTx = 0) =>
  ({ id: ++brId, cardId, tierId, categoryId, benefitType, rate,
     perTransactionLimit: perTx, monthlyItemLimit: monthlyItem, minTransactionAmount: minTx, isActive: true })

export const benefitRules = [
  // ===== 플래티넘 Lv.1 (30만원 이상) =====
  R(1, 12, 1, 'DISCOUNT', 0.07, 4000, 14000, 10000),  // 외식
  R(1, 12, 2, 'DISCOUNT', 0.03, 2500, 10000, 0),      // 쇼핑
  R(1, 12, 4, 'DISCOUNT', 0.05, 2000,  6000, 0),      // 카페
  R(1, 12, 3, 'DISCOUNT', 0.05, 1000,  5000, 0),      // 교통
  R(1, 12, 7, 'POINT',    0.05, null,  3000, 0),      // 구독
  // ===== 플래티넘 Lv.2 (50만원 이상) =====
  R(1, 13, 1, 'DISCOUNT', 0.10, 5000, 20000, 10000),
  R(1, 13, 2, 'DISCOUNT', 0.05, 3000, 15000, 0),
  R(1, 13, 4, 'DISCOUNT', 0.07, 3000, 10000, 0),
  R(1, 13, 3, 'DISCOUNT', 0.07, 1500,  8000, 0),
  R(1, 13, 7, 'POINT',    0.10, null,  5000, 0),
  R(1, 13, 5, 'DISCOUNT', 0.03, 2000,  6000, 0),      // 통신비
  // ===== 클래식 Lv.1 =====
  R(2, 22, 1, 'DISCOUNT', 0.05, 3000,  8000, 0),
  R(2, 22, 4, 'DISCOUNT', 0.03, 1500,  4000, 0),
  // ===== 클래식 Lv.2 =====
  R(2, 23, 1, 'DISCOUNT', 0.10, 4000, 12000, 0),
  R(2, 23, 2, 'DISCOUNT', 0.02, 2000,  6000, 0),
  R(2, 23, 4, 'DISCOUNT', 0.05, 2000,  6000, 0),
  // ===== 트래블 Lv.1 =====
  R(3, 32, 2, 'DISCOUNT', 0.06, 5000, 25000, 0),
  R(3, 32, 3, 'DISCOUNT', 0.10, 3000, 15000, 0),
  R(3, 32, 1, 'DISCOUNT', 0.05, 3000, 10000, 0),
]

/* ---------- card_channel_rates ★ 교차 엔티티 ----------
   실무 기준 두 축을 분리한다.

   performance_rate     전월실적 인정률
     - 간편결제라고 실적에서 빼는 정책은 드물다. 카드사 입장에선 페이 경유도 자사 카드 결제이고
       수수료도 자사 몫이므로 대부분 100% 인정한다.
     - 예외는 연회비 없는 엔트리 상품처럼 실적 조건이 빡빡한 경우로 한정된다.

   is_benefit_eligible  업종별 할인·적립 적용 여부  ★ 실제 손실의 주 원인
     - 간편결제·PG 경유 결제는 가맹점 정보가 대표 가맹점(예: 네이버파이낸셜)으로 넘어와
       업종 판정이 불가능하다. 그래서 다수 카드 약관이 "간편결제 이용 건은 영역별 할인 제외"를 명시한다.
     - 페이사와 세부 가맹점 정보 제휴가 된 상위 상품만 업종 혜택을 그대로 적용한다.
       → 이 차이가 카드 상품별 경쟁력이 되며, PayMix 가 겨냥하는 지점이다.
*/
let ccrId = 200
const CR = (cardId, channelId, performanceRate, isBenefitEligible) =>
  ({ id: ++ccrId, cardId, channelId, performanceRate, isBenefitEligible,
     effectiveFrom: '2026-01-01', updatedBy: 9, updatedAt: '2026-01-01T09:00:00' })

export const cardChannelRates = [
  // 플래티넘 — 페이사 업종 데이터 제휴 완료. 간편결제로 결제해도 업종 혜택 그대로 적용
  CR(1, 1, 1.0, true), CR(1, 2, 1.0, true), CR(1, 3, 1.0, true), CR(1, 4, 1.0, true), CR(1, 5, 1.0, true),
  // 클래식 — 실물·단말페이만 업종 혜택. 온라인 간편결제는 약관상 영역별 할인 제외
  CR(2, 1, 1.0, true), CR(2, 2, 1.0, true), CR(2, 3, 1.0, false), CR(2, 4, 1.0, false), CR(2, 5, 1.0, false),
  // 트래블 — 온라인 특화. 간편결제 혜택은 되지만 실물 오프라인 혜택이 약함
  CR(3, 1, 1.0, false), CR(3, 2, 1.0, true), CR(3, 3, 1.0, true), CR(3, 4, 1.0, true), CR(3, 5, 1.0, true),
  // 베이직 — 연회비 0원. 실적 조건이 빡빡해 간편결제분은 50%만 인정하고 업종 혜택도 제외
  CR(4, 1, 1.0, true), CR(4, 2, 0.5, false), CR(4, 3, 0.5, false), CR(4, 4, 0.5, false), CR(4, 5, 0.5, false),
]

/* ---------- customer_cards ---------- */
export const customerCards = [
  { id: 101, customerId: 1, cardId: 1, maskedNumber: '1234-****-****-5678', cardAlias: '주력카드',
    isLinked: true, linkedAt: '2025-03-14T11:20:00', lastSyncedAt: '2026-09-08T09:12:00' },
  { id: 102, customerId: 1, cardId: 2, maskedNumber: '9876-****-****-4321', cardAlias: null,
    isLinked: true, linkedAt: '2025-06-02T14:05:00', lastSyncedAt: '2026-09-08T09:12:00' },
  { id: 201, customerId: 2, cardId: 2, maskedNumber: '4444-****-****-2222', cardAlias: null,
    isLinked: true, linkedAt: '2026-08-25T10:30:00', lastSyncedAt: '2026-09-08T09:12:00' },
  { id: 301, customerId: 3, cardId: 1, maskedNumber: '7777-****-****-3333', cardAlias: '메인',
    isLinked: true, linkedAt: '2024-11-02T09:00:00', lastSyncedAt: '2026-09-08T09:12:00' },
]

/* ---------- point_balances ---------- */
export const pointBalances = [
  { id: 1, customerCardId: 101, balance: 12400, expiringAmount: 3200, expiringAt: '2026-11-30', updatedAt: '2026-09-08T09:12:00' },
  { id: 2, customerCardId: 102, balance: 3150,  expiringAmount: 0,    expiringAt: null,         updatedAt: '2026-09-08T09:12:00' },
  { id: 3, customerCardId: 201, balance: 0,     expiringAmount: 0,    expiringAt: null,         updatedAt: '2026-09-08T09:12:00' },
  { id: 4, customerCardId: 301, balance: 28900, expiringAmount: 1100, expiringAt: '2026-12-31', updatedAt: '2026-09-08T09:12:00' },
]

/* ---------- subscriptions ---------- */
export const subscriptions = [
  { id: 501, customerId: 1, customerCardId: 102, categoryId: 7, merchantName: '넷플릭스',
    amount: 17000, billingCycle: 'MONTHLY', billingDay: 15, status: 'ACTIVE',
    deepLinkUrl: 'https://netflix.com/account/payment', startedAt: '2024-02-11' },
  { id: 502, customerId: 1, customerCardId: 101, categoryId: 5, merchantName: 'SKT 통신요금',
    amount: 68000, billingCycle: 'MONTHLY', billingDay: 25, status: 'ACTIVE',
    deepLinkUrl: 'https://www.tworld.co.kr/payment', startedAt: '2022-05-01' },
  { id: 503, customerId: 1, customerCardId: 101, categoryId: 7, merchantName: '유튜브 프리미엄',
    amount: 14900, billingCycle: 'MONTHLY', billingDay: 8, status: 'ACTIVE',
    deepLinkUrl: 'https://youtube.com/paid_memberships', startedAt: '2023-09-20' },
  { id: 504, customerId: 1, customerCardId: 102, categoryId: 6, merchantName: '한국전력 전기요금',
    amount: 42000, billingCycle: 'MONTHLY', billingDay: 20, status: 'ACTIVE',
    deepLinkUrl: null, startedAt: '2023-01-15' },
  { id: 511, customerId: 3, customerCardId: 301, categoryId: 7, merchantName: '스포티파이',
    amount: 11900, billingCycle: 'MONTHLY', billingDay: 3, status: 'ACTIVE',
    deepLinkUrl: 'https://spotify.com/account', startedAt: '2024-06-01' },
]

/* ---------- transactions ----------
   customerCardId × channelId × categoryId × amount 조합으로
   화면 3·4·5의 모든 수치가 실제 계산으로 나온다. */
let txId = 77000
const T = (customerCardId, channelId, categoryId, merchantName, amount, day, subscriptionId = null) => ({
  id: ++txId,
  externalTxId: `TX-202608${String(day).padStart(2, '0')}-${txId}`,
  customerCardId, channelId, categoryId, merchantName,
  normalizedMerchant: merchantName,
  amount, approvedAt: `2026-08-${String(day).padStart(2, '0')}T12:00:00`,
  status: 'APPROVED', subscriptionId,
})

export const transactions = [
  /* ===== 박수빈(customer 1) · 플래티넘(101) — 실물 + 삼성페이 중심. 혜택을 제대로 받는 카드 ===== */
  T(101, 1, 1, '한식당 본가',        48000,  2),
  T(101, 1, 1, '이자카야 소라',      62000,  9),
  T(101, 1, 1, '고깃집 마포',        70000, 21),
  T(101, 1, 8, '연세바른병원',       65000, 12),
  T(101, 1, 5, 'SKT 통신요금',       68000, 25, 502),   // 통신비 = 실적 제외 항목
  T(101, 2, 4, '스타벅스 판교',       6500,  3),
  T(101, 2, 4, '블루보틀',            9800,  7),
  T(101, 2, 4, '스타벅스 서현',       7200, 14),
  T(101, 2, 4, '투썸플레이스',        8400, 22),
  T(101, 2, 3, '서울교통공사',       58000, 10),
  T(101, 2, 2, '올리브영',           54000, 17),
  T(101, 4, 7, '유튜브 프리미엄',    14900,  8, 503),   // 구독 = 실적 제외 항목

  /* ===== 박수빈 · 클래식(102) — 네이버·카카오페이 중심 =====
     실적은 100% 인정되지만, 이 카드는 온라인 간편결제 건에 업종 할인을 적용하지 않는다.
     → 실적 등급은 최고인데 할인은 0원이 되는 구조. PayMix 가 잡아내려는 바로 그 상황. */
  T(102, 3, 2, '네이버페이_쿠팡',        182000,  4),
  T(102, 3, 2, '네이버페이_무신사',      124000, 11),
  T(102, 3, 2, '네이버페이_29CM',        114000, 19),
  T(102, 4, 1, '카카오페이_배달의민족',   38000,  6),
  T(102, 4, 1, '카카오페이_요기요',       27000, 13),
  T(102, 4, 4, '카카오페이_컴포즈커피',   12000, 16),
  T(102, 4, 2, '카카오페이_지마켓',       76000, 23),
  T(102, 4, 7, '넷플릭스',                17000, 15, 501),   // 구독 = 실적 제외
  T(102, 1, 6, '한국전력 전기요금',       42000, 20, 504),   // 공과금 = 실적 제외
  T(102, 3, 9, '네이버페이 머니 충전',   150000,  5),        // 선불 충전 = 실적 제외

  /* ===== 김신규(customer 2) — 가입 14일, 거래 3건 (진단 불가) ===== */
  T(201, 1, 1, '김밥천국',            9000, 26),
  T(201, 2, 4, '이디야커피',          4500, 28),
  T(201, 1, 2, '다이소',             12000, 30),

  /* ===== 이최적(customer 3) — 플래티넘 단독. 전 채널 업종 혜택 적용 (이미 최적) ===== */
  T(301, 1, 1, '한우담',             98000,  5),
  T(301, 2, 1, '스시선',             86000, 12),
  T(301, 2, 4, '카페 소소',          24000,  8),
  T(301, 3, 2, '네이버페이_쿠팡',   165000, 15),
  T(301, 3, 2, '네이버페이_쇼핑',   142000, 22),
  T(301, 2, 3, '서울교통공사',       62000, 10),
  T(301, 4, 7, '스포티파이',         11900,  3, 511),
  T(301, 1, 8, '서울대병원',         73000, 18),
]

/* 카드사 대시보드용 모집단 규모 (시연용 스케일 팩터) */
export const ISSUER_SCALE = {
  totalCustomers: 12480,
  activeCustomers: 10233,
}
