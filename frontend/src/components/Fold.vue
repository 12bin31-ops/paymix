<script setup>
import { ref } from 'vue'
const p = defineProps({
  title: String,
  summary: String,
  count: [Number, String],
  open: { type: Boolean, default: false },
})
const on = ref(p.open)
</script>

<template>
  <div class="fold" :class="{ on }">
    <button class="fh" @click="on = !on">
      <span class="chev">›</span>
      <span class="ft">{{ title }}</span>
      <span v-if="count != null" class="badge">{{ count }}</span>
      <span class="fs" v-if="summary">{{ summary }}</span>
      <span class="spacer"></span>
      <span class="more">{{ on ? '접기' : '펼치기' }}</span>
    </button>
    <transition name="fd">
      <div v-if="on" class="fb"><slot /></div>
    </transition>
  </div>
</template>

<style scoped>
.fold { border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); overflow: hidden; }
.fold.on { box-shadow: var(--shadow-sm); }
.fh {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 15px 18px; font-size: 15px; color: var(--text-2); transition: background .14s;
}
.fh:hover { background: var(--surface-2); }
.chev { display: inline-block; font-size: 20px; line-height: 1; color: var(--text-3); transition: transform .2s; }
.fold.on .chev { transform: rotate(90deg); }
.ft { font-weight: 700; color: var(--text); letter-spacing: -0.015em; }
.fs { font-size: 14px; color: var(--text-3); }
.more { font-size: 13px; color: var(--text-3); font-weight: 600; }
.fb { padding: 4px 18px 18px; }
.fd-enter-active, .fd-leave-active { transition: opacity .2s; }
.fd-enter-from, .fd-leave-to { opacity: 0; }
</style>
