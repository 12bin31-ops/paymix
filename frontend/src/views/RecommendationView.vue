<script setup>
import { ref, onMounted, computed } from 'vue'
import * as API from '../api/index.js'
import { store, won, pct, pct0, dt } from '../store.js'
import PageHead from '../components/PageHead.vue'
import StateBlock from '../components/StateBlock.vue'
import CardArt from '../components/CardArt.vue'
import Fold from '../components/Fold.vue'
import CompareBar from '../components/CompareBar.vue'

const loading = ref(true)
const busy = ref(false)
const blocked = ref(null)
const reco = ref(null)
const alerts = ref([])
const none = ref(false)

const usage = ref(null)
const util = ref(null)
const suggest = ref(null)
const subs = ref([])
const myCards = ref([])

const isOptimal = computed(() => reco.value?.status === 'NO_CHANGE_NEEDED')
const cardOf = id => myCards.value.find(c => c.id === id)

/* ============================================================
   할 일 카드 — 표의 한 행을 "해야 할 일" 하나로 승격
   ============================================================ */
const todos = computed(() => (reco.value?.details ?? []).map((d, i) => {
  const isSub = d.detailType === 'SUBSCRIPTION_MOVE'
  const where = isSub ? d.subscriptionName : d.channelName
  const from = Math.round((d.currentRate ?? 0) * 100)
  const to = Math.round((d.snapshotChannelRate ?? 1) * 100)

  /* 사람 말 한 문장 — 손실 원인별로 다르게 */
  const blocked = d.currentEligible === false && d.suggestedEligible === true
  let line, tagFrom = null, tagTo = null
  if (blocked) {
    line = `지금 카드는 ${where} 결제에 <b>업종 할인을 적용하지 않습니다.</b> `
         + `${where}를 거치면 가맹점이 페이사 이름으로 넘어와 업종을 알 수 없기 때문이에요. `
         + `${d.snapshotCardName}은 이 정보를 그대로 받아서 <b>할인이 그대로 붙습니다.</b>`
    tagFrom = '할인 미적용'; tagTo = '할인 적용'
  } else if (from === 0) {
    line = `지금은 이 결제가 실적에 <b>하나도 잡히지 않습니다.</b> ${d.snapshotCardName}으로 바꾸면 <b>전액 인정</b>됩니다.`
    tagFrom = `실적 ${from}%`; tagTo = `실적 ${to}%`
  } else if (from < to) {
    line = `지금은 결제액의 <b>${from}%만</b> 실적에 잡힙니다. ${d.snapshotCardName}으로 바꾸면 <b>전액 인정</b>됩니다.`
    tagFrom = `실적 ${from}%`; tagTo = `실적 ${to}%`
  } else {
    line = `${d.snapshotCardName}의 이 항목 혜택이 더 큽니다. 옮기기만 하면 매달 차액을 더 받습니다.`
  }

  return {
    id: d.id, no: i + 1, isSub, where,
    amountLabel: isSub ? `${won(d.monthlyAmount)}원 / 월` : null,
    fromCard: cardOf(d.currentCustomerCardId),
    fromCardName: d.currentCardName,
    toCard: cardOf(d.suggestedCustomerCardId),
    toCardName: d.snapshotCardName,
    from, to, line, tagFrom, tagTo,
    monthlyGain: d.monthlyGain,
    yearlyGain: d.monthlyGain * 12,
    deepLink: isSub ? (subs.value.find(s => s.id === d.subscriptionId)?.deepLinkUrl || null) : null,
    steps: isSub
      ? `${where} 결제수단 관리 화면에서 ${d.snapshotCardName}으로 변경`
      : `${where} 앱 → 설정 → 결제수단 관리 → 기본 카드를 ${d.snapshotCardName}으로 변경`,
  }
}))

/* 안 바꿔도 되는 곳 */
const keeps = computed(() => {
  const changedCh = new Set((reco.value?.details ?? []).filter(d => !d.subscriptionId).map(d => d.channelId))
  const changedSb = new Set((reco.value?.details ?? []).filter(d => d.subscriptionId).map(d => d.subscriptionId))
  const a = (usage.value?.channels ?? []).filter(c => !changedCh.has(c.channelId))
    .map(c => ({ key: 'c' + c.channelId, where: c.channelName, cardName: c.mainCardName,
                 card: cardOf(c.mainCustomerCardId), rate: c.performanceRate,
                 sub: `${won(c.amount)}원 · 비중 ${pct(c.ratio)}` }))
  const b = subs.value.filter(s => !changedSb.has(s.id))
    .map(s => ({ key: 's' + s.id, where: s.merchantName, cardName: s.cardName,
                 card: cardOf(s.customerCardId), rate: s.channelPerformanceRate,
                 sub: `${won(s.monthlyAmount)}원/월 · ${s.categoryName}` }))
  return [...a, ...b]
})

async function loadContext() {
  await Promise.all([
    API.getMyCards().then(r => myCards.value = r),
    API.getMySubscriptions().then(r => subs.value = r),
    API.getChannelUsage().then(r => usage.value = r).catch(() => {}),
    API.getBenefitUtilization().then(r => util.value = r).catch(() => {}),
    API.getCardSuggestions().then(r => suggest.value = r).catch(() => {}),
  ])
}
async function load() {
  loading.value = true; blocked.value = null; none.value = false
  try { reco.value = await API.getLatestRecommendation() }
  catch (e) {
    if (e.status === 404) none.value = true
    else if (e.status === 422) blocked.value = e.body
    else store.notify(e.message, 'danger')
  }
  try { await loadContext() } catch {}
  try { alerts.value = await API.getTierGapAlerts() } catch {}
  loading.value = false
}
onMounted(load)

async function run() {
  busy.value = true; blocked.value = null
  try {
    reco.value = await API.createRecommendation({ baseMonth: store.baseMonth, includeSubscriptions: true })
    none.value = false
    store.notify(reco.value.status === 'NO_CHANGE_NEEDED' ? '지금이 최선이에요' : '개선 방법을 찾았어요')
    await loadContext()
    alerts.value = await API.getTierGapAlerts()
  } catch (e) {
    if (e.status === 422) blocked.value = e.body
    else store.notify(e.message, 'danger')
  } finally { busy.value = false }
}
async function accept() {
  try { reco.value = await API.acceptRecommendation(reco.value.id); store.notify('제안을 수락했어요') }
  catch (e) { store.notify(e.message, 'danger') }
}
function guide(t) {
  if (t.deepLink) { window.open(t.deepLink, '_blank'); return }
  store.notify(t.steps)
}
</script>

<template>
<div class="container page-body fade-in">
  <PageHead :screen="5" title="개선 제안" desc="어느 페이에 어느 카드를 물릴지 알려드립니다.">
    <template #actions>
      <button class="btn ghost" :disabled="busy" @click="run">{{ busy ? '계산 중…' : '다시 계산' }}</button>
    </template>
  </PageHead>

  <div v-if="loading" class="muted3">불러오는 중…</div>

  <StateBlock v-else-if="blocked" tone="warn" icon="◷" title="아직 제안할 수 없어요" :desc="blocked.message">
    <router-link to="/cards" class="btn">카드 더 연결하기</router-link>
  </StateBlock>

  <StateBlock v-else-if="none" icon="✦" title="아직 계산한 적이 없어요"
    desc="가지고 계신 카드로 어떻게 배치하는 게 가장 좋은지 계산해 드릴게요.">
    <button class="btn pri lg" :disabled="busy" @click="run">{{ busy ? '계산 중…' : '지금 계산하기' }}</button>
  </StateBlock>

  <template v-else-if="reco">
    <!-- ============ 결론 ============ -->
    <div v-if="!isOptimal" class="verdict mb16">
      <div class="v-main">
        <div class="v-eyebrow">{{ todos.length }}곳만 바꾸면</div>
        <div class="v-big">연 <span class="grad-text tnum">{{ won(reco.annualGain) }}원</span> 더 받아요</div>
        <p class="v-ai" v-if="reco.explanation">{{ reco.explanation }}</p>
      </div>
      <div class="v-side">
        <div class="muted fs13 mb8">연간 순이익</div>
        <CompareBar compact :rows="[
          { label: '지금', value: reco.currentAnnualNetBenefit, color: '#cbd2dd' },
          { label: '바꾸면', value: reco.optimizedAnnualNetBenefit, color: 'var(--grad)', strong: true },
        ]" />
        <button v-if="reco.status !== 'ACCEPTED'" class="btn pri block mt12" @click="accept">전부 바꾸기로 했어요</button>
        <div v-else class="done mt12">✓ {{ dt(reco.acceptedAt) }} 수락함</div>
      </div>
    </div>

    <!-- ============ 이미 최적 ============ -->
    <div v-else class="verdict ok mb16">
      <div class="v-main">
        <div class="v-eyebrow">확인해 봤어요</div>
        <div class="v-big">지금이 <span class="c-ok">가장 좋은 배치</span>예요</div>
        <p class="v-ai">가지고 계신 카드로는 지금보다 더 나은 조합이 없습니다. 바꾸실 게 없어요.</p>
      </div>
      <div class="v-side">
        <div class="v-row"><span class="muted">현재 연간 순이익</span><b class="tnum">{{ won(reco.currentAnnualNetBenefit) }}원</b></div>
        <div class="v-row"><span class="muted">최선으로 바꿔도</span><b class="tnum">{{ won(reco.optimizedAnnualNetBenefit) }}원</b></div>
        <div class="muted3 fs12 mt12">다음 달 결제 패턴이 바뀌면 다시 알려드릴게요.</div>
      </div>
    </div>

    <!-- ============ 할 일 카드 ============ -->
    <template v-if="todos.length">
      <div class="sec-t">
        <span class="h2">이렇게 바꾸세요</span>
        <span class="muted fs13">위에서부터 하나씩 하시면 됩니다</span>
      </div>

      <div class="todos mb16 stagger">
        <div v-for="t in todos" :key="t.id" class="todo">
          <div class="t-head">
            <span class="t-no">{{ t.no }}</span>
            <div class="t-where">
              <div class="fs20 fw8" style="letter-spacing:-.028em">{{ t.where }}</div>
              <div class="muted3 fs12">{{ t.isSub ? t.amountLabel : '페이 결제' }}</div>
            </div>
            <div class="t-gain">
              <div class="fs26 fw8 c-ok tnum">+{{ won(t.monthlyGain) }}<span class="fs15 fw7">원</span></div>
              <div class="muted3 fs12">매달 · 연 {{ won(t.yearlyGain) }}원</div>
            </div>
          </div>

          <div class="t-swap">
            <div class="sw">
              <div class="sw-lb">지금</div>
              <CardArt size="sm" :card-code="t.fromCard?.cardCode" :card-name="t.fromCardName"
                       :masked-number="t.fromCard?.maskedNumber" :brand="t.fromCard?.brand" dim />
              <div class="sw-nm muted">{{ t.fromCardName }}</div>
            </div>
            <div class="sw-arw">→</div>
            <div class="sw">
              <div class="sw-lb on">이걸로</div>
              <CardArt size="sm" :card-code="t.toCard?.cardCode" :card-name="t.toCardName"
                       :masked-number="t.toCard?.maskedNumber" :brand="t.toCard?.brand" />
              <div class="sw-nm fw7">{{ t.toCardName }}</div>
            </div>

            <div class="t-why">
              <p v-html="t.line"></p>
              <div class="t-rate" v-if="t.tagFrom">
                <span class="badge danger">{{ t.tagFrom }}</span>
                <span class="muted3">→</span>
                <span class="badge ok">{{ t.tagTo }}</span>
              </div>
              <button class="btn pri mt12" @click="guide(t)">
                {{ t.isSub ? `${t.where} 결제수단 바꾸러 가기` : `${t.where}에서 바꾸는 방법` }} →
              </button>
              <div class="muted3 fs12 mt8">{{ t.steps }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="stack">
      <!-- ============ 안 바꿔도 되는 곳 ============ -->
      <Fold v-if="keeps.length" title="안 바꿔도 되는 곳" :count="keeps.length"
            :summary="keeps.slice(0,3).map(k => k.where).join(' · ') + (keeps.length > 3 ? ' 외' : '')">
        <div class="keeps">
          <div v-for="k in keeps" :key="k.key" class="keep">
            <CardArt size="xs" :card-code="k.card?.cardCode" :card-name="k.cardName"
                     :masked-number="k.card?.maskedNumber" :brand="k.card?.brand" />
            <div style="flex:1;min-width:0">
              <div class="fw7 fs15">{{ k.where }}</div>
              <div class="muted3 fs12">{{ k.sub }}</div>
            </div>
            <div class="tr">
              <div class="fs14 fw6">{{ k.cardName }}</div>
              <span class="badge" :class="k.rate >= 1 ? 'ok' : 'warn'">실적 {{ pct0(k.rate) }}</span>
            </div>
          </div>
        </div>
      </Fold>

      <!-- ============ 카테고리별 혜택 ============ -->
      <Fold v-if="util && util.categories.length" title="어떤 소비에서 손해 보고 있나요?"
            :summary="util.totalMissed > 0 ? `매달 ${won(util.totalMissed)}원을 놓치고 있어요` : '모두 잘 쓰고 계세요'">
        <div v-for="c in util.categories.filter(x => x.amount > 0)" :key="c.categoryId" class="ut">
          <div class="ut-l">
            <div class="fw7 fs16">{{ c.categoryName }}</div>
            <div class="muted3 fs12">{{ won(c.amount) }}원 · {{ c.transactionCount }}건</div>
          </div>
          <div class="ut-m">
            <div class="meter"><i :style="{ width: (c.utilization*100)+'%',
              background: c.utilization >= .95 ? 'var(--ok)' : c.utilization >= .6 ? 'var(--warn)' : 'var(--danger)' }"></i></div>
            <div class="muted3 fs12 mt4">
              지금 {{ won(c.currentBenefit) }}원 · 최대 {{ won(c.bestOwned.benefit) }}원
              <span class="muted3">({{ c.bestOwned.cardName }} {{ pct0(c.bestOwned.rate) }})</span>
            </div>
          </div>
          <div class="ut-r tr">
            <span v-if="c.missedAmount" class="fw8 c-danger tnum fs17">−{{ won(c.missedAmount) }}</span>
            <span v-else class="badge ok">최적</span>
          </div>
          <div v-if="c.catalogAlternative" class="ut-alt">
            참고 · 자사 <b>{{ c.catalogAlternative.cardName }}</b>이라면 {{ pct0(c.catalogAlternative.rate) }}로
            {{ won(c.catalogAlternative.benefit) }}원 <span class="muted3">(연회비 {{ won(c.catalogAlternative.annualFee) }}원)</span>
          </div>
        </div>
      </Fold>

      <!-- ============ 새 카드가 도움이 될까 ============ -->
      <Fold v-if="suggest && suggest.candidates.length" title="지금 카드로는 여기까지예요"
            :summary="`${suggest.candidates[0].cardName}을 더하면 연 ${won(suggest.candidates[0].annualGain)}원`">
        <div class="note mb16">
          아래는 <b>같은 카드사(자사)의 다른 상품</b>입니다. 지금 쓰시는 소비 패턴에 대입해
          <b>연회비를 빼고도 남는 경우만</b> 보여드립니다. 타사 카드는 비교하지 않습니다.
        </div>

        <div class="sgs">
          <div v-for="c in suggest.candidates" :key="c.cardId" class="sg">
            <div class="sg-head">
              <CardArt size="sm" :card-code="c.cardCode" :card-name="c.cardName" :brand="c.brand" />
              <div class="sg-t">
                <div class="fs20 fw8" style="letter-spacing:-.028em">{{ c.cardName }}</div>
                <div class="muted3 fs13 mt4">{{ c.description }}</div>
                <div class="center gap8 mt8">
                  <span class="badge">연회비 {{ won(c.annualFee) }}원</span>
                  <span class="badge ok">{{ c.breakEvenMonths }}개월이면 연회비 회수</span>
                </div>
              </div>
              <div class="sg-g">
                <div class="fs26 fw8 c-ok tnum">+{{ won(c.annualGain) }}<span class="fs15 fw7">원</span></div>
                <div class="muted3 fs12">연간 · 연회비 뺀 금액</div>
                <div class="muted3 fs12 mt4">월 혜택 {{ won(c.monthlyBenefit) }}원</div>
              </div>
            </div>

            <div class="sg-body">
              <div class="muted fs14 mb8">이 카드로 결제하면 좋은 항목</div>
              <div v-for="t in c.targetCategories" :key="t.categoryId" class="sg-row">
                <span class="fw7 fs15" style="width:76px">{{ t.categoryName }}</span>
                <span class="tnum fs15">{{ won(t.amount) }}원</span>
                <span class="muted3 fs13">{{ t.channelNames.join(' · ') }}에서 {{ t.count }}건</span>
                <span class="spacer"></span>
                <span v-if="c.reasons.find(r => r.categoryId === t.categoryId)" class="pill grad">
                  {{ pct0(c.reasons.find(r => r.categoryId === t.categoryId).rate) }}
                  → {{ won(c.reasons.find(r => r.categoryId === t.categoryId).benefit) }}원
                </span>
              </div>
              <div class="note blue mt12">
                <b>{{ c.reasons.map(r => r.categoryName).join('·') }}</b>에 매달
                <b>{{ won(c.reasons.reduce((s, r) => s + r.spending, 0)) }}원</b>을 쓰시는데,
                지금 가지고 계신 카드들은 이 항목 혜택이 약합니다.
                <template v-if="c.assignedChannels.length">
                  이 카드를 <b>{{ c.assignedChannels[0].channelName }}</b>에 물리면 그대로 적용됩니다.
                </template>
              </div>
            </div>
          </div>
        </div>
      </Fold>

      <!-- ============ 실적 구간 근접 ============ -->
      <Fold v-if="alerts.length" title="조금만 더 쓰면 등급이 올라가요"
            :summary="alerts.map(a => `${a.cardName} ${won(a.amountToNextTier)}원`).join(' · ')">
        <div v-for="a in alerts" :key="a.customerCardId" class="gap">
          <div style="flex:1">
            <div class="fw7 fs16">{{ a.cardName }}</div>
            <div class="muted3 fs13 mt4">
              지금 {{ won(a.currentPerformance) }}원 · <b style="color:var(--text)">{{ a.nextTierName }}</b>까지 {{ won(a.amountToNextTier) }}원
            </div>
          </div>
          <div class="tr">
            <div class="fs17 fw8 c-ok tnum">+{{ won(a.additionalMonthlyBenefit) }}원</div>
            <div class="muted3 fs12">달성 시 매달 · {{ a.daysLeft }}일 남음</div>
          </div>
        </div>
      </Fold>

      <!-- ============ 계산 근거 ============ -->
      <Fold v-if="!isOptimal" title="어떻게 계산했나요?" summary="카드별 혜택 계산 내역">
        <table class="tbl">
          <thead><tr>
            <th>대상</th><th>지금 카드</th><th>바꿀 카드</th><th class="c">실적 인정</th>
            <th class="n">지금 혜택</th><th class="n">바꾼 뒤</th><th class="n">차이</th>
          </tr></thead>
          <tbody>
            <tr v-for="d in reco.details" :key="d.id">
              <td><b>{{ d.subscriptionName || d.channelName }}</b>
                <div class="muted3 fs12">{{ d.reason }}</div></td>
              <td class="muted">{{ d.currentCardName }}</td>
              <td class="fw7 c-blue">{{ d.snapshotCardName }}</td>
              <td class="c nowrap"><span class="muted3">{{ pct0(d.currentRate) }}</span>
                <span class="muted3"> → </span><b class="c-ok">{{ pct0(d.snapshotChannelRate) }}</b></td>
              <td class="n tnum muted">{{ won(d.currentMonthlyBenefit) }}</td>
              <td class="n tnum">{{ won(d.suggestedMonthlyBenefit) }}</td>
              <td class="n tnum fw7 c-ok">+{{ won(d.monthlyGain) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="6">매달 늘어나는 혜택</td>
            <td class="n tnum fw8 c-blue">+{{ won(reco.monthlyGain) }}</td></tr></tfoot>
        </table>
      </Fold>
    </div>
  </template>
</div>
</template>

<style scoped>
/* ---------- 결론 ---------- */
.verdict {
  display: flex; gap: 30px; align-items: center;
  padding: 26px 28px; border-radius: var(--r-lg);
  border: 1px solid rgba(37,99,235,.24);
  background: linear-gradient(120deg, rgba(6,182,212,.06), rgba(37,99,235,.06) 45%, rgba(124,58,237,.06)), #fff;
  box-shadow: var(--shadow);
}
.verdict.ok { border-color: rgba(4,120,87,.24);
  background: linear-gradient(120deg, rgba(4,120,87,.06), rgba(4,120,87,.02)), #fff; }
.v-main { flex: 1; min-width: 0; }
.v-eyebrow { font-size: 14px; font-weight: 600; color: var(--text-2); }
.v-big { font-size: 38px; font-weight: 800; letter-spacing: -0.045em; line-height: 1.15; margin-top: 2px; }
.v-ai { font-size: 15px; line-height: 1.7; color: var(--text-2); margin-top: 12px; max-width: 640px; }
.v-side { width: 292px; flex: 0 0 292px; min-width: 0; padding-left: 26px; border-left: 1px solid var(--line); }
.v-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 14px; padding: 5px 0; }
.v-row.hi { font-size: 16px; border-top: 1px solid var(--line); padding-top: 9px; margin-top: 3px; }
.v-row.hi b { color: var(--blue-2); font-size: 19px; }
.done { text-align: center; font-size: 14px; font-weight: 700; color: var(--ok); }

/* ---------- 섹션 타이틀 ---------- */
.sec-t { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }

/* ---------- 할 일 카드 ---------- */
.todos { display: flex; flex-direction: column; gap: 14px; }
.todo {
  position: relative;
  border: 1px solid var(--line); border-radius: var(--r-lg); background: #fff;
  box-shadow: var(--shadow); overflow: hidden;
  transition: transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s;
}
.todo::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--grad); }
.todo:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.t-head {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 22px; border-bottom: 1px solid var(--line); background: var(--surface-2);
}
.t-no {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%; flex: 0 0 30px;
  background: var(--grad); color: #fff; font-weight: 800; font-size: 15px;
}
.t-where { flex: 1; min-width: 0; }
.t-gain { text-align: right; }

.t-swap { display: flex; align-items: center; gap: 18px; padding: 20px 22px; }
.sw { text-align: center; flex: 0 0 auto; }
.sw-lb { font-size: 12px; font-weight: 700; color: var(--text-3); margin-bottom: 7px; }
.sw-lb.on { color: var(--blue-2); }
.sw-nm { font-size: 13px; margin-top: 8px; max-width: 132px; }
.sw-arw { font-size: 24px; color: var(--blue); font-weight: 300; }
.t-why { flex: 1; min-width: 0; padding-left: 14px; border-left: 1px solid var(--line); }
.t-why p { font-size: 16px; line-height: 1.62; color: var(--text-2); }
.t-why p :deep(b) { color: var(--text); font-weight: 700; }
.t-rate { display: flex; align-items: center; gap: 7px; margin-top: 10px; }

/* ---------- 접힘 내부 ---------- */
.keeps { display: flex; flex-direction: column; gap: 8px; }
.keep { display: flex; align-items: center; gap: 14px; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: 11px; background: var(--bg-1); }

.sgs { display: flex; flex-direction: column; gap: 14px; }
.sg { border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; background: #fff; box-shadow: var(--shadow-sm); }
.sg-head { display: flex; align-items: center; gap: 16px; padding: 16px 18px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
.sg-t { flex: 1; min-width: 0; }
.sg-g { text-align: right; flex: 0 0 auto; }
.sg-body { padding: 16px 18px; }
.sg-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.sg-row:last-of-type { border-bottom: none; }
@media (max-width: 860px) { .sg-head { flex-wrap: wrap; } .sg-g { text-align: left; } }

.ut { display: grid; grid-template-columns: minmax(120px,1fr) minmax(220px,2fr) 110px;
  gap: 16px; align-items: center; padding: 13px 0; border-bottom: 1px solid var(--line); }
.ut:last-child { border-bottom: none; }
.ut-alt { grid-column: 1 / -1; font-size: 13px; color: var(--text-2);
  padding: 8px 11px; border: 1px dashed var(--line-2); border-radius: 9px; background: var(--bg-1); }

.gap { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.gap:last-child { border-bottom: none; }

@media (max-width: 980px) {
  .verdict { flex-direction: column; align-items: stretch; }
  .v-side { width: auto; flex: none; padding-left: 0; padding-top: 18px; border-left: none; border-top: 1px solid var(--line); }
  .t-swap { flex-wrap: wrap; }
  .t-why { border-left: none; padding-left: 0; width: 100%; }
  .ut { grid-template-columns: 1fr; }
}
</style>
