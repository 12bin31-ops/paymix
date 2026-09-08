<script setup>
import { ref, onMounted, computed } from 'vue'
import * as API from '../api/index.js'
import { store, won, pct, pct0, ym } from '../store.js'
import PageHead from '../components/PageHead.vue'
import StateBlock from '../components/StateBlock.vue'
import Verdict from '../components/Verdict.vue'
import Meter from '../components/Meter.vue'
import Fold from '../components/Fold.vue'
import CardArt from '../components/CardArt.vue'
import DonutChart from '../components/DonutChart.vue'

const loading = ref(true)
const blocked = ref(null)
const usage = ref(null)
const subs = ref([])
const myCards = ref([])
const editing = ref(null)
const pick = ref('')

const cardOf = id => myCards.value.find(c => c.id === id)
const PAL = ['#1b4dff', '#22d3ee', '#7c3aed', '#c026d3', '#0ea5e9', '#94a3b8']
const donut = computed(() => (usage.value?.channels ?? []).map((c, i) => ({
  label: c.channelName, value: c.amount, color: PAL[i % PAL.length], eligible: c.isBenefitEligible })))
const lostTotal = computed(() => usage.value?.channels.reduce((s, c) => s + c.lostAmount, 0) ?? 0)
const lostBenefitTotal = computed(() => usage.value?.totalLostBenefit ?? 0)
const leaking   = computed(() => usage.value?.channels.filter(c => !c.isBenefitEligible || c.lostAmount > 0) ?? [])
const healthy   = computed(() => usage.value?.channels.filter(c => c.isBenefitEligible && c.lostAmount === 0) ?? [])
const subTotal  = computed(() => subs.value.reduce((s, x) => s + x.monthlyAmount, 0))
const subLost   = computed(() => subs.value.filter(s => !s.isPerformanceRecognized).reduce((s, x) => s + x.monthlyAmount, 0))
const subBad    = computed(() => subs.value.filter(s => !s.isPerformanceRecognized))
const subGood   = computed(() => subs.value.filter(s => s.isPerformanceRecognized))

async function load() {
  loading.value = true; blocked.value = null
  try {
    const [u, s, c] = await Promise.all([API.getChannelUsage(), API.getMySubscriptions(), API.getMyCards()])
    usage.value = u; subs.value = s; myCards.value = c
  } catch (e) {
    if (e.status === 422) blocked.value = e.body
    else store.notify(e.message, 'danger')
  } finally { loading.value = false }
}
onMounted(load)

function startEdit(s) { editing.value = s.id; pick.value = String(s.customerCardId) }
async function saveCard(s) {
  try {
    await API.updateSubscriptionCard(s.id, { customerCardId: Number(pick.value) })
    store.notify(`${s.merchantName} 결제 카드를 바꿨어요`)
    editing.value = null
    await load()
  } catch (e) { store.notify(e.message, 'danger') }
}
</script>

<template>
<div class="container page-body fade-in">
  <PageHead :screen="4" title="페이·정기결제 현황" desc="어느 페이에서 실적이 새고 있는지 보여드립니다." />

  <div v-if="loading" class="muted3">불러오는 중…</div>

  <StateBlock v-else-if="blocked" tone="warn" icon="◷" title="아직 분석할 수 없어요" :desc="blocked.message">
    <router-link to="/cards" class="btn">카드 더 연결하기</router-link>
  </StateBlock>

  <template v-else-if="usage">
    <!-- ===== 결론 ===== -->
    <Verdict class="mb16" :tone="lostTotal > 0 ? 'danger' : 'ok'" :eyebrow="`${ym(usage.baseMonth)} 결제 기준`">
      <template #headline>
        <template v-if="lostBenefitTotal > 0">
          간편결제로 쓴 돈에<br><span class="c-danger">할인이 붙지 않고</span> 있어요
        </template>
        <template v-else-if="lostTotal > 0">
          매달 <span class="c-danger tnum">{{ won(lostTotal) }}원</span>이<br>실적에서 빠지고 있어요
        </template>
        <template v-else>모든 페이에서 <span class="c-ok">제대로 혜택을 받고</span> 있어요</template>
      </template>
      <template #sub>
        <template v-if="lostBenefitTotal > 0">
          네이버페이·카카오페이를 거치면 가맹점 정보가 <b>페이사 대표 가맹점</b>으로 넘어와 업종을 알 수 없습니다.
          그래서 지금 쓰시는 카드는 이 결제들을 <b>업종별 할인 대상에서 제외</b>합니다.
          실적에는 잡히는데 할인만 안 붙는 상태예요 —
          <b>결제처를 바꿀 필요 없이 카드만 바꾸면</b> 매달 {{ won(lostBenefitTotal) }}원을 되찾습니다.
        </template>
        <template v-else-if="lostTotal > 0">
          빠진 금액은 통신비·공과금·선불충전처럼 카드사 약관에서 원래 실적으로 쳐주지 않는 항목입니다.
        </template>
        <template v-else>지금 카드 배치가 모든 채널에서 제 몫을 하고 있습니다.</template>
      </template>
      <template #side>
        <div class="v-kv"><span class="muted">전체 결제</span><b class="tnum">{{ won(usage.totalSpending) }}원</b></div>
        <div class="v-kv"><span class="muted">실적 인정</span><b class="tnum c-ok">{{ won(usage.totalRecognized) }}원</b></div>
        <div class="v-kv" v-if="lostTotal"><span class="muted">약관상 실적 제외</span><b class="tnum">{{ won(lostTotal) }}원</b></div>
        <div class="v-kv" v-if="lostBenefitTotal"><span class="muted">못 받은 할인</span><b class="tnum c-danger">{{ won(lostBenefitTotal) }}원</b></div>
        <router-link to="/plan" class="btn pri block mt12">해결 방법 보기 →</router-link>
      </template>
    </Verdict>

    <!-- ===== 채널 구성 ===== -->
    <div class="card mb16 accent-top">
      <div class="card-h"><span class="t">어디서 얼마나 결제했나요</span>
        <span class="s">{{ ym(usage.baseMonth) }} · 총 {{ won(usage.totalSpending) }}원</span></div>
      <div class="dn-wrap">
        <DonutChart :size="188" :thickness="24" :items="donut">
          <div class="fs20 fw8 tnum">{{ won(usage.totalSpending) }}</div>
          <div class="muted3 fs12">총 결제액</div>
        </DonutChart>
        <div class="dn-list">
          <div v-for="(d, i) in donut" :key="d.label" class="dn-row">
            <i :style="{ background: d.color }"></i>
            <span class="fw6 fs15">{{ d.label }}</span>
            <span class="badge" :class="d.eligible ? 'ok' : 'danger'">
              {{ d.eligible ? '할인 적용' : '할인 미적용' }}
            </span>
            <span class="spacer"></span>
            <span class="tnum fw7 fs15">{{ won(d.value) }}원</span>
            <span class="muted3 fs13 tnum" style="width:52px;text-align:right">
              {{ pct(d.value / usage.totalSpending) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 실적이 새는 페이 ===== -->
    <template v-if="leaking.length">
      <div class="sec-t">
        <span class="h2">실적이 새는 곳</span>
        <span class="muted fs14">{{ leaking.length }}곳</span>
      </div>
      <div class="chs mb16">
        <div v-for="c in leaking" :key="c.channelId" class="ch bad">
          <div class="ch-l">
            <div class="fs20 fw8" style="letter-spacing:-.028em">{{ c.channelName }}</div>
            <div class="muted3 fs13 mt4">{{ c.transactionCount }}건 · 전체 결제의 {{ pct(c.ratio) }}</div>
            <Meter class="mt8" :value="c.ratio" thin />
          </div>
          <div class="ch-c">
            <CardArt size="xs" :card-code="cardOf(c.mainCustomerCardId)?.cardCode" :card-name="c.mainCardName"
                     :masked-number="cardOf(c.mainCustomerCardId)?.maskedNumber" :brand="cardOf(c.mainCustomerCardId)?.brand" />
            <div class="fs13 mt8 muted">{{ c.mainCardName }}</div>
          </div>
          <div class="ch-r">
            <div class="ch-nums">
              <div><span class="muted fs13">결제</span> <b class="tnum fs17">{{ won(c.amount) }}원</b></div>
              <div><span class="muted fs13">인정</span> <b class="tnum fs17">{{ won(c.recognizedAmount) }}원</b></div>
            </div>
            <div class="ch-msg">
              <template v-if="!c.isBenefitEligible">
                <span class="badge ok">실적 {{ pct0(c.performanceRate) }} 인정</span>
                <span class="badge danger" style="margin-left:5px">업종 할인 미적용</span>
                <div class="fs15 mt8">
                  실적에는 잡히지만 <b>{{ c.mainCardName }}은 {{ c.channelName }} 결제에 업종 할인을 적용하지 않습니다.</b>
                  <span v-if="c.lostBenefit" class="c-danger fw7">매달 {{ won(c.lostBenefit) }}원의 할인을 놓치는 중.</span>
                </div>
              </template>
              <template v-else>
                <span class="badge danger">실적 {{ pct0(c.performanceRate) }}만 인정</span>
                <div class="fs15 mt8">
                  이 카드는 <b>{{ c.channelName }} 결제의 {{ pct0(c.performanceRate) }}만</b> 실적으로 쳐줍니다.
                  <span class="c-danger fw7">매달 {{ won(c.lostAmount) }}원 손해.</span>
                </div>
              </template>
              <div v-if="c.lostAmount" class="muted3 fs13 mt8">
                이 중 {{ won(c.lostAmount) }}원은 약관상 실적 제외 항목(선불충전·구독료 등)입니다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== 실적에 안 잡히는 정기결제 ===== -->
    <template v-if="subBad.length">
      <div class="sec-t">
        <span class="h2">실적에 안 잡히는 정기결제</span>
        <span class="muted fs14">매달 {{ won(subLost) }}원</span>
      </div>
      <div class="subs mb16">
        <div v-for="s in subBad" :key="s.id" class="sb bad">
          <CardArt size="xs" :card-code="cardOf(s.customerCardId)?.cardCode" :card-name="s.cardName"
                   :masked-number="cardOf(s.customerCardId)?.maskedNumber" :brand="cardOf(s.customerCardId)?.brand" />
          <div class="sb-m">
            <div class="fs17 fw8">{{ s.merchantName }}</div>
            <div class="muted3 fs13 mt4">{{ s.categoryName }} · 매달 {{ s.billingDay }}일 · {{ s.cardName }}</div>
            <div class="fs14 mt8 muted">
              <template v-if="s.categoryPerformanceRate === 0">{{ s.categoryName }}는 원래 실적에 안 잡히는 항목이에요.</template>
              <template v-else>{{ s.channelName }} 결제라 이 카드에서는 실적으로 안 잡혀요.</template>
            </div>
          </div>
          <div class="sb-r">
            <div class="fs20 fw8 tnum">{{ won(s.monthlyAmount) }}<span class="fs14">원</span></div>
            <div class="muted3 fs12">매달</div>
            <template v-if="editing === s.id">
              <select class="select mt8" style="width:170px" v-model="pick">
                <option v-for="c in myCards" :key="c.id" :value="String(c.id)">{{ c.cardName }}</option>
              </select>
              <div class="center gap6 mt8" style="justify-content:flex-end">
                <button class="btn ghost" @click="editing=null">취소</button>
                <button class="btn pri" @click="saveCard(s)">저장</button>
              </div>
            </template>
            <div v-else class="center gap6 mt8" style="justify-content:flex-end">
              <a v-if="s.deepLinkUrl" class="btn ghost" :href="s.deepLinkUrl" target="_blank">변경하러 가기</a>
              <button class="btn" @click="startEdit(s)">카드 바꾸기</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== 접힘 ===== -->
    <div class="stack">
      <Fold v-if="healthy.length" title="잘 잡히고 있는 페이" :count="healthy.length"
            :summary="healthy.map(c => c.channelName).join(' · ')">
        <div v-for="c in healthy" :key="c.channelId" class="ok-row">
          <div style="flex:1">
            <div class="fw7 fs16">{{ c.channelName }}</div>
            <div class="muted3 fs13 mt4">{{ won(c.amount) }}원 · 비중 {{ pct(c.ratio) }} · {{ c.mainCardName }}</div>
          </div>
          <span class="badge ok">실적 {{ pct0(c.performanceRate) }} 인정</span>
        </div>
      </Fold>

      <Fold v-if="subGood.length" title="잘 잡히고 있는 정기결제" :count="subGood.length"
            :summary="subGood.map(s => s.merchantName).join(' · ')">
        <div v-for="s in subGood" :key="s.id" class="ok-row">
          <div style="flex:1">
            <div class="fw7 fs16">{{ s.merchantName }}</div>
            <div class="muted3 fs13 mt4">{{ won(s.monthlyAmount) }}원/월 · {{ s.categoryName }} · {{ s.cardName }}</div>
          </div>
          <span class="badge ok">실적 인정</span>
          <button class="btn ghost" @click="startEdit(s)">카드 바꾸기</button>
        </div>
      </Fold>

      <Fold title="전체 정기결제 합계" :summary="`매달 ${won(subTotal)}원`">
        <table class="tbl">
          <thead><tr><th>서비스</th><th>카테고리</th><th class="n">월 금액</th><th class="c">결제일</th>
                     <th>결제 카드</th><th class="c">실적</th></tr></thead>
          <tbody>
            <tr v-for="s in subs" :key="s.id">
              <td class="fw6">{{ s.merchantName }}</td>
              <td class="muted">{{ s.categoryName }}</td>
              <td class="n tnum">{{ won(s.monthlyAmount) }}원</td>
              <td class="c muted">{{ s.billingDay }}일</td>
              <td class="muted">{{ s.cardName }}</td>
              <td class="c"><span class="badge" :class="s.isPerformanceRecognized?'ok':'danger'">
                {{ s.isPerformanceRecognized ? '인정' : '미인정' }}</span></td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="2">합계</td><td class="n tnum">{{ won(subTotal) }}원</td>
            <td colspan="3" class="c-danger">이 중 {{ won(subLost) }}원이 실적에 미반영</td></tr></tfoot>
        </table>
      </Fold>
    </div>
  </template>
</div>
</template>

<style scoped>
.sec-t { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.v-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 14px; padding: 5px 0; }

.dn-wrap { display: flex; align-items: center; gap: 30px; }
.dn-list { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dn-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.dn-row:last-child { border-bottom: none; }
.dn-row i { width: 11px; height: 11px; border-radius: 3px; flex: 0 0 11px; }
@media (max-width: 860px) { .dn-wrap { flex-direction: column; } }

.chs { display: flex; flex-direction: column; gap: 12px; }
.ch {
  display: grid; grid-template-columns: minmax(180px,1fr) 118px minmax(300px,1.5fr);
  gap: 20px; align-items: center;
  padding: 18px 22px; border-radius: var(--r-lg); border: 1px solid var(--line);
  background: #fff; box-shadow: var(--shadow-sm);
}
.ch.bad { border-color: rgba(220,38,38,.22); background: linear-gradient(100deg, rgba(220,38,38,.035), #fff 55%); }
.ch-c { text-align: center; }
.ch-r { display: flex; gap: 20px; align-items: flex-start; }
.ch-nums { display: flex; flex-direction: column; gap: 6px; white-space: nowrap; }
.ch-msg { flex: 1; min-width: 0; padding-left: 18px; border-left: 1px solid var(--line); }

.subs { display: flex; flex-direction: column; gap: 10px; }
.sb {
  display: flex; align-items: center; gap: 18px;
  padding: 16px 20px; border-radius: var(--r-lg); border: 1px solid var(--line);
  background: #fff; box-shadow: var(--shadow-sm);
}
.sb.bad { border-color: rgba(220,38,38,.22); background: linear-gradient(100deg, rgba(220,38,38,.035), #fff 55%); }
.sb-m { flex: 1; min-width: 0; }
.sb-r { text-align: right; flex: 0 0 auto; }

.ok-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); }
.ok-row:last-child { border-bottom: none; }

@media (max-width: 1080px) {
  .ch { grid-template-columns: 1fr; }
  .ch-r { flex-direction: column; }
  .ch-msg { padding-left: 0; border-left: none; }
  .sb { flex-wrap: wrap; }
}
</style>
