<script setup>
import { computed } from 'vue'
const p = defineProps({
  rows: { type: Array, required: true },   // [{ label, value, color, note, strong }]
  compact: Boolean,                        // 좁은 컬럼용 — 라벨/값 위, 바 아래
})
const max = computed(() => Math.max(...p.rows.map(r => r.value), 1))
</script>

<template>
  <div class="cb" :class="{ compact }">
    <!-- 좁은 폭: 라벨·값을 한 줄로, 바는 그 아래 -->
    <template v-if="compact">
      <div v-for="(r, i) in rows" :key="i" class="cc">
        <div class="cc-h">
          <span class="lb">{{ r.label }}</span>
          <span class="vl tnum" :class="{ on: r.strong }">
            {{ Number(r.value).toLocaleString() }}<span class="won">원</span>
          </span>
        </div>
        <div class="tr-wrap sm">
          <div class="tr-bar" :style="{ width: (r.value / max * 100) + '%', background: r.color }"></div>
        </div>
        <div v-if="r.note" class="muted3 fs12 mt4">{{ r.note }}</div>
      </div>
    </template>

    <!-- 넓은 폭: 3열 -->
    <template v-else>
      <div v-for="(r, i) in rows" :key="i" class="cr">
        <div class="lb">{{ r.label }}</div>
        <div class="tr-wrap">
          <div class="tr-bar" :style="{ width: (r.value / max * 100) + '%', background: r.color }"></div>
        </div>
        <div class="vl tnum" :class="{ on: r.strong }">
          {{ Number(r.value).toLocaleString() }}<span class="won">원</span>
          <div v-if="r.note" class="muted3 fs12">{{ r.note }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cb { display: flex; flex-direction: column; gap: 12px; }
.cb.compact { gap: 14px; }

.cr { display: grid; grid-template-columns: 96px minmax(0,1fr) minmax(0,140px); gap: 14px; align-items: center; }
.lb { font-size: 14px; color: var(--text-2); font-weight: 600; white-space: nowrap; }
.tr-wrap { background: var(--surface-3); border-radius: 7px; height: 30px; overflow: hidden; }
.tr-wrap.sm { height: 12px; border-radius: 6px; }
.tr-bar { height: 100%; border-radius: 7px; transition: width .8s cubic-bezier(.2,.8,.2,1); }

.vl {
  text-align: right; font-size: 18px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--text-2); white-space: nowrap; min-width: 0;
}
.vl.on { color: var(--text); }
.vl .won { font-size: 13px; font-weight: 700; margin-left: 1px; }

/* compact */
.cc-h { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.cc-h .vl { font-size: 21px; }
.cc-h .lb { flex: 0 0 auto; }

@media (max-width: 700px) { .cr { grid-template-columns: 76px minmax(0,1fr) minmax(0,104px); gap: 10px; } .vl { font-size: 16px; } }
</style>
