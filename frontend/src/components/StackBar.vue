<script setup>
import { computed } from 'vue'
const p = defineProps({
  items:  { type: Array, required: true },   // [{ label, value, color }]
  height: { type: Number, default: 26 },
  labels: { type: Boolean, default: true },
})
const total = computed(() => p.items.reduce((s, i) => s + (i.value || 0), 0) || 1)
const segs = computed(() => p.items.filter(i => i.value > 0)
  .map(i => ({ ...i, pct: (i.value / total.value) * 100 })))
</script>

<template>
  <div>
    <div class="sb" :style="{ height: height + 'px' }">
      <div v-for="(s, i) in segs" :key="i" class="sg"
           :style="{ width: s.pct + '%', background: s.color }" :title="`${s.label} ${s.pct.toFixed(1)}%`">
        <span v-if="s.pct > 11" class="pc">{{ s.pct.toFixed(0) }}%</span>
      </div>
    </div>
    <div v-if="labels" class="legend mt8">
      <span v-for="(s, i) in segs" :key="i"><i :style="{ background: s.color }"></i>{{ s.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.sb { display: flex; width: 100%; border-radius: 8px; overflow: hidden; background: var(--surface-3); }
.sg { display: flex; align-items: center; justify-content: center; transition: width .7s cubic-bezier(.2,.8,.2,1); min-width: 2px; }
.pc { font-size: 12px; font-weight: 800; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
</style>
