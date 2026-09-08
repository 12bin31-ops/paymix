<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import * as API from '../api/index.js'
import { store, won, eok, pct, pct0 } from '../store.js'
import PageHead from '../components/PageHead.vue'

const cards = ref([])
const channels = ref([])
const tiers = ref([])
const result = ref(null)
const segment = ref(null)
const busy = ref(false)
const segBusy = ref(false)
const errors = ref([])          // 400 검증 오류 목록

const form = reactive({ cardId: 1, baseMonth: '2026-08', totalMonthlyBenefitLimit: null, rates: [], tierAdj: [] })
const seg = reactive({ channelId: '', tierLevel: '', hasSubscription: '', minSpending: '' })

const fieldErr = f => errors.value.find(e => e.field === f)

async function loadCard() {
  const d = await API.getCardDetail(form.cardId)
  form.totalMonthlyBenefitLimit = d.totalMonthlyBenefitLimit
  form.rates = d.channelRates.map(r => ({
    channelId: r.channelId, channelName: r.channelName,
    current: r.performanceRate, performanceRate: r.performanceRate * 100,
  }))
  form.tierAdj = d.tiers.map(t => ({ tierLevel: t.tierLevel, tierName: t.tierName, current: t.minPerformance, minPerformance: t.minPerformance }))
  tiers.value = d.tiers
  result.value = null; errors.value = []
}

onMounted(async () => {
  const [cl, ch] = await Promise.all([API.getIssuerCards(), API.getPayChannels()])
  cards.value = cl.content; channels.value = ch
  await loadCard()
})

async function run() {
  busy.value = true; errors.value = []
  try {
    result.value = await API.runSimulation({
      cardId: Number(form.cardId),
      baseMonth: form.baseMonth,
      channelRates: form.rates.map(r => ({ channelId: r.channelId, performanceRate: Number(r.performanceRate) / 100 })),
      totalMonthlyBenefitLimit: form.totalMonthlyBenefitLimit == null ? null : Number(form.totalMonthlyBenefitLimit),
      tierAdjustments: form.tierAdj.map(t => ({ tierLevel: t.tierLevel, minPerformance: Number(t.minPerformance) })),
    })
  } catch (e) {
    if (e.status === 400) {
      errors.value = e.body.errors || [{ field: e.field, message: e.message }]
      result.value = null
    } else store.notify(e.message, 'danger')
  } finally { busy.value = false }
}

async function extract() {
  segBusy.value = true
  try {
    segment.value = await API.extractSegment({
      cardId: Number(form.cardId), baseMonth: form.baseMonth,
      channelId: seg.channelId === '' ? null : Number(seg.channelId),
      tierLevel: seg.tierLevel === '' ? null : Number(seg.tierLevel),
      hasSubscription: seg.hasSubscription === '' ? null : seg.hasSubscription === 'true',
      minSpending: seg.minSpending === '' ? null : Number(seg.minSpending),
    })
  } catch (e) { store.notify(e.message, 'danger') }
  finally { segBusy.value = false }
}

/* 예외 시나리오 시연용 */
function breakIt() {
  if (form.rates[0]) form.rates[0].performanceRate = 150
  if (form.tierAdj.length >= 3) {
    form.tierAdj[1].minPerformance = 500000
    form.tierAdj[2].minPerformance = 300000
  }
  run()
}
</script>

<template>
<div class="container page-body fade-in">
  <PageHead :screen="7" title="혜택 정책 시뮬레이션"
            desc="인정률·한도·실적 구간을 바꿨을 때의 비용과 효과를 실거래 데이터로 사전 계산합니다. 실제 정책은 변경되지 않습니다.">
    <template #actions>
      <button class="btn ghost" @click="breakIt" title="파라미터 범위 초과 예외 시연">예외 시연</button>
    </template>
  </PageHead>

  <div class="row gap10" style="align-items:flex-start">
    <!-- 조건 -->
    <div class="col card" style="flex:.85">
      <div class="card-h"><span class="t">시뮬레이션 조건</span></div>
      <div class="stack">
        <div class="field">
          <label>대상 카드</label>
          <select class="select" v-model.number="form.cardId" @change="loadCard">
            <option v-for="c in cards" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>기준월</label>
          <select class="select" v-model="form.baseMonth"><option value="2026-08">2026-08</option></select>
        </div>

        <div>
          <label class="fs12 muted fw6">채널 인정률 변경</label>
          <table class="tbl mt8">
            <thead><tr><th>채널</th><th class="c">현재</th><th class="c" style="width:96px">변경</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in form.rates" :key="r.channelId">
                <td class="fs12">{{ r.channelName }}</td>
                <td class="c muted3 fs12">{{ pct0(r.current) }}</td>
                <td class="c">
                  <div class="center gap6" style="justify-content:center">
                    <input class="input sm tnum" style="width:56px;text-align:right"
                           :class="{ err: fieldErr(`channelRates[${i}].performanceRate`) }"
                           v-model.number="r.performanceRate" inputmode="numeric" />
                    <span class="muted3 fs12">%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="field">
          <label>통합 월한도 <span class="muted3">원</span></label>
          <input class="input tnum" :class="{ err: fieldErr('totalMonthlyBenefitLimit') }" v-model.number="form.totalMonthlyBenefitLimit" />
        </div>

        <div>
          <label class="fs12 muted fw6">실적 구간 하한</label>
          <div class="stack mt8" style="gap:6px">
            <div v-for="(t, i) in form.tierAdj" :key="t.tierLevel" class="center gap8">
              <span class="badge" style="width:44px;justify-content:center">Lv.{{ t.tierLevel }}</span>
              <input class="input sm tnum" style="flex:1;text-align:right"
                     :class="{ err: fieldErr(`tierAdjustments[${i}].minPerformance`) }"
                     v-model.number="t.minPerformance" />
              <span class="muted3 fs11" style="width:64px">현재 {{ won(t.current) }}</span>
            </div>
          </div>
        </div>

        <button class="btn pri block" :disabled="busy" @click="run">{{ busy ? '계산 중…' : '시뮬레이션 실행' }}</button>

        <!-- 400 검증 오류 -->
        <div v-if="errors.length" class="note danger">
          <div class="fw7 mb4">⚠ 입력값을 확인해 주세요</div>
          <div v-for="(e, i) in errors" :key="i" style="margin-top:5px">• {{ e.message }}</div>
        </div>
      </div>
    </div>

    <!-- 결과 -->
    <div class="col stack" style="flex:1.55">
      <div class="card">
        <div class="card-h"><span class="t">시뮬레이션 결과</span>
          <span class="s">기준월 실거래에 변경안을 적용해 재계산 · 결과는 저장하지 않습니다</span></div>

        <div v-if="!result" class="muted3 fs13" style="padding:26px 0;text-align:center">
          조건을 설정하고 시뮬레이션을 실행하세요.
        </div>
        <template v-else>
          <table class="tbl">
            <thead><tr><th>지표</th><th class="n">변경 전</th><th class="n">변경 후</th><th class="n">차이</th></tr></thead>
            <tbody>
              <tr><td>실적 충족 고객 수</td>
                <td class="n tnum">{{ won(result.before.tierAchievedCustomers) }}</td>
                <td class="n tnum">{{ won(result.after.tierAchievedCustomers) }}</td>
                <td class="n tnum fw7" :class="result.deltaTierAchievedCustomers>=0?'c-ok':'c-danger'">
                  {{ result.deltaTierAchievedCustomers>=0?'+':'' }}{{ won(result.deltaTierAchievedCustomers) }}</td></tr>
              <tr><td>실적 충족률</td>
                <td class="n tnum">{{ pct(result.before.tierAchievedRatio) }}</td>
                <td class="n tnum">{{ pct(result.after.tierAchievedRatio) }}</td>
                <td class="n tnum fw7 c-ok">
                  +{{ ((result.after.tierAchievedRatio - result.before.tierAchievedRatio)*100).toFixed(1) }}%p</td></tr>
              <tr><td>인정실적 총액</td>
                <td class="n tnum">{{ eok(result.before.recognizedPerformance) }}</td>
                <td class="n tnum">{{ eok(result.after.recognizedPerformance) }}</td>
                <td class="n tnum fw7 c-ok">+{{ eok(result.deltaRecognizedPerformance) }}</td></tr>
              <tr style="background:rgba(220,38,38,.04)"><td class="fw7">혜택 지급 비용 <span class="muted3 fs11">연간</span></td>
                <td class="n tnum">{{ eok(result.before.benefitCost) }}</td>
                <td class="n tnum">{{ eok(result.after.benefitCost) }}</td>
                <td class="n tnum fw7 c-danger">+{{ eok(result.deltaBenefitCost) }}</td></tr>
              <tr><td>영향 받는 고객 수</td><td class="n tnum" colspan="2">{{ won(result.affectedCustomerCount) }}명</td><td class="n muted3">—</td></tr>
            </tbody>
          </table>
          <div class="note warn mt12">
            <b>해석</b> — 인정률을 올리면 혜택 비용이 <b>연 {{ eok(result.deltaBenefitCost) }}</b> 증가하지만,
            실적 미달 고객 <b>{{ won(result.deltaTierAchievedCustomers) }}명</b>이 충족 구간에 진입합니다.
            이 혜택은 <b>이미 상품 설계 시 예산에 반영된 것</b>이며, 현재는 고객에게 도달하지 못한 채 이탈만 유발하고 있습니다.
          </div>
        </template>
      </div>

      <!-- 세그먼트 -->
      <div class="card">
        <div class="card-h"><span class="t">세그먼트 추출</span><span class="s">조건에 해당하는 고객군 · 저장하지 않습니다</span></div>
        <div class="row gap8" style="align-items:flex-end">
          <div class="field col"><label>채널</label>
            <select class="select sm" v-model="seg.channelId">
              <option value="">전체</option>
              <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select></div>
          <div class="field col"><label>실적 구간</label>
            <select class="select sm" v-model="seg.tierLevel">
              <option value="">전체</option><option value="0">Lv.0 미달</option><option value="1">Lv.1</option><option value="2">Lv.2</option>
            </select></div>
          <div class="field col"><label>정기결제</label>
            <select class="select sm" v-model="seg.hasSubscription">
              <option value="">전체</option><option value="true">보유</option><option value="false">미보유</option>
            </select></div>
          <div class="field col"><label>최소 결제액</label>
            <input class="input sm tnum" v-model="seg.minSpending" placeholder="300000" /></div>
          <button class="btn pri" :disabled="segBusy" @click="extract">{{ segBusy ? '…' : '추출' }}</button>
        </div>

        <template v-if="segment">
          <div class="grid mt16" style="grid-template-columns:repeat(3,1fr)">
            <div class="stat"><div class="k">해당 고객</div><div class="v tnum">{{ won(segment.customerCount) }}</div></div>
            <div class="stat"><div class="k">평균 인정실적</div><div class="v tnum">{{ won(segment.avgRecognizedPerformance) }}</div></div>
            <div class="stat"><div class="k">구간까지 평균 부족액</div><div class="v tnum">{{ won(segment.avgGapToNextTier) }}</div></div>
          </div>
          <table class="tbl mt12">
            <thead><tr><th>고객</th><th class="n">인정실적</th><th class="c">구간</th><th class="n">부족액</th><th>주 사용 채널</th></tr></thead>
            <tbody>
              <tr v-for="c in segment.customers" :key="c.customerId">
                <td class="fw6">{{ c.name }}</td>
                <td class="n tnum">{{ won(c.recognizedPerformance) }}</td>
                <td class="c"><span class="badge" :class="c.tierLevel>0?'ok':'danger'">Lv.{{ c.tierLevel }}</span></td>
                <td class="n tnum">{{ won(c.gapToNextTier) }}</td>
                <td class="muted">{{ c.mainChannelName }}</td>
              </tr>
              <tr v-if="!segment.customers.length"><td colspan="5" class="c muted3" style="padding:22px">조건에 해당하는 고객이 없습니다.</td></tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </div>
</div>
</template>
