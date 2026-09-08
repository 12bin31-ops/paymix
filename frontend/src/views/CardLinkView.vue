<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import * as API from '../api/index.js'
import { store, won, dt, d10 } from '../store.js'
import PageHead from '../components/PageHead.vue'
import CardArt from '../components/CardArt.vue'

const router = useRouter()
const myCards = ref([])
const catalog = ref([])
const loading = ref(true)
const syncing = ref(null)
const detail = ref(null)          // 클릭한 카드 (보유/카탈로그 공용)
const form = reactive({ open: false, cardId: '', maskedNumber: '', cardAlias: '', busy: false, err: '', field: '' })

const ownedCardIds = computed(() => new Set(myCards.value.filter(c => c.isLinked).map(c => c.cardId)))

async function load() {
  loading.value = true
  const [m, c] = await Promise.all([API.getMyCards(), API.getCardCatalog()])
  myCards.value = m; catalog.value = c
  if (detail.value) detail.value = m.find(x => x.id === detail.value.id) || detail.value
  loading.value = false
}
onMounted(load)

function openCard(c, owned) { detail.value = { ...c, owned } }
function closeCard() { detail.value = null }

function openForm(cardId = '') {
  Object.assign(form, { open: true, cardId, maskedNumber: '', cardAlias: '', err: '', field: '' })
  detail.value = null
}

async function submit() {
  form.busy = true; form.err = ''; form.field = ''
  try {
    const r = await API.linkCard({ cardId: Number(form.cardId), maskedNumber: form.maskedNumber, cardAlias: form.cardAlias || null })
    store.notify(`${r.cardName} 카드를 연결했습니다`)
    form.open = false
    await load()
  } catch (e) { form.err = e.message; form.field = e.field || '' }
  finally { form.busy = false }
}

async function sync(cc) {
  syncing.value = cc.id
  try {
    const r = await API.syncCardTransactions(cc.id)
    store.notify(`동기화 완료 — 거래 ${r.syncedTransactionCount}건 수집`)
    await load()
  } catch (e) { store.notify(e.message, 'danger') }
  finally { syncing.value = null }
}

async function unlink(cc) {
  if (!confirm(`${cc.cardName} 연결을 해제할까요?\n거래 이력과 과거 제안 근거는 보존됩니다.`)) return
  try { await API.unlinkCard(cc.id); store.notify('연결을 해제했습니다'); detail.value = null; await load() }
  catch (e) { store.notify(e.message, 'danger') }
}

</script>

<template>
<div class="container page-body fade-in">
  <PageHead :screen="2" title="카드 데이터 연결"
            desc="보유하신 자사 카드를 연결하면 결제 데이터를 분석해 실적과 혜택을 진단합니다.">
    <template #actions><button class="btn pri" @click="openForm()">+ 카드 연결</button></template>
  </PageHead>

  <!-- ===== 내 보유 카드 — 카드 아트 그리드 ===== -->
  <div class="card mb16">
    <div class="card-h">
      <span class="t">내 보유 카드</span>
      <span class="s">카드를 클릭하면 상세를 볼 수 있습니다 · 최종 동기화 {{ dt(myCards[0]?.lastSyncedAt) }}</span>
    </div>

    <div v-if="loading" class="muted3 fs13">불러오는 중…</div>

    <div v-else-if="myCards.length" class="wallet stagger">
      <button v-for="c in myCards" :key="c.id" class="slot" :class="{ on: detail?.id === c.id }"
              @click="openCard(c, true)">
        <CardArt size="md" :card-code="c.cardCode" :card-name="c.cardName" :card-alias="c.cardAlias"
                 :masked-number="c.maskedNumber" :brand="c.brand" :image-url="c.imageUrl" :dim="!c.isLinked" />
        <div class="slot-meta">
          <div class="between">
            <span class="fw7 fs13">{{ c.cardName }}</span>
            <span class="badge" :class="c.isLinked ? 'ok' : ''">{{ c.isLinked ? '연결됨' : '해제됨' }}</span>
          </div>
          <div class="muted3 fs11 mt4">연회비 {{ won(c.annualFee) }}원 · 포인트 {{ won(c.pointBalance) }}P</div>
        </div>
      </button>
    </div>

    <div v-else class="note">아직 연결된 카드가 없습니다. 아래 목록에서 보유하신 카드를 연결해 주세요.</div>
  </div>

  <!-- ===== 카드 상세 (클릭 시) ===== -->
  <transition name="slide">
    <div v-if="detail" class="card-accent mb16">
      <div class="detail">
        <CardArt size="lg" :card-code="detail.cardCode" :card-name="detail.cardName || detail.name"
                 :card-alias="detail.cardAlias" :masked-number="detail.maskedNumber"
                 :brand="detail.brand" :image-url="detail.imageUrl" :dim="detail.isActive === false" />

        <div class="dinfo">
          <div class="between">
            <div>
              <div class="h2">{{ detail.cardName || detail.name }}</div>
              <div class="muted3 fs12 mono mt4">{{ detail.cardCode }} · {{ detail.brand }}</div>
            </div>
            <button class="btn sm ghost" @click="closeCard">닫기</button>
          </div>

          <p class="muted fs13 mt12">{{ detail.description }}</p>

          <div class="specs mt16">
            <div class="sp"><div class="k">연회비</div><div class="v tnum">{{ won(detail.annualFee) }}원</div></div>
            <div class="sp"><div class="k">통합 월한도</div>
              <div class="v tnum">{{ detail.totalMonthlyBenefitLimit ? won(detail.totalMonthlyBenefitLimit) + '원' : '무제한' }}</div></div>
            <template v-if="detail.owned">
              <div class="sp"><div class="k">포인트 잔액</div><div class="v tnum">{{ won(detail.pointBalance) }} P</div></div>
              <div class="sp"><div class="k">연결일</div><div class="v">{{ d10(detail.linkedAt) }}</div></div>
              <div class="sp"><div class="k">최종 동기화</div><div class="v">{{ dt(detail.lastSyncedAt) }}</div></div>
              <div class="sp"><div class="k">카드번호</div><div class="v mono">{{ detail.maskedNumber }}</div></div>
            </template>
          </div>

          <div class="center gap8 mt16" style="flex-wrap:wrap">
            <template v-if="detail.owned">
              <button class="btn" :disabled="syncing===detail.id" @click="sync(detail)">
                {{ syncing===detail.id ? '동기화 중…' : '결제 데이터 동기화' }}
              </button>
              <button class="btn pri" @click="router.push('/diagnosis')">이 카드 진단 보기</button>
              <button class="btn danger" @click="unlink(detail)">연결 해제</button>
            </template>
            <template v-else>
              <button v-if="!ownedCardIds.has(detail.id)" class="btn pri" @click="openForm(detail.id)">이 카드 연결하기</button>
              <span v-else class="badge ok">이미 보유 중인 카드입니다</span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <!-- ===== 연결 폼 ===== -->
  <div v-if="form.open" class="card mb16">
    <div class="card-h"><span class="t">카드 연결</span>
      <span class="s"><button class="btn sm ghost" @click="form.open=false">닫기</button></span></div>
    <form class="row gap10" style="align-items:flex-end" @submit.prevent="submit">
      <div class="field col">
        <label>카드 상품</label>
        <select class="select" v-model="form.cardId" required>
          <option value="" disabled>선택하세요</option>
          <option v-for="c in catalog" :key="c.id" :value="c.id">{{ c.name }} · 연회비 {{ won(c.annualFee) }}원</option>
        </select>
      </div>
      <div class="field col">
        <label>카드번호 (마스킹)</label>
        <input class="input mono" :class="{ err: form.field==='maskedNumber' }" v-model="form.maskedNumber"
               placeholder="5555-****-****-1111" required />
      </div>
      <div class="field col">
        <label>별칭 <span class="muted3">선택</span></label>
        <input class="input" v-model="form.cardAlias" placeholder="여행용" />
      </div>
      <button class="btn pri" :disabled="form.busy">{{ form.busy ? '연결 중…' : '연결하기' }}</button>
    </form>
    <div v-if="form.err" class="note danger mt12">{{ form.err }}</div>
  </div>

  <!-- ===== 연결 가능한 카드 ===== -->
  <div class="card">
    <div class="card-h">
      <span class="t">연결 가능한 카드</span>
      <span class="s">자사 상품만 표시됩니다 · 타사 카드는 비교 대상이 아닙니다</span>
    </div>
    <div class="wallet">
      <button v-for="c in catalog" :key="c.id" class="slot" :class="{ on: detail?.id === c.id && !detail?.owned }"
              @click="openCard(c, false)">
        <CardArt size="md" :card-code="c.cardCode" :card-name="c.name" :brand="c.brand"
                 :image-url="c.imageUrl" :masked-number="'0000-****-****-0000'" :dim="ownedCardIds.has(c.id)" />
        <div class="slot-meta">
          <div class="between">
            <span class="fw7 fs13">{{ c.name }}</span>
            <span v-if="ownedCardIds.has(c.id)" class="badge">보유 중</span>
            <span v-else class="badge blue">연결 가능</span>
          </div>
          <div class="muted3 fs11 mt4">{{ c.description }}</div>
        </div>
      </button>
    </div>
  </div>
</div>
</template>

<style scoped>
.wallet { display: flex; flex-wrap: wrap; gap: 18px; }
.slot {
  text-align: left; padding: 0; background: none; border: none;
  border-radius: 16px; transition: transform .2s cubic-bezier(.2,.8,.2,1);
}
.slot :deep(.art) { transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s; }
.slot:hover :deep(.art) { transform: translateY(-5px); box-shadow: 0 16px 34px rgba(13,16,23,.26), 0 3px 8px rgba(13,16,23,.14); }
.slot.on :deep(.art) { transform: translateY(-5px); box-shadow: 0 0 0 2px var(--blue), 0 16px 34px rgba(37,99,235,.28); }
.slot-meta { width: 300px; padding: 10px 3px 0; }

.detail { display: flex; gap: 26px; align-items: flex-start; }
.dinfo { flex: 1; min-width: 0; }
.specs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.sp { padding: 9px 12px; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
.sp .k { font-size: 13px; color: var(--text-3); }
.sp .v { font-size: 16px; font-weight: 700; margin-top: 2px; letter-spacing: -0.015em; }

.slide-enter-active, .slide-leave-active { transition: opacity .24s, transform .24s; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 860px) {
  .detail { flex-direction: column; }
  .specs { grid-template-columns: repeat(2, 1fr); }
}
</style>
