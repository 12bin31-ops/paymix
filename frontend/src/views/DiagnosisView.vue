<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import * as API from '../api/index.js'
import { store, won, pct0, d10, ym } from '../store.js'
import PageHead from '../components/PageHead.vue'
import StateBlock from '../components/StateBlock.vue'
import Verdict from '../components/Verdict.vue'
import Meter from '../components/Meter.vue'
import Fold from '../components/Fold.vue'
import CardArt from '../components/CardArt.vue'
import StackBar from '../components/StackBar.vue'
import DonutChart from '../components/DonutChart.vue'

const loading = ref(true)
const blocked = ref(null)
const data = ref(null)
const sel = ref(null)
const exclusions = ref([])
const blocks = ref(null)
const baseMonth = ref('2026-08')

const card = computed(() => data.value?.cards.find(c => c.customerCardId === sel.value))
const lostRatio = computed(() => data.value ? 1 - data.value.totalRecognized / data.value.totalSpending : 0)
const keepRatio = computed(() => data.value ? data.value.totalRecognized / data.value.totalSpending : 0)
const tierProgress = computed(() => {
  const c = card.value
  if (!c || c.nextTierMin == null) return 1
  return c.recognizedPerformance / c.nextTierMin
})
const lostTotal = computed(() => exclusions.value.reduce((s, e) => s + e.lostAmount, 0))

/* 제외 사유를 사람 말로 묶기 */
const lostGroups = computed(() => {
  const g = {}
  for (const e of exclusions.value) {
    const k = e.exclusionReason
    ;(g[k] ||= { reason: k, items: [], lost: 0 })
    g[k].items.push(e); g[k].lost += e.lostAmount
  }
  const label = {
    CATEGORY_EXCLUDED:      { t: '약관상 실적 제외 항목',   d: '통신비·공과금·구독료·선불충전은 카드사 약관에서 전월실적 산정 대상이 아닙니다. 카드를 바꿔도 달라지지 않습니다.' },
    CHANNEL_NOT_RECOGNIZED: { t: '이 카드가 인정 안 하는 결제', d: '카드 상품에 따라 일부 결제 방식을 실적에서 제외합니다. 다른 카드로 옮기면 인정됩니다.' },
    PARTIALLY_RECOGNIZED:   { t: '일부만 인정되는 결제',     d: '결제액의 일부만 실적에 반영됩니다. 다른 카드로 옮기면 전액 인정됩니다.' },
  }
  return Object.values(g).map(x => ({ ...x, ...label[x.reason] })).sort((a, b) => b.lost - a.lost)
})

async function load() {
  loading.value = true; blocked.value = null
  try {
    data.value = await API.getPerformanceDiagnosis({ baseMonth: baseMonth.value })
    sel.value = data.value.cards[0]?.customerCardId ?? null
    await loadExclusions()
  } catch (e) {
    if (e.status === 422) blocked.value = e.body
    else store.notify(e.message, 'danger')
  } finally { loading.value = false }
}
async function loadExclusions() {
  if (!sel.value) return
  const [ex, bl] = await Promise.all([
    API.getPerformanceExclusions(sel.value, { baseMonth: baseMonth.value }),
    API.getBenefitBlocks(sel.value, { baseMonth: baseMonth.value }).catch(() => null),
  ])
  exclusions.value = ex; blocks.value = bl
}
watch(sel, loadExclusions)
onMounted(load)
</script>

<template>
<div class="container page-body fade-in">
  <PageHead :screen="3" title="실적·연회비 진단" desc="쓴 돈 중 실제로 실적에 잡힌 게 얼마인지 알려드립니다.">
    <template #actions>
      <select class="select" style="width:130px" v-model="baseMonth" @change="load">
        <option value="2026-08">2026년 8월</option>
        <option value="2026-07">2026년 7월</option>
      </select>
    </template>
  </PageHead>

  <div v-if="loading" class="muted3">계산 중…</div>

  <!-- ===== 진단 불가 ===== -->
  <StateBlock v-else-if="blocked" tone="warn" icon="◷" title="아직 진단할 수 없어요" :desc="blocked.message">
    <div class="row gap10" style="justify-content:center">
      <div class="gi"><div class="muted3 fs12">가입일</div><div class="fw7 fs15">{{ d10(blocked.joinedAt) }}</div></div>
      <div class="gi"><div class="muted3 fs12">필요 기간</div><div class="fw7 fs15">{{ blocked.requiredDays }}일</div></div>
      <div class="gi"><div class="muted3 fs12">지금까지</div><div class="fw7 fs15 c-warn">{{ blocked.elapsedDays }}일</div></div>
    </div>
    <div style="max-width:440px;margin:22px auto 0">
      <Meter :value="blocked.elapsedDays" :max="blocked.requiredDays" />
      <div class="muted fs14 mt8">{{ blocked.requiredDays - blocked.elapsedDays }}일 뒤에 알려드릴게요</div>
    </div>
    <div class="mt16"><router-link to="/cards" class="btn">카드 더 연결하기</router-link></div>
  </StateBlock>

  <template v-else-if="data">
    <!-- ===== 결론 ===== -->
    <Verdict class="mb16" :tone="lostRatio > .3 ? 'danger' : 'blue'"
             :eyebrow="`${ym(baseMonth)} · 보유 카드 ${data.cards.length}장`">
      <template #headline>
        쓴 돈의 <span class="tnum" :class="lostRatio > .3 ? 'c-danger' : 'c-blue'">{{ pct0(keepRatio) }}만</span> 실적에 잡혔어요
      </template>
      <template #sub>
        <b>{{ won(data.totalSpending) }}원</b>을 결제했지만 실적으로 인정된 건 <b>{{ won(data.totalRecognized) }}원</b>입니다.
        빠진 <b class="c-danger">{{ won(data.totalSpending - data.totalRecognized) }}원</b>은 통신비·공과금·구독료·선불충전처럼
        <b>카드사 약관에서 원래 제외하는 항목</b>이에요.
        <template v-if="card && card.benefitBlockedAmount > 0">
          그리고 이것과 별개로, <b>{{ card.benefitBlockedChannels.join('·') }}로 결제한
          {{ won(card.benefitBlockedAmount) }}원</b>은 실적에는 잡혔지만 <b class="c-danger">할인을 한 푼도 못 받았습니다.</b>
        </template>
      </template>
      <template #sub2>
        <StackBar class="mt16" :items="[
          { label: '실적 인정', value: data.totalRecognized, color: 'var(--blue)' },
          { label: '약관상 제외', value: data.totalSpending - data.totalRecognized, color: '#cbd2dd' },
        ]" />
      </template>
      <template #side>
        <div class="muted fs14">보유 카드 전체 연간 순이익</div>
        <div class="fs34 fw8 tnum mt4" :class="data.totalAnnualNetBenefit >= 0 ? 'c-ok' : 'c-danger'">
          {{ won(data.totalAnnualNetBenefit) }}<span class="fs17">원</span>
        </div>
        <div class="muted3 fs12 mt4">(받은 혜택 × 12) − 연회비</div>
        <router-link to="/plan" class="btn pri block mt12">어떻게 바꿀지 보기 →</router-link>
      </template>
    </Verdict>

    <!-- ===== 카드 선택 ===== -->
    <div class="sec-t"><span class="h2">카드별로 보기</span><span class="muted fs14">카드를 눌러 자세히 확인하세요</span></div>
    <div class="cardsel mb16">
      <button v-for="c in data.cards" :key="c.customerCardId"
              :class="['cs', { on: sel === c.customerCardId }]" @click="sel = c.customerCardId">
        <CardArt size="sm" :card-code="c.cardCode" :card-name="c.cardName" :card-alias="c.cardAlias"
                 :masked-number="c.maskedNumber" :brand="c.brand" :image-url="c.imageUrl" />
        <div class="cs-body">
          <div class="fw7 fs16">{{ c.cardName }}</div>
          <div class="mt4">
            <span class="badge" :class="c.currentTierLevel > 0 ? 'ok' : 'danger'">
              {{ c.currentTierLevel > 0 ? c.currentTierName : '실적 미달' }}
            </span>
          </div>
          <div class="between mt8">
            <span class="muted3 fs13">연간 순이익</span>
            <span class="fw8 tnum fs15" :class="c.annualNetBenefit>=0?'c-ok':'c-danger'">{{ won(c.annualNetBenefit) }}</span>
          </div>
        </div>
      </button>
    </div>

    <template v-if="card">
      <!-- ===== 등급 진행 ===== -->
      <div class="card mb16">
        <div class="between mb12">
          <div>
            <div class="muted fs14">{{ card.cardName }} · 지금 등급</div>
            <div class="fs26 fw8 mt4">{{ card.currentTierLevel > 0 ? card.currentTierName : '실적 미달' }}</div>
          </div>
          <div v-if="card.amountToNextTier != null" class="tr">
            <div class="muted fs14">다음 등급 <b style="color:var(--text)">{{ card.nextTierName }}</b> 까지</div>
            <div class="fs26 fw8 c-blue tnum mt4">{{ won(card.amountToNextTier) }}<span class="fs17">원</span></div>
          </div>
          <div v-else class="badge ok">최고 등급 달성</div>
        </div>
        <Meter :value="tierProgress" />
        <div class="between muted3 fs12 mt8">
          <span>인정 실적 {{ won(card.recognizedPerformance) }}원</span>
          <span v-if="card.nextTierMin">{{ won(card.nextTierMin) }}원</span>
        </div>
      </div>

      <!-- ===== 핵심 숫자 3개 ===== -->
      <div class="grid mb16" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><div class="k">이 카드로 쓴 돈</div>
          <div class="v tnum">{{ won(card.totalSpending) }}</div>
          <div class="d">{{ card.transactionCount }}건 결제</div></div>
        <div class="stat hi"><div class="k">실적으로 잡힌 돈</div>
          <div class="v tnum">{{ won(card.recognizedPerformance) }}</div>
          <div class="d">{{ pct0(card.recognizedPerformance / (card.totalSpending || 1)) }} 인정</div></div>
        <div class="stat good"><div class="k">이번 달 받은 혜택</div>
          <div class="v tnum">{{ won(card.effectiveBenefit + card.channelReward) }}</div>
          <div class="d">할인·적립 합계</div></div>
      </div>

      <div class="stack">
        <!-- 왜 빠졌나요 -->
        <Fold title="왜 실적에서 빠졌나요?" :open="lostTotal > 0"
              :summary="lostTotal ? `${won(lostTotal)}원이 실적에 안 잡혔어요` : '빠진 금액이 없어요'">
          <div v-if="!lostGroups.length" class="note ok">모든 결제가 실적에 100% 반영되고 있어요.</div>
          <div v-for="g in lostGroups" :key="g.reason" class="lg">
            <div class="lg-h">
              <div>
                <div class="fw7 fs16">{{ g.t }}</div>
                <div class="muted3 fs13 mt4">{{ g.d }}</div>
              </div>
              <div class="tr nowrap">
                <div class="fs20 fw8 c-danger tnum">−{{ won(g.lost) }}<span class="fs14">원</span></div>
                <div class="muted3 fs12">{{ g.items.length }}건</div>
              </div>
            </div>
            <div class="lg-items">
              <div v-for="e in g.items" :key="e.transactionId" class="li">
                <span class="fw6">{{ e.merchantName }}</span>
                <span class="muted3 fs13">{{ e.categoryName }} · {{ e.channelName }}</span>
                <span class="spacer"></span>
                <span class="tnum muted">{{ won(e.amount) }}원</span>
                <span class="tnum" :class="e.recognizedAmount ? 'c-warn' : 'c-danger'" style="width:96px;text-align:right">
                  {{ e.recognizedAmount ? won(e.recognizedAmount) + '원 인정' : '0원 인정' }}
                </span>
              </div>
            </div>
          </div>
        </Fold>

        <!-- 할인을 못 받은 결제 -->
        <Fold v-if="blocks && blocks.blockedCount" title="할인을 못 받은 결제" :open="true"
              :summary="`${blocks.blockedChannels.join('·')} ${won(blocks.blockedAmount)}원 · 못 받은 할인 ${won(blocks.lostBenefit)}원`">
          <div class="note danger mb12">
            <b>실적에는 잡혔지만 할인은 받지 못한 결제</b>입니다.
            {{ blocks.blockedChannels.join('·') }}를 거치면 가맹점 정보가 페이사 대표 가맹점으로 넘어와
            업종을 판정할 수 없습니다. 그래서 이 카드는 약관상 <b>간편결제 건을 영역별 할인 대상에서 제외</b>합니다.
            <b class="c-danger">결제처를 바꿀 필요 없이 카드만 바꾸면 되찾을 수 있습니다.</b>
          </div>
          <div class="lg-items">
            <div v-for="b in blocks.items" :key="b.transactionId" class="li">
              <span class="fw6">{{ b.merchantName }}</span>
              <span class="muted3 fs13">{{ b.categoryName }} · {{ b.channelName }}</span>
              <span class="spacer"></span>
              <span class="tnum muted">{{ won(b.amount) }}원</span>
              <span class="tnum c-danger fw6" style="width:150px;text-align:right">
                {{ pct0(b.rate) }} {{ b.benefitType === 'DISCOUNT' ? '할인' : '적립' }} 못 받음
                (−{{ won(b.wouldHaveEarned) }}원)
              </span>
            </div>
          </div>
          <div class="between mt12">
            <span class="muted fs15">이 카드에서 놓친 할인</span>
            <span class="fs20 fw8 c-danger tnum">{{ won(blocks.lostBenefit) }}원 / 월</span>
          </div>
          <router-link to="/plan" class="btn pri block mt12">되찾는 방법 보기 →</router-link>
        </Fold>

        <!-- 혜택 계산 -->
        <Fold title="혜택은 얼마나 받았나요?"
              :summary="`할인·적립 ${won(card.effectiveBenefit)}원` + (card.capLoss ? ` · 한도로 ${won(card.capLoss)}원 잘림` : '')">
          <div class="row gap10">
            <div class="col">
              <table class="tbl">
                <tbody>
                  <tr><td class="muted">원래 받을 수 있던 혜택</td><td class="n tnum">{{ won(card.nominalBenefit) }}원</td></tr>
                  <tr v-if="card.capLoss"><td class="c-danger">한도에 걸려 잘린 금액</td>
                      <td class="n tnum c-danger">−{{ won(card.capLoss) }}원</td></tr>
                  <tr><td class="fw7">실제 받은 할인·적립</td><td class="n tnum fw7">{{ won(card.effectiveBenefit) }}원</td></tr>
                  <tr><td class="muted">페이 자체 적립</td><td class="n tnum">{{ won(card.channelReward) }}원</td></tr>
                  <tr><td class="muted">연회비 <span class="muted3 fs12">1년에 한 번</span></td>
                      <td class="n tnum c-danger">−{{ won(card.annualFee) }}원</td></tr>
                </tbody>
                <tfoot><tr><td class="fw7">1년 기준 순이익</td>
                  <td class="n tnum fw8 fs17" :class="card.annualNetBenefit>=0?'c-ok':'c-danger'">{{ won(card.annualNetBenefit) }}원</td>
                </tr></tfoot>
              </table>
              <div v-if="card.totalCapped" class="note warn mt12">
                이 카드는 한 달에 최대 <b>{{ won(card.totalMonthlyBenefitLimit) }}원</b>까지만 혜택을 줍니다. 이미 다 채우셨어요.
              </div>
            </div>
            <div class="col" v-if="card.benefitBreakdown.length">
              <div class="muted fs14 mb8">어디서 받았나요</div>
              <div class="center gap20 mb12" style="align-items:center">
                <DonutChart :size="150" :thickness="19" :items="card.benefitBreakdown.map((b, i) => ({
                    label: b.categoryName, value: b.applied,
                    color: ['#1b4dff','#22d3ee','#7c3aed','#c026d3','#0ea5e9','#94a3b8'][i % 6] }))">
                  <div class="fs20 fw8 tnum">{{ won(card.effectiveBenefit) }}</div>
                  <div class="muted3 fs12">받은 할인</div>
                </DonutChart>
                <div class="legend" style="flex-direction:column;gap:7px">
                  <span v-for="(b, i) in card.benefitBreakdown" :key="b.categoryId">
                    <i :style="{ background: ['#1b4dff','#22d3ee','#7c3aed','#c026d3','#0ea5e9','#94a3b8'][i % 6] }"></i>
                    {{ b.categoryName }} <b class="tnum">{{ won(b.applied) }}원</b>
                  </span>
                </div>
              </div>
              <div v-for="b in card.benefitBreakdown" :key="b.categoryId" class="bd">
                <div class="between">
                  <span class="fw6 fs15">{{ b.categoryName }}
                    <span class="muted3 fs13">{{ b.benefitType==='DISCOUNT'?'할인':'적립' }} {{ pct0(b.rate) }}</span></span>
                  <span class="tnum fw7">{{ won(b.applied) }}원</span>
                </div>
                <div v-if="b.capped" class="muted3 fs12 mt4">
                  월 한도 {{ won(b.monthlyItemLimit) }}원에 걸렸어요 (원래 {{ won(b.raw) }}원)
                </div>
              </div>
            </div>
          </div>
        </Fold>

        <!-- 포인트 -->
        <Fold title="포인트" :summary="`${won(card.pointBalance)}P 보유` + (card.pointExpiring ? ` · ${won(card.pointExpiring)}P 곧 사라짐` : '')">
          <div class="between">
            <div>
              <div class="muted fs14">쓸 수 있는 포인트</div>
              <div class="fs34 fw8 tnum mt4">{{ won(card.pointBalance) }}<span class="fs17 muted"> P</span></div>
            </div>
            <div v-if="card.pointExpiring" class="note danger" style="max-width:340px">
              <b>{{ won(card.pointExpiring) }}P</b>가 <b>{{ d10(card.pointExpiringAt) }}</b>에 사라집니다.
              그 전에 사용하세요.
            </div>
          </div>
        </Fold>
      </div>
    </template>
  </template>
</div>
</template>

<style scoped>
.sec-t { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.gi { padding: 12px 20px; border: 1px solid var(--line); border-radius: 11px; background: #fff; box-shadow: var(--shadow-sm); }

.cardsel { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.cs {
  display: flex; gap: 14px; align-items: center; text-align: left;
  padding: 14px; border-radius: var(--r); border: 1px solid var(--line);
  background: var(--surface); transition: all .16s; box-shadow: var(--shadow-sm);
}
.cs-body { flex: 1; min-width: 0; }
.cs :deep(.art) { transition: transform .18s; }
.cs:hover :deep(.art) { transform: translateY(-2px); }
.cs.on { border-color: rgba(37,99,235,.45); background: linear-gradient(150deg, rgba(37,99,235,.06), #fff 65%); box-shadow: var(--shadow); }

.lg { padding: 14px 0; border-bottom: 1px solid var(--line); }
.lg:last-child { border-bottom: none; }
.lg-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.lg-items { margin-top: 10px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.li { display: flex; align-items: center; gap: 10px; padding: 9px 13px; font-size: 14px; border-bottom: 1px solid var(--line); background: var(--bg-1); }
.li:last-child { border-bottom: none; }

.bd { padding: 9px 0; border-bottom: 1px solid var(--line); }
.bd:last-child { border-bottom: none; }
</style>
