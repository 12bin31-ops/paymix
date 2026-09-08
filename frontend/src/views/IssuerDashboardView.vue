<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import * as API from '../api/index.js'
import { store, won, eok, pct, pct0, ym } from '../store.js'
import PageHead from '../components/PageHead.vue'
import Meter from '../components/Meter.vue'
import RateBadge from '../components/RateBadge.vue'
import Verdict from '../components/Verdict.vue'
import Fold from '../components/Fold.vue'
import DonutChart from '../components/DonutChart.vue'

const router = useRouter()
const loading = ref(true)
const summary = ref(null)
const positions = ref(null)
const months = ref(6)

const maxSpend = computed(() => Math.max(...(positions.value?.channels.flatMap(c => c.trend.map(t => t.spending)) ?? [1])))
const palette = ['#1b4dff', '#22d3ee', '#7c3aed', '#c026d3', '#94a3b8']

/* 인정률 100% 미만 채널 = 정책이 이탈을 만들고 있는 지점 */
const weak = computed(() => (positions.value?.channels ?? []).filter(c => c.avgPerformanceRate < 1))
const weakUnder = computed(() => weak.value.reduce((s, c) => s + c.underPerformingCustomerCount, 0))
const weakSpend = computed(() => weak.value.reduce((s, c) => s + c.spending, 0))

async function load() {
  loading.value = true
  try {
    const [s, p] = await Promise.all([
      API.getIssuerDashboardSummary(),
      API.getChannelPositions({ months: months.value }),
    ])
    summary.value = s; positions.value = p
  } catch (e) { store.notify(e.message, 'danger') }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
<div class="container page-body fade-in">
  <PageHead :screen="6" title="채널 포지션 대시보드"
            desc="각 페이 채널에서 자사 카드가 얼마나 선택받고 있는지, 정책이 실적 미달을 만들고 있는지 확인합니다.">
    <template #actions>
      <select class="select sm" style="width:130px" v-model.number="months" @change="load">
        <option :value="3">최근 3개월</option><option :value="6">최근 6개월</option><option :value="12">최근 12개월</option>
      </select>
    </template>
  </PageHead>

  <div v-if="loading" class="muted3">집계 중…</div>

  <template v-else-if="summary">
    <!-- ===== 결론 ===== -->
    <Verdict class="mb16" :tone="weak.length ? 'danger' : 'ok'"
             :eyebrow="`${ym(summary.baseMonth)} · 활성 고객 ${won(summary.activeCustomers)}명`">
      <template #headline>
        <template v-if="weak.length">
          실적 미달 고객 <span class="c-danger tnum">{{ won(summary.underPerformingCustomers) }}명</span> 중<br>
          <span class="tnum">{{ won(weakUnder) }}명</span>이 인정률 낮은 채널에 몰려 있습니다
        </template>
        <template v-else>모든 채널에서 <span class="c-ok">자사 카드가 100% 인정</span>되고 있습니다</template>
      </template>
      <template #sub>
        <template v-if="weak.length">
          <b>{{ weak.map(c => c.channelName).join(' · ') }}</b>의 평균 인정률이 100% 미만입니다.
          이 채널들의 결제액은 <b>{{ eok(weakSpend) }}원</b>이며, 여기서 발생한 실적 미달이 해지·휴면으로 이어집니다.
          혜택은 이미 예산에 반영되어 있으나 고객에게 도달하지 못하고 있는 상태입니다.
        </template>
        <template v-else>인정률 정책이 이탈을 만들고 있는 지점이 없습니다.</template>
      </template>
      <template #side>
        <div class="v-kv"><span class="muted">실적 미달률</span><b class="tnum c-danger">{{ pct(summary.underPerformingRatio) }}</b></div>
        <div class="v-kv"><span class="muted">간편결제 비중</span><b class="tnum">{{ pct(summary.easyPaySpendingRatio) }}</b></div>
        <div class="v-kv"><span class="muted">정기결제 보유</span><b class="tnum">{{ pct(summary.subscriptionHoldingRatio) }}</b></div>
        <button class="btn pri block mt12" @click="router.push('/issuer/simulation')">인정률 올리면 어떻게 될까 →</button>
      </template>
    </Verdict>

    <div class="grid mb16" style="grid-template-columns:repeat(5,1fr)">
      <div class="stat"><div class="k">전체 고객</div><div class="v tnum">{{ won(summary.totalCustomers) }}</div></div>
      <div class="stat"><div class="k">활성 고객</div><div class="v tnum">{{ won(summary.activeCustomers) }}</div><div class="d">기준월 결제 이력 보유</div></div>
      <div class="stat bad"><div class="k">실적 미달 고객</div><div class="v tnum">{{ won(summary.underPerformingCustomers) }}</div>
        <div class="d">{{ pct(summary.underPerformingRatio) }} · 혜택이 도달하지 못한 규모</div></div>
      <div class="stat"><div class="k">정기결제 보유</div><div class="v tnum">{{ pct(summary.subscriptionHoldingRatio) }}</div><div class="d">이탈 장벽이 높은 결제</div></div>
      <div class="stat hi"><div class="k">간편결제 비중</div><div class="v tnum">{{ pct(summary.easyPaySpendingRatio) }}</div><div class="d">결제액 기준</div></div>
    </div>

    <!-- 채널 구성 도넛 -->
    <div class="card mb16 accent-top">
      <div class="card-h"><span class="t">채널별 결제액 구성</span>
        <span class="s">{{ ym(summary.baseMonth) }} 기준</span></div>
      <div class="dn-wrap">
        <DonutChart :size="196" :thickness="26" :items="positions.channels.map((c, i) => ({
            label: c.channelName, value: c.spending, color: palette[i % palette.length] }))">
          <div class="fs20 fw8 tnum">{{ eok(summary.totalSpending) }}</div>
          <div class="muted3 fs12">전체 결제액</div>
        </DonutChart>
        <div class="dn-list">
          <div v-for="(c, i) in positions.channels" :key="c.channelId" class="dn-row">
            <i :style="{ background: palette[i % palette.length] }"></i>
            <span class="fw6 fs15">{{ c.channelName }}</span>
            <span class="badge" :class="c.avgPerformanceRate >= 1 ? 'ok' : 'danger'">
              평균 인정 {{ pct0(c.avgPerformanceRate) }}
            </span>
            <span class="spacer"></span>
            <span class="tnum fw7 fs15">{{ eok(c.spending) }}</span>
            <span class="muted3 fs13 tnum" style="width:56px;text-align:right">{{ pct(c.linkedRatio) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 채널 포지션 -->
    <div class="card flush mb16">
      <div class="between" style="padding:16px 18px">
        <div class="h3">채널별 자사 카드 포지션</div>
        <div class="muted3 fs12">각 페이에서 자사 카드가 기본 결제수단인 비율</div>
      </div>
      <table class="tbl">
        <thead><tr>
          <th style="padding-left:18px">채널</th><th style="width:200px">연결 비중</th>
          <th class="n">연결 고객</th><th class="n">결제액</th>
          <th class="c">평균 인정률</th><th class="n">실적 미달 고객</th><th class="c" style="width:110px">조치</th>
        </tr></thead>
        <tbody>
          <tr v-for="c in positions.channels" :key="c.channelId">
            <td style="padding-left:18px">
              <div class="fw7">{{ c.channelName }}</div>
              <div class="muted3 fs11">{{ c.channelType }}</div>
            </td>
            <td><div class="bar-row"><Meter :value="c.linkedRatio" /><span class="muted3 fs11 tnum" style="width:42px">{{ pct(c.linkedRatio) }}</span></div></td>
            <td class="n tnum">{{ won(c.linkedCustomerCount) }}</td>
            <td class="n tnum">{{ eok(c.spending) }}</td>
            <td class="c"><RateBadge :rate="c.avgPerformanceRate" /></td>
            <td class="n tnum" :class="c.underPerformingCustomerCount ? 'c-danger' : 'muted3'">{{ won(c.underPerformingCustomerCount) }}</td>
            <td class="c">
              <button v-if="c.avgPerformanceRate < 1" class="btn sm" @click="router.push('/issuer/simulation')">시뮬레이션</button>
              <span v-else class="muted3 fs12">—</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div style="padding:0 18px 16px">
        <div class="note danger">
          인정률이 낮은 채널에 <b>실적 미달 고객이 집중</b>되어 있습니다. 정책이 이탈을 만들고 있는 지점입니다.
          정책 시뮬레이션에서 인정률 상향 시의 비용과 효과를 사전 계산할 수 있습니다.
        </div>
      </div>
    </div>

    <!-- 추이 -->
    <Fold title="채널별 결제액 추이" :summary="`최근 ${months}개월 · 간편결제 증가, 실물카드 감소`">
      <div class="chart">
        <div v-for="(m, i) in positions.channels[0].trend" :key="m.month" class="grp">
          <div class="bars">
            <div v-for="(c, ci) in positions.channels" :key="c.channelId" class="b"
                 :style="{ height: (c.trend[i].spending / maxSpend * 100) + '%', background: palette[ci % palette.length] }"
                 :title="`${c.channelName} ${m.month}: ${eok(c.trend[i].spending)}`"></div>
          </div>
          <div class="xl">{{ m.month.slice(2) }}</div>
        </div>
      </div>
      <div class="legend">
        <span v-for="(c, ci) in positions.channels" :key="c.channelId" class="lg">
          <i :style="{ background: palette[ci % palette.length] }"></i>{{ c.channelName }}
        </span>
      </div>
      <div class="note mt12">
        간편결제 채널 결제액은 증가하고 실물카드는 감소하는 <b>구조적 이동</b>이 확인됩니다.
      </div>
    </Fold>
  </template>
</div>
</template>

<style scoped>
.v-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 14px; padding: 5px 0; }
.dn-wrap { display: flex; align-items: center; gap: 30px; }
.dn-list { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dn-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.dn-row:last-child { border-bottom: none; }
.dn-row i { width: 11px; height: 11px; border-radius: 3px; flex: 0 0 11px; }
@media (max-width: 860px) { .dn-wrap { flex-direction: column; } }
.chart { display: flex; gap: 14px; align-items: flex-end; height: 190px; padding: 0 4px; border-bottom: 1px solid var(--line); }
.grp { flex: 1; display: flex; flex-direction: column; height: 100%; }
.bars { flex: 1; display: flex; align-items: flex-end; gap: 3px; }
.b { flex: 1; border-radius: 3px 3px 0 0; min-height: 3px; transition: opacity .14s; }
.b:hover { opacity: .78; }
.xl { text-align: center; font-size: 12.5px; color: var(--text-3); padding-top: 6px; }
.legend { display: flex; gap: 16px; justify-content: flex-end; margin-top: 10px; font-size: 13.5px; color: var(--text-3); }
.lg { display: inline-flex; align-items: center; gap: 5px; }
.lg i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
</style>
