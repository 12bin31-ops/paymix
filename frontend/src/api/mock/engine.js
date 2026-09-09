/* ============================================================
   PayMix 규칙 엔진
   ------------------------------------------------------------
   ① 인정실적 = Σ (결제액 × 카테고리인정률 × 채널인정률)
   ② 실적 구간 판정 → 적용 혜택 세트 확정
   ③ 실효혜택 = min( Σ min(결제액 × 할인율, 항목월한도), 통합월한도 )
   ④ 연간 순이익 = ((실효혜택 + 채널적립) × 12) − 연회비
   ⑤ 최적 배치 = (페이채널 × 보유카드), (정기결제 × 보유카드) 조합 중 순이익 최대

   ※ 모든 수치는 이 엔진이 산출한다. AI는 확정된 수치를 설명만 한다.
   ============================================================ */

import * as S from './seed.js'

const byId = (arr, id) => arr.find(x => x.id === id)
const monthOf = ts => String(ts).slice(0, 7)

/* ---------- 조회 헬퍼 ---------- */
export const getCategory = id => byId(S.spendingCategories, id)
export const getChannel  = id => byId(S.payChannels, id)
export const getCard     = id => byId(S.cards, id)
export const getCustomerCard = id => byId(S.customerCards, id)
export const getCardOfCustomerCard = ccId => getCard(getCustomerCard(ccId).cardId)

/** 카드 × 채널 인정률 (교차 엔티티 조회) */
export function channelRate(cardId, channelId, overrides = null) {
  if (overrides) {
    const o = overrides.find(r => r.channelId === channelId)
    if (o) return { performanceRate: o.performanceRate, isBenefitEligible: o.isBenefitEligible !== false }
  }
  const r = S.cardChannelRates.find(x => x.cardId === cardId && x.channelId === channelId)
  return r ? { performanceRate: r.performanceRate, isBenefitEligible: r.isBenefitEligible } : { performanceRate: 1, isBenefitEligible: true }
}

/** 고객의 기준월 거래 */
export function txOf(customerId, baseMonth = S.BASE_MONTH) {
  const ccIds = S.customerCards.filter(c => c.customerId === customerId && c.isLinked).map(c => c.id)
  return S.transactions.filter(t =>
    ccIds.includes(t.customerCardId) && t.status === 'APPROVED' && monthOf(t.approvedAt) === baseMonth)
}

/* ============================================================
   ① 인정 실적
   ============================================================ */
export function recognizedPerformance(txs, cardId, opts = {}) {
  return txs.reduce((sum, t) => {
    const cat = getCategory(t.categoryId)
    const { performanceRate } = channelRate(cardId, t.channelId, opts.channelRateOverrides)
    return sum + Math.round(t.amount * cat.defaultPerformanceRate * performanceRate)
  }, 0)
}

/* ============================================================
   ② 실적 구간 판정
   ============================================================ */
export function judgeTier(cardId, performance, tierOverrides = null) {
  let tiers = S.cardPerformanceTiers.filter(t => t.cardId === cardId)
  if (tierOverrides) {
    tiers = tiers.map(t => {
      const o = tierOverrides.find(x => x.tierLevel === t.tierLevel)
      return o ? { ...t, minPerformance: o.minPerformance } : t
    })
  }
  tiers = [...tiers].sort((a, b) => b.minPerformance - a.minPerformance)
  return tiers.find(t => performance >= t.minPerformance) || tiers[tiers.length - 1]
}

export function nextTier(cardId, tierLevel, tierOverrides = null) {
  let tiers = S.cardPerformanceTiers.filter(t => t.cardId === cardId)
  if (tierOverrides) {
    tiers = tiers.map(t => {
      const o = tierOverrides.find(x => x.tierLevel === t.tierLevel)
      return o ? { ...t, minPerformance: o.minPerformance } : t
    })
  }
  return tiers.filter(t => t.tierLevel > tierLevel).sort((a, b) => a.tierLevel - b.tierLevel)[0] || null
}

/* ============================================================
   ③ 실효 혜택 — 건당 → 항목별 월 → 통합 월 3종 한도 중첩
   ============================================================ */
export function effectiveBenefit(txs, cardId, tierId, opts = {}) {
  const card = getCard(cardId)
  const rules = S.benefitRules.filter(r => r.cardId === cardId && r.tierId === tierId && r.isActive)

  const perCategory = {}   // categoryId → 누적
  let nominal = 0          // 한도 미적용 명목 혜택

  for (const t of txs) {
    const rule = rules.find(r => r.categoryId === t.categoryId)
    if (!rule) continue
    if (t.amount < rule.minTransactionAmount) continue
    const { isBenefitEligible } = channelRate(cardId, t.channelId, opts.channelRateOverrides)
    if (!isBenefitEligible) continue

    let amt = t.amount * rule.rate
    nominal += amt
    // 건당 한도
    if (rule.perTransactionLimit != null) amt = Math.min(amt, rule.perTransactionLimit)
    perCategory[t.categoryId] = (perCategory[t.categoryId] || 0) + amt
  }

  // 항목별 월 한도
  let sum = 0
  const breakdown = []
  for (const [catId, raw] of Object.entries(perCategory)) {
    const rule = rules.find(r => r.categoryId === Number(catId))
    const capped = rule.monthlyItemLimit != null ? Math.min(raw, rule.monthlyItemLimit) : raw
    sum += capped
    breakdown.push({
      categoryId: Number(catId),
      categoryName: getCategory(Number(catId)).name,
      benefitType: rule.benefitType,
      rate: rule.rate,
      raw: Math.round(raw),
      applied: Math.round(capped),
      monthlyItemLimit: rule.monthlyItemLimit,
      capped: rule.monthlyItemLimit != null && raw > rule.monthlyItemLimit,
    })
  }

  // 통합 월 한도
  const limit = opts.totalMonthlyBenefitLimit ?? card.totalMonthlyBenefitLimit
  const effective = limit != null ? Math.min(sum, limit) : sum

  return {
    nominalBenefit: Math.round(nominal),
    beforeTotalCap: Math.round(sum),
    effectiveBenefit: Math.round(effective),
    totalCapped: limit != null && sum > limit,
    breakdown: breakdown.sort((a, b) => b.applied - a.applied),
  }
}

/* ---------- 채널 자체 적립 ---------- */
export function channelReward(txs) {
  return Math.round(txs.reduce((s, t) => s + t.amount * getChannel(t.channelId).rewardRate, 0))
}

/* ============================================================
   ④ 연간 순이익
   ============================================================ */
export function annualNetBenefit(effective, reward, annualFee) {
  return (effective + reward) * 12 - annualFee
}

/* ============================================================
   카드 1장 종합 진단 (화면 3)
   ============================================================ */
export function diagnoseCard(customerCardId, baseMonth = S.BASE_MONTH) {
  const cc = getCustomerCard(customerCardId)
  const card = getCard(cc.cardId)
  const txs = S.transactions.filter(t =>
    t.customerCardId === customerCardId && t.status === 'APPROVED' && monthOf(t.approvedAt) === baseMonth)

  const totalSpending = txs.reduce((s, t) => s + t.amount, 0)
  const recognized = recognizedPerformance(txs, card.id)
  const tier = judgeTier(card.id, recognized)
  const nx = nextTier(card.id, tier.tierLevel)
  const ben = effectiveBenefit(txs, card.id, tier.id)
  const reward = channelReward(txs)
  const point = S.pointBalances.find(p => p.customerCardId === customerCardId)

  return {
    customerCardId,
    cardId: card.id,
    cardCode: card.cardCode,
    cardName: card.name,
    brand: card.brand,
    imageUrl: card.imageUrl || null,
    maskedNumber: cc.maskedNumber,
    cardAlias: cc.cardAlias,
    transactionCount: txs.length,
    totalSpending,
    recognizedPerformance: recognized,
    excludedAmount: totalSpending - recognized,
    currentTierLevel: tier.tierLevel,
    currentTierName: tier.tierName,
    nextTierName: nx ? nx.tierName : null,
    amountToNextTier: nx ? Math.max(0, nx.minPerformance - recognized) : null,
    tierMin: tier.minPerformance,
    tierMax: tier.maxPerformance,
    nextTierMin: nx ? nx.minPerformance : null,
    nominalBenefit: ben.nominalBenefit,
    effectiveBenefit: ben.effectiveBenefit,
    capLoss: ben.nominalBenefit - ben.effectiveBenefit,
    benefitBreakdown: ben.breakdown,
    totalCapped: ben.totalCapped,
    totalMonthlyBenefitLimit: card.totalMonthlyBenefitLimit,
    channelReward: reward,
    annualFee: card.annualFee,
    annualNetBenefit: annualNetBenefit(ben.effectiveBenefit, reward, card.annualFee),
    pointBalance: point ? point.balance : 0,
    pointExpiring: point ? point.expiringAmount : 0,
    pointExpiringAt: point ? point.expiringAt : null,
    /* 업종 할인 미적용 (간편결제 경유) — 실적 제외와 별개 손실 */
    benefitBlockedAmount: txs.filter(t => !channelRate(card.id, t.channelId).isBenefitEligible)
                             .reduce((s2, t) => s2 + t.amount, 0),
    benefitBlockedChannels: [...new Set(txs
      .filter(t => !channelRate(card.id, t.channelId).isBenefitEligible)
      .map(t => getChannel(t.channelId).name))],
  }
}

/* ============================================================
   실적 제외 내역 (화면 3)
   ============================================================ */
export function exclusions(customerCardId, baseMonth = S.BASE_MONTH) {
  const cc = getCustomerCard(customerCardId)
  const txs = S.transactions.filter(t =>
    t.customerCardId === customerCardId && t.status === 'APPROVED' && monthOf(t.approvedAt) === baseMonth)

  return txs.map(t => {
    const cat = getCategory(t.categoryId)
    const ch = getChannel(t.channelId)
    const { performanceRate } = channelRate(cc.cardId, t.channelId)
    const recognized = Math.round(t.amount * cat.defaultPerformanceRate * performanceRate)
    if (recognized === t.amount) return null

    let reason, msg
    if (cat.defaultPerformanceRate === 0) {
      reason = 'CATEGORY_EXCLUDED'
      msg = cat.code === 'PREPAID_CHARGE'
        ? '선불 충전은 물건을 산 게 아니라 돈을 옮긴 것이라 실적에서 제외됩니다.'
        : `${cat.name}은(는) 카드 약관상 전월실적 제외 항목입니다.`
    } else if (performanceRate === 0) {
      reason = 'CHANNEL_NOT_RECOGNIZED'; msg = `${ch.name} 결제분은 이 카드의 실적에 반영되지 않습니다.`
    } else {
      reason = 'PARTIALLY_RECOGNIZED'; msg = `${ch.name} 결제분은 ${Math.round(performanceRate * 100)}%만 실적에 반영됩니다.`
    }
    return {
      transactionId: t.id, merchantName: t.merchantName,
      categoryName: cat.name, channelName: ch.name,
      amount: t.amount,
      categoryPerformanceRate: cat.defaultPerformanceRate,
      channelPerformanceRate: performanceRate,
      recognizedAmount: recognized,
      lostAmount: t.amount - recognized,
      exclusionReason: reason, reasonMessage: msg,
      approvedAt: t.approvedAt,
    }
  }).filter(Boolean).sort((a, b) => b.lostAmount - a.lostAmount)
}

/* ============================================================
   업종 할인 미적용 손실 (화면 3·4)
   ------------------------------------------------------------
   간편결제·PG 경유 결제는 가맹점 정보가 대표 가맹점으로 넘어와 업종 판정이 되지 않는다.
   다수 카드 약관이 "간편결제 이용 건은 영역별 할인 제외"를 명시하는 이유다.
   실적에는 잡히지만 할인·적립을 못 받는, 실적 제외와는 완전히 다른 손실이다.
   ============================================================ */
export function benefitBlocks(customerCardId, baseMonth = S.BASE_MONTH) {
  const cc = getCustomerCard(customerCardId)
  const card = getCard(cc.cardId)
  const d = diagnoseCard(customerCardId, baseMonth)
  const tier = judgeTier(card.id, d.recognizedPerformance)
  const txs = S.transactions.filter(t =>
    t.customerCardId === customerCardId && t.status === 'APPROVED' && monthOf(t.approvedAt) === baseMonth)

  const rows = []
  const perCat = {}
  for (const t of txs) {
    const { isBenefitEligible } = channelRate(card.id, t.channelId)
    if (isBenefitEligible) continue
    const rule = S.benefitRules.find(r => r.cardId === card.id && r.tierId === tier.id
                                        && r.categoryId === t.categoryId && r.isActive)
    if (!rule || t.amount < rule.minTransactionAmount) continue
    let would = t.amount * rule.rate
    if (rule.perTransactionLimit != null) would = Math.min(would, rule.perTransactionLimit)
    perCat[t.categoryId] = (perCat[t.categoryId] || 0) + would
    rows.push({
      transactionId: t.id, merchantName: t.merchantName,
      categoryId: t.categoryId, categoryName: getCategory(t.categoryId).name,
      channelId: t.channelId, channelName: getChannel(t.channelId).name,
      amount: t.amount, rate: rule.rate,
      benefitType: rule.benefitType,
      wouldHaveEarned: Math.round(would),
      approvedAt: t.approvedAt,
    })
  }

  // 항목별 월한도 적용해 실제 손실 산정
  let lost = 0
  for (const [catId, raw] of Object.entries(perCat)) {
    const rule = S.benefitRules.find(r => r.cardId === card.id && r.tierId === tier.id
                                        && r.categoryId === Number(catId) && r.isActive)
    lost += rule.monthlyItemLimit != null ? Math.min(raw, rule.monthlyItemLimit) : raw
  }
  const cap = card.totalMonthlyBenefitLimit
  const headroom = cap != null ? Math.max(0, cap - d.effectiveBenefit) : Infinity
  lost = Math.min(Math.round(lost), headroom)

  const blockedChannels = [...new Set(rows.map(r => r.channelName))]
  return {
    customerCardId, cardName: card.name,
    blockedAmount: rows.reduce((s, r) => s + r.amount, 0),
    blockedCount: rows.length,
    lostBenefit: lost,
    blockedChannels,
    items: rows.sort((a, b) => b.wouldHaveEarned - a.wouldHaveEarned),
  }
}

/* ============================================================
   채널별 결제 비중 (화면 4)
   ============================================================ */
export function channelUsage(customerId, baseMonth = S.BASE_MONTH) {
  const txs = txOf(customerId, baseMonth)
  const total = txs.reduce((s, t) => s + t.amount, 0)

  const groups = {}
  for (const t of txs) {
    const g = groups[t.channelId] || (groups[t.channelId] = { amount: 0, count: 0, byCard: {}, recognized: 0 })
    g.amount += t.amount
    g.count++
    g.byCard[t.customerCardId] = (g.byCard[t.customerCardId] || 0) + t.amount
    const cardId = getCustomerCard(t.customerCardId).cardId
    g.recognized += Math.round(t.amount * getCategory(t.categoryId).defaultPerformanceRate
                    * channelRate(cardId, t.channelId).performanceRate)
  }

  const channels = Object.entries(groups).map(([chId, g]) => {
    const channelId = Number(chId)
    const mainCcId = Number(Object.entries(g.byCard).sort((a, b) => b[1] - a[1])[0][0])
    const mainCard = getCardOfCustomerCard(mainCcId)
    return {
      channelId,
      channelName: getChannel(channelId).name,
      channelType: getChannel(channelId).channelType,
      rewardRate: getChannel(channelId).rewardRate,
      amount: g.amount,
      ratio: total ? g.amount / total : 0,
      transactionCount: g.count,
      mainCustomerCardId: mainCcId,
      mainCardName: mainCard.name,
      performanceRate: channelRate(mainCard.id, channelId).performanceRate,
      isBenefitEligible: channelRate(mainCard.id, channelId).isBenefitEligible,
      recognizedAmount: g.recognized,
      lostAmount: g.amount - g.recognized,
    }
  }).sort((a, b) => b.amount - a.amount)

  /* 채널별 "놓친 업종 할인" — 카드 단위 손실을 채널에 배분 */
  const blockByCard = {}
  for (const cc of S.customerCards.filter(c => c.customerId === customerId && c.isLinked)) {
    blockByCard[cc.id] = benefitBlocks(cc.id, baseMonth)
  }
  for (const c of channels) {
    const bb = blockByCard[c.mainCustomerCardId]
    if (!bb || !bb.items.length || c.isBenefitEligible) { c.lostBenefit = 0; continue }
    const mine = bb.items.filter(i => i.channelId === c.channelId)
                         .reduce((s2, i) => s2 + i.wouldHaveEarned, 0)
    const all = bb.items.reduce((s2, i) => s2 + i.wouldHaveEarned, 0)
    c.lostBenefit = all ? Math.round(bb.lostBenefit * (mine / all)) : 0
  }

  return {
    baseMonth, totalSpending: total,
    totalRecognized: channels.reduce((s, c) => s + c.recognizedAmount, 0),
    totalLostBenefit: channels.reduce((s, c) => s + (c.lostBenefit || 0), 0),
    channels,
  }
}

/* ============================================================
   정기결제 목록 (화면 4)
   ============================================================ */
export function subscriptionsOf(customerId, status = 'ACTIVE') {
  return S.subscriptions
    .filter(s => s.customerId === customerId && (!status || s.status === status))
    .map(s => {
      const cc = getCustomerCard(s.customerCardId)
      const card = getCard(cc.cardId)
      const cat = getCategory(s.categoryId)
      const monthly = s.billingCycle === 'YEARLY' ? Math.round(s.amount / 12) : s.amount
      // 정기결제가 결제되는 채널: 거래에서 역추적, 없으면 실물
      const tx = S.transactions.find(t => t.subscriptionId === s.id)
      const channelId = tx ? tx.channelId : 1
      const { performanceRate } = channelRate(card.id, channelId)
      const recognized = Math.round(monthly * cat.defaultPerformanceRate * performanceRate)
      return {
        id: s.id, merchantName: s.merchantName,
        categoryId: s.categoryId, categoryName: cat.name,
        amount: s.amount, monthlyAmount: monthly,
        billingCycle: s.billingCycle, billingDay: s.billingDay, status: s.status,
        customerCardId: s.customerCardId, cardName: card.name,
        channelId, channelName: getChannel(channelId).name,
        isPerformanceRecognized: recognized > 0,
        recognizedAmount: recognized,
        categoryPerformanceRate: cat.defaultPerformanceRate,
        channelPerformanceRate: performanceRate,
        deepLinkUrl: s.deepLinkUrl, startedAt: s.startedAt,
      }
    })
}

/* ============================================================
   ⑤ 최적 배치 탐색 (화면 5)
   후보 = 고객이 이미 보유한 자사 카드로 한정
   ============================================================ */
export function optimize(customerId, baseMonth = S.BASE_MONTH) {
  const myCards = S.customerCards.filter(c => c.customerId === customerId && c.isLinked)
  const txs = txOf(customerId, baseMonth)

  /* --- 현재 배치 순이익 --- */
  let currentAnnual = 0
  for (const cc of myCards) currentAnnual += diagnoseCard(cc.id, baseMonth).annualNetBenefit

  /* --- 채널별 최적 카드 탐색 --- */
  const usage = channelUsage(customerId, baseMonth)
  const details = []

  for (const u of usage.channels) {
    const chTxs = txs.filter(t => t.channelId === u.channelId)
    const currentCard = getCardOfCustomerCard(u.mainCustomerCardId)

    // 각 보유 카드로 이 채널 거래를 처리했을 때의 월 혜택
    const evaluate = (cc) => {
      const card = getCard(cc.cardId)
      const rec = recognizedPerformance(chTxs, card.id)
      // 카드 전체 인정실적 기준으로 구간 판정 (이 채널을 옮겼다고 가정)
      const cardTxs = txs.filter(t => t.channelId === u.channelId || getCustomerCard(t.customerCardId).cardId === card.id)
      const tier = judgeTier(card.id, recognizedPerformance(cardTxs, card.id))
      const ben = effectiveBenefit(chTxs, card.id, tier.id)
      const rule = S.benefitRules.find(r => r.cardId === card.id && r.tierId === tier.id)
      const cr = channelRate(card.id, u.channelId)
      return {
        cc, card, tier,
        recognized: rec,
        benefit: ben.effectiveBenefit + channelReward(chTxs),
        rate: cr.performanceRate,
        eligible: cr.isBenefitEligible,
        benefitRate: rule ? rule.rate : null,
        monthlyLimit: rule ? rule.monthlyItemLimit : null,
      }
    }

    const options = myCards.map(evaluate)
    const best = options.reduce((a, b) => (b.benefit > a.benefit ? b : a))
    const cur = options.find(o => o.cc.id === u.mainCustomerCardId)

    if (best.cc.id !== u.mainCustomerCardId && best.benefit > cur.benefit) {
      details.push({
        id: 7000 + details.length + 1,
        detailType: 'CHANNEL_REASSIGN',
        channelId: u.channelId, channelName: u.channelName,
        subscriptionId: null, subscriptionName: null,
        currentCustomerCardId: u.mainCustomerCardId, currentCardName: currentCard.name,
        suggestedCustomerCardId: best.cc.id,
        snapshotCardName: best.card.name,
        snapshotChannelRate: best.rate,
        snapshotBenefitRate: best.benefitRate,
        snapshotMonthlyLimit: best.monthlyLimit,
        currentMonthlyBenefit: Math.round(cur.benefit),
        suggestedMonthlyBenefit: Math.round(best.benefit),
        monthlyGain: Math.round(best.benefit - cur.benefit),
        currentRate: cur.rate,
        currentEligible: cur.eligible,
        suggestedEligible: best.eligible,
        reason: (!cur.eligible && best.eligible)
          ? `${u.channelName} 결제에 업종 할인이 적용되지 않던 카드 → 적용되는 카드로 이동`
          : (cur.rate < best.rate)
            ? `${u.channelName} 실적 인정률 ${Math.round(cur.rate * 100)}% → ${Math.round(best.rate * 100)}%`
            : `${u.channelName}에서 혜택이 더 큰 카드로 이동`,
        displayOrder: details.length + 1,
      })
    }
  }

  /* --- 정기결제 이전 탐색 --- */
  for (const sub of subscriptionsOf(customerId)) {
    const cat = getCategory(sub.categoryId)
    const evaluate = (cc) => {
      const card = getCard(cc.cardId)
      const { performanceRate, isBenefitEligible } = channelRate(card.id, sub.channelId)
      const tier = judgeTier(card.id, diagnoseCard(cc.id, baseMonth).recognizedPerformance)
      const rule = S.benefitRules.find(r => r.cardId === card.id && r.tierId === tier.id && r.categoryId === sub.categoryId && r.isActive)
      const benefit = (rule && isBenefitEligible)
        ? Math.min(sub.monthlyAmount * rule.rate, rule.monthlyItemLimit ?? Infinity) : 0
      return { cc, card, rate: performanceRate, benefit, eligible: isBenefitEligible,
               recognized: Math.round(sub.monthlyAmount * cat.defaultPerformanceRate * performanceRate),
               benefitRate: rule ? rule.rate : null, monthlyLimit: rule ? rule.monthlyItemLimit : null }
    }
    const options = myCards.map(evaluate)
    const best = options.reduce((a, b) => (b.benefit + b.recognized * 0.001 > a.benefit + a.recognized * 0.001 ? b : a))
    const cur = options.find(o => o.cc.id === sub.customerCardId)

    if (best.cc.id !== sub.customerCardId && (best.benefit > cur.benefit || best.recognized > cur.recognized)) {
      details.push({
        id: 7000 + details.length + 1,
        detailType: 'SUBSCRIPTION_MOVE',
        channelId: sub.channelId, channelName: sub.channelName,
        subscriptionId: sub.id, subscriptionName: sub.merchantName,
        currentCustomerCardId: sub.customerCardId, currentCardName: sub.cardName,
        suggestedCustomerCardId: best.cc.id,
        snapshotCardName: best.card.name,
        snapshotChannelRate: best.rate,
        snapshotBenefitRate: best.benefitRate,
        snapshotMonthlyLimit: best.monthlyLimit,
        currentMonthlyBenefit: Math.round(cur.benefit),
        suggestedMonthlyBenefit: Math.round(best.benefit),
        monthlyGain: Math.round(best.benefit - cur.benefit),
        currentRate: cur.rate,
        currentEligible: cur.eligible,
        suggestedEligible: best.eligible,
        monthlyAmount: sub.monthlyAmount,
        reason: (!cur.eligible && best.eligible)
          ? `${sub.channelName} 결제라 할인이 적용되지 않던 카드 → 적용되는 카드로 이동`
          : cat.defaultPerformanceRate === 0
            ? `${cat.name}은 실적에는 안 잡히지만 이 카드는 ${best.benefitRate ? Math.round(best.benefitRate * 100) + '% 적립' : '혜택'} 대상`
            : `${sub.channelName}에서 혜택이 더 큰 카드로 이동`,
        displayOrder: details.length + 1,
      })
    }
  }

  const monthlyGain = details.reduce((s, d) => s + d.monthlyGain, 0)
  const optimizedAnnual = currentAnnual + monthlyGain * 12
  const annualGain = optimizedAnnual - currentAnnual

  /* --- AI 설명 생성 (확정 수치를 문장으로만 변환) --- */
  const explanation = buildExplanation(details, annualGain)

  return {
    baseMonth,
    status: annualGain <= 0 ? 'NO_CHANGE_NEEDED' : 'PENDING',
    currentAnnualNetBenefit: currentAnnual,
    optimizedAnnualNetBenefit: optimizedAnnual,
    annualGain,
    monthlyGain,
    explanation,
    calculatedAt: new Date().toISOString().slice(0, 19),
    acceptedAt: null,
    details: annualGain > 0 ? details.sort((a, b) => b.monthlyGain - a.monthlyGain) : [],
  }
}

/** AI 설명 — 규칙 엔진이 확정한 수치만 문장으로 옮긴다 */
function buildExplanation(details, annualGain) {
  if (annualGain <= 0) {
    return '현재 카드 배치가 보유하신 카드 조합 중 가장 유리합니다. 지금은 변경할 실익이 없습니다.'
  }
  const parts = []
  const blocked = details.filter(d => d.currentEligible === false && d.suggestedEligible === true)
  const ch = details.filter(d => d.detailType === 'CHANNEL_REASSIGN')
  const sb = details.filter(d => d.detailType === 'SUBSCRIPTION_MOVE')

  if (blocked.length) {
    const names = [...new Set(blocked.map(d => d.channelName))].join('·')
    const sum = blocked.reduce((s, d) => s + d.monthlyGain, 0)
    parts.push(`${names} 결제는 지금 카드에서 업종 할인이 적용되지 않습니다. 가맹점 정보가 페이사 대표 가맹점으로 넘어와 업종을 판정할 수 없기 때문입니다.`)
    parts.push(`${blocked[0].snapshotCardName}은 이 채널의 업종 정보를 그대로 인식하므로, 옮기기만 해도 월 ${sum.toLocaleString()}원의 할인이 새로 붙습니다.`)
  } else if (ch.length) {
    const top = ch[0]
    parts.push(`${top.channelName} 결제를 ${top.snapshotCardName}으로 옮기면 월 ${top.monthlyGain.toLocaleString()}원의 혜택이 추가됩니다.`)
  }
  if (sb.length) {
    parts.push(`${sb.map(d => d.subscriptionName).join('·')} 정기결제 카드도 함께 바꾸면 매달 고정으로 새던 혜택이 메워집니다.`)
  }
  parts.push(`모두 적용하면 연간 ${annualGain.toLocaleString()}원을 더 받게 됩니다.`)
  return parts.join(' ')
}

/* ============================================================
   실적 구간 근접 안내 (화면 5)
   ============================================================ */
export function tierGapAlerts(customerId, baseMonth = S.BASE_MONTH, threshold = 150000) {
  const myCards = S.customerCards.filter(c => c.customerId === customerId && c.isLinked)
  const lastDay = new Date(2026, 8, 0).getDate()
  return myCards.map(cc => {
    const d = diagnoseCard(cc.id, baseMonth)
    if (d.amountToNextTier == null || d.amountToNextTier === 0 || d.amountToNextTier > threshold) return null
    const nx = nextTier(d.cardId, d.currentTierLevel)
    const benNow = d.effectiveBenefit
    // 상위 구간 혜택 세트로 재계산
    const txs = S.transactions.filter(t => t.customerCardId === cc.id && monthOf(t.approvedAt) === baseMonth)
    const benNext = effectiveBenefit(txs, d.cardId, nx.id).effectiveBenefit
    return {
      customerCardId: cc.id, cardName: d.cardName,
      currentPerformance: d.recognizedPerformance,
      nextTierName: d.nextTierName,
      amountToNextTier: d.amountToNextTier,
      additionalMonthlyBenefit: Math.max(0, benNext - benNow),
      daysLeft: Math.max(0, lastDay - 20),
    }
  }).filter(Boolean)
}

/* ============================================================
   카드사 대시보드 (화면 6) — 집계 전용, 저장하지 않음
   ============================================================ */
export function issuerSummary(baseMonth = S.BASE_MONTH) {
  const allTx = S.transactions.filter(t => t.status === 'APPROVED' && monthOf(t.approvedAt) === baseMonth)
  const totalSpending = allTx.reduce((s, t) => s + t.amount, 0)
  const easyPay = allTx.filter(t => getChannel(t.channelId).channelType !== 'PHYSICAL')
                       .reduce((s, t) => s + t.amount, 0)

  // 실적 미달 고객 비율을 실제 계산 후 모집단 규모로 환산
  const custs = S.customers
  const under = custs.filter(c => {
    const ccs = S.customerCards.filter(x => x.customerId === c.id && x.isLinked)
    return ccs.every(cc => diagnoseCard(cc.id, baseMonth).currentTierLevel === 0)
  }).length
  const underRatio = under / custs.length
  const scale = S.ISSUER_SCALE

  return {
    baseMonth,
    totalCustomers: scale.totalCustomers,
    activeCustomers: scale.activeCustomers,
    underPerformingCustomers: Math.round(scale.activeCustomers * underRatio),
    underPerformingRatio: underRatio,
    subscriptionHoldingRatio: 0.318,
    totalSpending: totalSpending * Math.round(scale.activeCustomers / custs.length),
    easyPaySpendingRatio: totalSpending ? easyPay / totalSpending : 0,
  }
}

export function channelPositions(baseMonth = S.BASE_MONTH, months = 6) {
  const allTx = S.transactions.filter(t => t.status === 'APPROVED' && monthOf(t.approvedAt) === baseMonth)
  const total = allTx.reduce((s, t) => s + t.amount, 0)
  const scale = Math.round(S.ISSUER_SCALE.activeCustomers / S.customers.length)

  return {
    baseMonth,
    channels: S.payChannels.filter(c => c.isActive).map(ch => {
      const txs = allTx.filter(t => t.channelId === ch.id)
      const spending = txs.reduce((s, t) => s + t.amount, 0)
      const ccIds = [...new Set(txs.map(t => t.customerCardId))]
      const rates = ccIds.map(id => channelRate(getCustomerCard(id).cardId, ch.id).performanceRate)
      const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 1
      const linkedRatio = total ? spending / total : 0
      // 이 채널을 쓰는 고객 중 실적 미달
      const underCust = [...new Set(txs.map(t => getCustomerCard(t.customerCardId).customerId))]
        .filter(cid => S.customerCards.filter(x => x.customerId === cid && x.isLinked)
          .every(cc => diagnoseCard(cc.id, baseMonth).currentTierLevel === 0)).length

      // 추이 (시연용 — 간편결제 증가 / 실물 감소 경향)
      const trendBase = spending * scale
      const isEasy = ch.channelType !== 'PHYSICAL'
      const trend = Array.from({ length: months }, (_, i) => {
        const k = i - (months - 1)
        const f = isEasy ? 1 + k * 0.035 : 1 - k * 0.018
        const d = new Date(2026, 7 + k, 1)
        return {
          month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          spending: Math.round(trendBase * f),
          linkedRatio: linkedRatio * f,
        }
      })

      return {
        channelId: ch.id, channelName: ch.name, channelType: ch.channelType,
        linkedCustomerCount: Math.round(ccIds.length * scale),
        linkedRatio,
        spending: spending * scale,
        avgPerformanceRate: avgRate,
        underPerformingCustomerCount: Math.round(underCust * scale),
        trend,
      }
    }).sort((a, b) => b.spending - a.spending),
  }
}

/* ============================================================
   혜택 정책 시뮬레이션 (화면 7) — 저장하지 않고 응답만
   ============================================================ */
export function simulate(req) {
  const { cardId, baseMonth = S.BASE_MONTH, channelRates, totalMonthlyBenefitLimit, tierAdjustments } = req
  const scale = Math.round(S.ISSUER_SCALE.activeCustomers / S.customers.length)

  const measure = (opts) => {
    let achieved = 0, cost = 0, recognized = 0, affected = 0
    for (const cc of S.customerCards.filter(c => c.cardId === cardId && c.isLinked)) {
      const txs = S.transactions.filter(t =>
        t.customerCardId === cc.id && t.status === 'APPROVED' && monthOf(t.approvedAt) === baseMonth)
      if (!txs.length) continue
      affected++
      const rec = recognizedPerformance(txs, cardId, opts)
      const tier = judgeTier(cardId, rec, opts.tierOverrides)
      const ben = effectiveBenefit(txs, cardId, tier.id, opts)
      recognized += rec
      cost += ben.effectiveBenefit
      if (tier.tierLevel > 0) achieved++
    }
    return { achieved, cost, recognized, affected }
  }

  const before = measure({})
  const after = measure({
    channelRateOverrides: channelRates,
    totalMonthlyBenefitLimit,
    tierOverrides: tierAdjustments,
  })

  const pack = m => ({
    tierAchievedCustomers: m.achieved * scale,
    tierAchievedRatio: m.affected ? m.achieved / m.affected : 0,
    benefitCost: m.cost * scale * 12,
    recognizedPerformance: m.recognized * scale,
  })

  const b = pack(before), a = pack(after)
  return {
    cardId, baseMonth, before: b, after: a,
    deltaTierAchievedCustomers: a.tierAchievedCustomers - b.tierAchievedCustomers,
    deltaBenefitCost: a.benefitCost - b.benefitCost,
    deltaRecognizedPerformance: a.recognizedPerformance - b.recognizedPerformance,
    affectedCustomerCount: after.affected * scale,
  }
}

/* ============================================================
   세그먼트 추출 (화면 7) — 저장하지 않음
   ============================================================ */
export function extractSegment(req) {
  const { baseMonth = S.BASE_MONTH, channelId, tierLevel, hasSubscription, minSpending } = req
  const scale = Math.round(S.ISSUER_SCALE.activeCustomers / S.customers.length)

  const rows = []
  for (const c of S.customers) {
    const ccs = S.customerCards.filter(x => x.customerId === c.id && x.isLinked)
    if (!ccs.length) continue
    const txs = txOf(c.id, baseMonth)
    if (!txs.length) continue

    const spending = txs.reduce((s, t) => s + t.amount, 0)
    if (minSpending != null && spending < minSpending) continue
    if (channelId != null && !txs.some(t => t.channelId === channelId)) continue
    if (hasSubscription != null) {
      const has = S.subscriptions.some(s => s.customerId === c.id && s.status === 'ACTIVE')
      if (has !== hasSubscription) continue
    }

    const ds = ccs.map(cc => diagnoseCard(cc.id, baseMonth))
    const lv = Math.max(...ds.map(d => d.currentTierLevel))
    if (tierLevel != null && lv !== tierLevel) continue

    const rec = ds.reduce((s, d) => s + d.recognizedPerformance, 0)
    const gaps = ds.map(d => d.amountToNextTier).filter(v => v != null)
    const usage = channelUsage(c.id, baseMonth)

    rows.push({
      customerId: c.id,
      name: byId(S.users, c.userId).name,
      recognizedPerformance: rec,
      tierLevel: lv,
      gapToNextTier: gaps.length ? Math.min(...gaps) : 0,
      mainChannelName: usage.channels[0] ? usage.channels[0].channelName : '-',
      spending,
    })
  }

  return {
    customerCount: rows.length * scale,
    avgRecognizedPerformance: rows.length ? Math.round(rows.reduce((s, r) => s + r.recognizedPerformance, 0) / rows.length) : 0,
    avgGapToNextTier: rows.length ? Math.round(rows.reduce((s, r) => s + r.gapToNextTier, 0) / rows.length) : 0,
    customers: rows.sort((a, b) => b.recognizedPerformance - a.recognizedPerformance),
  }
}

/* ============================================================
   카테고리별 혜택 활용도 분석 (화면 5)
   ------------------------------------------------------------
   "커피·배달 같은 카테고리 혜택을 제대로 쓰고 있는가?"
     현재 적용 혜택  vs  보유 카드 최선  vs  자사 카탈로그 최선(참고)
   ※ 보유 카드 재배치가 1차 답이고, 카탈로그는 참고 정보로만 분리한다.
   ============================================================ */

/** 특정 카드·구간으로 해당 카테고리 거래를 전부 처리했을 때의 월 혜택 */
function categoryBenefitOn(catTxs, cardId, tierId) {
  const rule = S.benefitRules.find(r => r.cardId === cardId && r.tierId === tierId
                                     && r.categoryId === catTxs[0].categoryId && r.isActive)
  if (!rule) return { benefit: 0, rate: 0, rule: null, capped: false }
  let raw = 0
  for (const t of catTxs) {
    if (t.amount < rule.minTransactionAmount) continue
    const { isBenefitEligible } = channelRate(cardId, t.channelId)
    if (!isBenefitEligible) continue
    let amt = t.amount * rule.rate
    if (rule.perTransactionLimit != null) amt = Math.min(amt, rule.perTransactionLimit)
    raw += amt
  }
  const capped = rule.monthlyItemLimit != null && raw > rule.monthlyItemLimit
  const benefit = rule.monthlyItemLimit != null ? Math.min(raw, rule.monthlyItemLimit) : raw
  return { benefit: Math.round(benefit), raw: Math.round(raw), rate: rule.rate, rule, capped }
}

export function categoryUtilization(customerId, baseMonth = S.BASE_MONTH) {
  const myCards = S.customerCards.filter(c => c.customerId === customerId && c.isLinked)
  const txs = txOf(customerId, baseMonth)
  if (!myCards.length || !txs.length) return { baseMonth, categories: [], totalMissed: 0 }

  /* 보유 카드별 현재 실적 구간 */
  const ownedTier = {}
  for (const cc of myCards) {
    const d = diagnoseCard(cc.id, baseMonth)
    ownedTier[cc.id] = judgeTier(cc.cardId, d.recognizedPerformance)
  }

  /* 카테고리별 그룹 */
  const groups = {}
  for (const t of txs) (groups[t.categoryId] ||= []).push(t)

  const categories = []
  for (const [catId, catTxs] of Object.entries(groups)) {
    const category = getCategory(Number(catId))
    const amount = catTxs.reduce((s, t) => s + t.amount, 0)

    /* --- 현재: 각 거래가 실제로 물려 있는 카드 기준 --- */
    let current = 0
    const usedCards = new Set()
    for (const cc of myCards) {
      const mine = catTxs.filter(t => t.customerCardId === cc.id)
      if (!mine.length) continue
      usedCards.add(getCard(cc.cardId).name)
      current += categoryBenefitOn(mine, cc.cardId, ownedTier[cc.id].id).benefit
    }

    /* --- 보유 카드 중 최선 (전부 한 카드에 몰았을 때) --- */
    const ownedOptions = myCards.map(cc => {
      const r = categoryBenefitOn(catTxs, cc.cardId, ownedTier[cc.id].id)
      return { customerCardId: cc.id, cardId: cc.cardId, cardCode: getCard(cc.cardId).cardCode,
               cardName: getCard(cc.cardId).name, tierName: ownedTier[cc.id].tierName,
               rate: r.rate, benefit: r.benefit, capped: r.capped,
               monthlyItemLimit: r.rule ? r.rule.monthlyItemLimit : null,
               benefitType: r.rule ? r.rule.benefitType : null }
    })
    const bestOwned = ownedOptions.reduce((a, b) => (b.benefit > a.benefit ? b : a))

    /* --- 자사 카탈로그 중 미보유 카드 (참고) : 해당 카드 최상위 구간 기준 --- */
    const ownedCardIds = new Set(myCards.map(c => c.cardId))
    const catalogOptions = S.cards
      .filter(c => c.isActive && !ownedCardIds.has(c.id))
      .map(c => {
        const topTier = S.cardPerformanceTiers.filter(t => t.cardId === c.id)
          .sort((a, b) => b.tierLevel - a.tierLevel)[0]
        const r = categoryBenefitOn(catTxs, c.id, topTier.id)
        return { cardId: c.id, cardCode: c.cardCode, cardName: c.name, annualFee: c.annualFee,
                 tierName: topTier.tierName, rate: r.rate, benefit: r.benefit,
                 monthlyItemLimit: r.rule ? r.rule.monthlyItemLimit : null }
      })
      .filter(o => o.benefit > bestOwned.benefit)
      .sort((a, b) => b.benefit - a.benefit)

    categories.push({
      categoryId: Number(catId),
      categoryName: category.name,
      categoryCode: category.code,
      amount,
      transactionCount: catTxs.length,
      currentCardNames: [...usedCards],
      currentBenefit: current,
      currentRate: amount ? current / amount : 0,
      bestOwned,
      ownedOptions: ownedOptions.sort((a, b) => b.benefit - a.benefit),
      missedAmount: Math.max(0, bestOwned.benefit - current),
      utilization: bestOwned.benefit > 0 ? Math.min(1, current / bestOwned.benefit) : 1,
      catalogAlternative: catalogOptions[0] || null,
    })
  }

  categories.sort((a, b) => b.missedAmount - a.missedAmount || b.amount - a.amount)
  return {
    baseMonth,
    categories,
    totalMissed: categories.reduce((s, c) => s + c.missedAmount, 0),
    totalCurrent: categories.reduce((s, c) => s + c.currentBenefit, 0),
    totalBest: categories.reduce((s, c) => s + c.bestOwned.benefit, 0),
  }
}

/* ============================================================
   신규 카드 발급 추천 (화면 5)
   ------------------------------------------------------------
   "커피랑 주유를 이만큼 쓰시는데, 이 카드를 네이버페이에 물리면 더 낫습니다"

   범위 원칙: 후보는 **자사 카탈로그 상품**으로만 한정한다. 타사 카드는 다루지 않는다.
   판정 기준: 연회비를 차감한 **연간 순이익 순증**이 양수인 경우에만 추천한다.
   ============================================================ */

/**
 * 주어진 카드 집합으로 (채널 × 카테고리) 단위 배분 시의 월 혜택 최대값.
 *
 * 채널 단위가 아니라 항목 단위로 나누는 이유: 결제 순간에 어느 카드를 쓸지 고르므로
 * "카페는 A카드, 외식은 B카드"가 실제로 가능한 배치다.
 * 카드 단위 통합 월한도를 적용하며, 실적 구간은 배분 결과로 2회 재판정한다.
 */
function assignBuckets(txs, cardIds, baseMonth = S.BASE_MONTH) {
  const key = t => `${t.channelId}:${t.categoryId}`
  const buckets = {}
  for (const t of txs) (buckets[key(t)] ||= []).push(t)

  let tiers = {}
  for (const id of cardIds) tiers[id] = judgeTier(id, recognizedPerformance(txs, id))

  let assign = {}
  for (let pass = 0; pass < 2; pass++) {
    assign = {}
    for (const [k, bt] of Object.entries(buckets)) {
      let best = null
      for (const id of cardIds) {
        const b = effectiveBenefit(bt, id, tiers[id].id).effectiveBenefit + channelReward(bt)
        const rec = recognizedPerformance(bt, id)
        // 동점이면 실적 인정이 큰 쪽을 택한다
        if (!best || b > best.benefit || (b === best.benefit && rec > best.rec))
          best = { cardId: id, benefit: b, rec }
      }
      assign[k] = best
    }
    const next = {}
    for (const id of cardIds) {
      const mine = txs.filter(t => assign[key(t)].cardId === id)
      next[id] = judgeTier(id, recognizedPerformance(mine, id))
    }
    tiers = next
  }

  let total = 0
  const perCard = {}
  for (const id of cardIds) {
    const mine = txs.filter(t => assign[key(t)].cardId === id)
    if (!mine.length) continue
    const ben = effectiveBenefit(mine, id, tiers[id].id)
    const reward = channelReward(mine)
    perCard[id] = { benefit: ben.effectiveBenefit, reward, tier: tiers[id], txs: mine, breakdown: ben.breakdown }
    total += ben.effectiveBenefit + reward
  }
  return { assign, tiers, perCard, total: Math.round(total), key }
}

export function newCardCandidates(customerId, baseMonth = S.BASE_MONTH) {
  const owned = S.customerCards.filter(c => c.customerId === customerId && c.isLinked)
  const txs = txOf(customerId, baseMonth)
  if (!owned.length || !txs.length) return { baseMonth, baseAnnualNetBenefit: 0, candidates: [] }

  const ownedIds = [...new Set(owned.map(c => c.cardId))]
  const ownedFee = ownedIds.reduce((s, id) => s + getCard(id).annualFee, 0)

  /* 기준선 — 보유 카드만으로 최적 배치했을 때 */
  const base = assignBuckets(txs, ownedIds, baseMonth)
  const baseAnnual = base.total * 12 - ownedFee

  const candidates = []
  for (const card of S.cards.filter(c => c.isActive && !ownedIds.includes(c.id))) {
    const withNew = assignBuckets(txs, [...ownedIds, card.id], baseMonth)
    const annual = withNew.total * 12 - ownedFee - card.annualFee
    const annualGain = annual - baseAnnual
    if (annualGain <= 0) continue                    // 연회비를 못 넘기면 추천하지 않는다

    const mine = withNew.perCard[card.id]
    if (!mine) continue

    /* 이 카드로 결제할 항목 — 카테고리 단위 */
    const byCat = {}
    for (const t of mine.txs) {
      const c = (byCat[t.categoryId] ||= { categoryId: t.categoryId,
        categoryName: getCategory(t.categoryId).name, amount: 0, count: 0, channels: {} })
      c.amount += t.amount; c.count++
      c.channels[t.channelId] = (c.channels[t.channelId] || 0) + t.amount
    }
    const targets = Object.values(byCat).map(c => ({
      ...c,
      channelNames: Object.entries(c.channels)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => getChannel(Number(id)).name),
      channels: undefined,
    })).sort((a, b) => b.amount - a.amount)

    /* 이 카드를 주로 물릴 채널 */
    const chAmt = {}
    for (const t of mine.txs) chAmt[t.channelId] = (chAmt[t.channelId] || 0) + t.amount
    const assigned = Object.entries(chAmt).sort((a, b) => b[1] - a[1]).map(([id, amt]) => ({
      channelId: Number(id), channelName: getChannel(Number(id)).name, amount: amt,
    }))

    /* 근거 — 이 카드가 강한 항목 */
    const spendByCat = {}
    for (const t of mine.txs) spendByCat[t.categoryId] = (spendByCat[t.categoryId] || 0) + t.amount
    const reasons = mine.breakdown.filter(b => b.applied > 0).slice(0, 3).map(b => ({
      categoryId: b.categoryId, categoryName: b.categoryName,
      rate: b.rate, benefitType: b.benefitType,
      spending: spendByCat[b.categoryId] || 0, benefit: b.applied,
    }))

    candidates.push({
      cardId: card.id, cardCode: card.cardCode, cardName: card.name,
      brand: card.brand, description: card.description,
      annualFee: card.annualFee,
      totalMonthlyBenefitLimit: card.totalMonthlyBenefitLimit,
      tierName: mine.tier.tierName,
      monthlyBenefit: Math.round(mine.benefit + mine.reward),
      annualBenefit: Math.round((mine.benefit + mine.reward) * 12),
      annualGain,                                    // 연회비 차감 후 순증
      breakEvenMonths: Math.max(1, Math.ceil(card.annualFee / Math.max(1, mine.benefit + mine.reward))),
      assignedChannels: assigned,
      targetCategories: targets,
      reasons,
    })
  }

  candidates.sort((a, b) => b.annualGain - a.annualGain)
  return { baseMonth, baseAnnualNetBenefit: baseAnnual, candidates }
}
