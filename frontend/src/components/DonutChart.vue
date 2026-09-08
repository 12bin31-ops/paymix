<script setup>
import { computed } from 'vue'
const p = defineProps({
  items: { type: Array, required: true },   // [{ label, value, color }]
  size:  { type: Number, default: 168 },
  thickness: { type: Number, default: 20 },
  gap:   { type: Number, default: 2 },      // 조각 사이 각도(도)
})
const total = computed(() => p.items.reduce((s, i) => s + (i.value || 0), 0) || 1)
const R = computed(() => (p.size - p.thickness) / 2)
const C = computed(() => 2 * Math.PI * R.value)

const arcs = computed(() => {
  let acc = 0
  return p.items.filter(i => i.value > 0).map(i => {
    const frac = i.value / total.value
    const len = Math.max(0, C.value * frac - p.gap)
    const a = { ...i, frac, dash: `${len} ${C.value - len}`, offset: -C.value * acc }
    acc += frac
    return a
  })
})
</script>

<template>
  <div class="dn" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <g :transform="`rotate(-90 ${size/2} ${size/2})`">
        <circle :cx="size/2" :cy="size/2" :r="R" fill="none" stroke="var(--surface-3)" :stroke-width="thickness" />
        <circle v-for="(a, i) in arcs" :key="i"
                :cx="size/2" :cy="size/2" :r="R" fill="none"
                :stroke="a.color" :stroke-width="thickness" stroke-linecap="round"
                :stroke-dasharray="a.dash" :stroke-dashoffset="a.offset" class="seg" />
      </g>
    </svg>
    <div class="ctr"><slot /></div>
  </div>
</template>

<style scoped>
.dn { position: relative; flex: 0 0 auto; }
.ctr { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; line-height: 1.25; }
.seg { transition: stroke-dasharray .7s cubic-bezier(.2,.8,.2,1); }
</style>
