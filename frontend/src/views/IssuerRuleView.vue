<script setup>
import { ref, onMounted, computed, reactive } from 'vue'
import * as API from '../api/index.js'
import { store, won, pct0, d10, dt } from '../store.js'
import PageHead from '../components/PageHead.vue'

const cards = ref([])
const detail = ref(null)
const cats = ref([])
const selId = ref(null)
const busy = ref(false)
const err = reactive({ msg: '', field: '' })
const tierFilter = ref(null)
const effectiveFrom = ref('2026-10-01')
const newRule = reactive({ open: false, categoryId: '', tierId: '', benefitType: 'DISCOUNT', rate: 5,
                           perTransactionLimit: '', monthlyItemLimit: '', minTransactionAmount: 0 })

const cardForm = reactive({ name: '', annualFee: 0, totalMonthlyBenefitLimit: null })
const rules = computed(() => {
  if (!detail.value) return []
  return tierFilter.value == null ? detail.value.benefitRules
    : detail.value.benefitRules.filter(r => r.tierLevel === tierFilter.value)
})

async function loadList() {
  const r = await API.getIssuerCards()
  cards.value = r.content
  if (!selId.value) selId.value = cards.value[0]?.id
}
async function loadDetail() {
  detail.value = await API.getCardDetail(selId.value)
  Object.assign(cardForm, {
    name: detail.value.name, annualFee: detail.value.annualFee,
    totalMonthlyBenefitLimit: detail.value.totalMonthlyBenefitLimit,
  })
  tierFilter.value = detail.value.tiers[detail.value.tiers.length - 1]?.tierLevel ?? null
}
async function select(id) { selId.value = id; err.msg = ''; await loadDetail() }
onMounted(async () => { cats.value = await API.getSpendingCategories(); await loadList(); await loadDetail() })

async function saveCard() {
  busy.value = true; err.msg = ''
  try {
    await API.updateCard(selId.value, {
      cardCode: detail.value.cardCode, name: cardForm.name,
      annualFee: Number(cardForm.annualFee),
      totalMonthlyBenefitLimit: cardForm.totalMonthlyBenefitLimit == null || cardForm.totalMonthlyBenefitLimit === ''
        ? null : Number(cardForm.totalMonthlyBenefitLimit),
    })
    store.notify('카드 정보를 저장했습니다'); await loadList(); await loadDetail()
  } catch (e) { err.msg = e.message; err.field = e.field || '' }
  finally { busy.value = false }
}

async function saveRates() {
  busy.value = true; err.msg = ''
  try {
    await API.updateCardChannelRates(selId.value, detail.value.channelRates.map(r => ({
      channelId: r.channelId,
      performanceRate: Number(r.performanceRate),
      isBenefitEligible: r.isBenefitEligible,
      effectiveFrom: effectiveFrom.value,
    })))
    store.notify('채널 인정률을 저장했습니다 — 고객 진단에 즉시 반영됩니다')
    await loadDetail()
  } catch (e) { err.msg = e.message; err.field = e.field || '' }
  finally { busy.value = false }
}

async function saveTiers() {
  busy.value = true; err.msg = ''
  try {
    await API.updatePerformanceTiers(selId.value, detail.value.tiers.map(t => ({
      tierLevel: t.tierLevel, tierName: t.tierName,
      minPerformance: Number(t.minPerformance),
      maxPerformance: t.maxPerformance == null ? null : Number(t.maxPerformance),
    })))
    store.notify('실적 구간을 저장했습니다'); await loadDetail()
  } catch (e) { err.msg = e.message; err.field = e.field || '' }
  finally { busy.value = false }
}

async function addRule() {
  busy.value = true; err.msg = ''
  try {
    await API.createBenefitRule(selId.value, {
      categoryId: Number(newRule.categoryId), tierId: Number(newRule.tierId),
      benefitType: newRule.benefitType, rate: Number(newRule.rate) / 100,
      perTransactionLimit: newRule.perTransactionLimit === '' ? null : Number(newRule.perTransactionLimit),
      monthlyItemLimit: newRule.monthlyItemLimit === '' ? null : Number(newRule.monthlyItemLimit),
      minTransactionAmount: Number(newRule.minTransactionAmount) || 0,
    })
    store.notify('혜택 규칙을 등록했습니다'); newRule.open = false; await loadDetail()
  } catch (e) { err.msg = e.message; err.field = e.field || '' }
  finally { busy.value = false }
}

async function delRule(r) {
  if (!confirm(`${r.categoryName} 규칙을 삭제할까요?\n과거 제안은 스냅샷으로 근거를 보관하므로 영향받지 않습니다.`)) return
  try { await API.deleteBenefitRule(r.id); store.notify('규칙을 삭제했습니다'); await loadDetail() }
  catch (e) { store.notify(e.message, 'danger') }
}
</script>

<template>
<div class="container page-body fade-in">
  <PageHead :screen="8" title="카드·혜택 규칙 관리"
            desc="여기서 바꾼 채널 인정률이 고객의 인정실적과 개선 제안 결과를 그대로 바꿉니다." />

  <div v-if="err.msg" class="note danger mb16">{{ err.msg }}</div>

  <div class="row gap10" style="align-items:flex-start">
    <!-- 카드 목록 -->
    <div class="col stack" style="flex:.62">
      <div class="card flush">
        <div class="between" style="padding:14px 16px"><div class="h3">카드 상품</div></div>
        <table class="tbl">
          <thead><tr><th style="padding-left:16px">상품명</th><th class="n">연회비</th><th class="c">상태</th></tr></thead>
          <tbody>
            <tr v-for="c in cards" :key="c.id" :class="{ sel: c.id === selId }" style="cursor:pointer" @click="select(c.id)">
              <td style="padding-left:16px">
                <div class="fw7" :class="{ muted3: !c.isActive }">{{ c.name }}</div>
                <div class="muted3 fs11 mono">{{ c.cardCode }}</div>
              </td>
              <td class="n tnum">{{ won(c.annualFee) }}</td>
              <td class="c"><span class="badge" :class="c.isActive ? 'ok' : ''">{{ c.isActive ? '판매중' : '중지' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card" v-if="detail">
        <div class="card-h"><span class="t">기본 정보</span><span class="s mono">{{ detail.cardCode }}</span></div>
        <div class="stack">
          <div class="field"><label>상품명</label><input class="input" v-model="cardForm.name" /></div>
          <div class="row gap8">
            <div class="field col"><label>연회비</label>
              <input class="input tnum" :class="{ err: err.field==='annualFee' }" v-model.number="cardForm.annualFee" /></div>
            <div class="field col"><label>통합 월한도</label>
              <input class="input tnum" :class="{ err: err.field==='totalMonthlyBenefitLimit' }"
                     v-model.number="cardForm.totalMonthlyBenefitLimit" placeholder="비우면 무제한" /></div>
          </div>
          <button class="btn pri" :disabled="busy" @click="saveCard">저장</button>
        </div>
      </div>
    </div>

    <!-- 규칙 -->
    <div class="col stack" style="flex:1.55" v-if="detail">
      <!-- 채널 인정률 -->
      <div class="card flush">
        <div class="between" style="padding:14px 16px">
          <div class="h3">채널별 인정률 <span class="badge blue" style="margin-left:6px">카드 × 채널 교차</span></div>
          <div class="muted3 fs12">적용일 기준으로 이력이 보존됩니다</div>
        </div>
        <table class="tbl">
          <thead><tr>
            <th style="padding-left:16px">채널</th><th class="c">유형</th><th class="c" style="width:110px">인정률</th>
            <th class="c">혜택 적용</th><th class="c">적용 시작일</th><th class="c">최종 수정</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in detail.channelRates" :key="r.channelId"
                :class="{ 'row-warn': r.performanceRate > 0 && r.performanceRate < 1, 'row-bad': r.performanceRate === 0 }">
              <td style="padding-left:16px" class="fw7">{{ r.channelName }}</td>
              <td class="c muted3 fs11">{{ r.channelType }}</td>
              <td class="c">
                <div class="center gap6" style="justify-content:center">
                  <input class="input sm tnum" style="width:60px;text-align:right"
                         :value="Math.round(r.performanceRate*100)"
                         @input="r.performanceRate = Number($event.target.value)/100" inputmode="numeric" />
                  <span class="muted3 fs12">%</span>
                </div>
              </td>
              <td class="c"><input type="checkbox" v-model="r.isBenefitEligible" /></td>
              <td class="c muted3 fs12">{{ d10(r.effectiveFrom) }}</td>
              <td class="c muted3 fs12">{{ dt(r.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="between" style="padding:12px 16px">
          <div class="center gap8">
            <span class="fs12 muted">적용 시작일</span>
            <input class="input sm" type="date" style="width:150px" v-model="effectiveFrom" />
          </div>
          <button class="btn pri" :disabled="busy" @click="saveRates">인정률 저장</button>
        </div>
      </div>

      <!-- 실적 구간 -->
      <div class="card flush">
        <div class="between" style="padding:14px 16px">
          <div class="h3">실적 구간</div>
          <div class="muted3 fs12">구간 경계가 역전되면 400</div>
        </div>
        <table class="tbl">
          <thead><tr><th class="c" style="padding-left:16px;width:60px">Lv.</th><th>구간명</th><th class="n" style="width:150px">하한</th><th class="n">상한</th></tr></thead>
          <tbody>
            <tr v-for="t in detail.tiers" :key="t.tierLevel">
              <td class="c" style="padding-left:16px"><span class="badge">{{ t.tierLevel }}</span></td>
              <td><input class="input sm" v-model="t.tierName" /></td>
              <td class="n"><input class="input sm tnum" style="text-align:right" v-model.number="t.minPerformance" /></td>
              <td class="n tnum muted3">{{ t.maxPerformance == null ? '상한 없음' : won(t.maxPerformance) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="tr" style="padding:12px 16px"><button class="btn" :disabled="busy" @click="saveTiers">구간 저장</button></div>
      </div>

      <!-- 혜택 규칙 -->
      <div class="card flush">
        <div class="between" style="padding:14px 16px">
          <div class="h3">혜택 규칙</div>
          <div class="center gap8">
            <select class="select sm" style="width:130px" v-model.number="tierFilter">
              <option :value="null">전체 구간</option>
              <option v-for="t in detail.tiers" :key="t.tierLevel" :value="t.tierLevel">Lv.{{ t.tierLevel }} {{ t.tierName }}</option>
            </select>
            <button class="btn sm pri" @click="newRule.open = !newRule.open">+ 규칙 추가</button>
          </div>
        </div>

        <div v-if="newRule.open" style="padding:0 16px 12px">
          <div class="card tight" style="background:var(--surface-2)">
            <div class="row gap8" style="align-items:flex-end;flex-wrap:wrap">
              <div class="field" style="min-width:110px"><label>카테고리</label>
                <select class="select sm" v-model="newRule.categoryId">
                  <option value="" disabled>선택</option>
                  <option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select></div>
              <div class="field" style="min-width:120px"><label>실적 구간</label>
                <select class="select sm" v-model="newRule.tierId">
                  <option value="" disabled>선택</option>
                  <option v-for="t in detail.tiers" :key="t.id" :value="t.id">Lv.{{ t.tierLevel }} {{ t.tierName }}</option>
                </select></div>
              <div class="field" style="min-width:90px"><label>유형</label>
                <select class="select sm" v-model="newRule.benefitType"><option value="DISCOUNT">할인</option><option value="POINT">적립</option></select></div>
              <div class="field" style="width:70px"><label>비율 %</label><input class="input sm tnum" style="text-align:right" v-model.number="newRule.rate" /></div>
              <div class="field" style="width:90px"><label>건당 한도</label><input class="input sm tnum" style="text-align:right" v-model="newRule.perTransactionLimit" placeholder="없음" /></div>
              <div class="field" style="width:96px"><label>항목 월한도</label><input class="input sm tnum" style="text-align:right" v-model="newRule.monthlyItemLimit" placeholder="없음" /></div>
              <div class="field" style="width:90px"><label>최소 결제</label><input class="input sm tnum" style="text-align:right" v-model.number="newRule.minTransactionAmount" /></div>
              <button class="btn sm pri" :disabled="busy" @click="addRule">등록</button>
              <button class="btn sm ghost" @click="newRule.open=false">취소</button>
            </div>
          </div>
        </div>

        <table class="tbl">
          <thead><tr>
            <th style="padding-left:16px">카테고리</th><th class="c">구간</th><th class="c">유형</th><th class="c">비율</th>
            <th class="n">건당 한도</th><th class="n">항목 월한도</th><th class="n">최소 결제</th><th class="c" style="width:70px"></th>
          </tr></thead>
          <tbody>
            <tr v-for="r in rules" :key="r.id">
              <td style="padding-left:16px" class="fw6">{{ r.categoryName }}</td>
              <td class="c"><span class="badge">Lv.{{ r.tierLevel }}</span></td>
              <td class="c muted">{{ r.benefitType === 'DISCOUNT' ? '할인' : '적립' }}</td>
              <td class="c fw7">{{ pct0(r.rate) }}</td>
              <td class="n tnum muted">{{ r.perTransactionLimit == null ? '무제한' : won(r.perTransactionLimit) }}</td>
              <td class="n tnum">{{ r.monthlyItemLimit == null ? '무제한' : won(r.monthlyItemLimit) }}</td>
              <td class="n tnum muted3">{{ won(r.minTransactionAmount) }}</td>
              <td class="c"><button class="btn sm danger" @click="delRule(r)">삭제</button></td>
            </tr>
            <tr v-if="!rules.length"><td colspan="8" class="c muted3" style="padding:22px">해당 구간에 설정된 혜택 규칙이 없습니다.</td></tr>
          </tbody>
        </table>
        <div style="padding:0 16px 16px">
          <div class="note">
            혜택 규칙은 <b>카드 × 카테고리 × 실적 구간</b> 단위로 관리됩니다.
            규칙을 변경해도 이미 고객에게 전달된 제안의 근거는 그대로 유지됩니다.
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.row-warn { background: rgba(180,83,9,.045); }
.row-bad  { background: rgba(220,38,38,.04); }
</style>
