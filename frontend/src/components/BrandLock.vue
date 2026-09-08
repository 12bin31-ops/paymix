<script setup>
defineProps({
  size:    { type: String, default: 'md' },     // sm | md | lg | xl
  variant: { type: String, default: 'dark' },   // dark(밝은 글자) | light(어두운 글자)
  stacked: { type: Boolean, default: true },
})
</script>

<template>
  <div class="lock" :class="[size, variant, { row: !stacked }]">
    <div class="tag top">똑똑한 소비</div>
    <div class="word">Paymix</div>
    <div class="tag bot">페이와의 상생</div>
  </div>
</template>

<style scoped>
.lock { display: inline-block; line-height: 1; }
.word {
  font-weight: 800; letter-spacing: -0.055em; line-height: .96;
  font-size: var(--w, 56px);
}
.tag {
  font-weight: 700; letter-spacing: -0.03em;
  font-size: calc(var(--w, 56px) * .285);
  line-height: 1.1;
}
.tag.top { margin-bottom: calc(var(--w, 56px) * .06); }
.tag.bot { margin-top: calc(var(--w, 56px) * .06); text-align: right; }

/* 크기 */
.lock.sm { --w: 22px; }
.lock.md { --w: 40px; }
.lock.lg { --w: 68px; }
.lock.xl { --w: 96px; }

/* 어두운 배경용 — 첨부 커버와 동일 */
.lock.dark .word { color: #fff; }
.lock.dark .tag  { color: #8b8f9a; }

/* 밝은 배경용 */
.lock.light .word {
  background: linear-gradient(112deg, #0d1017 32%, #1b4dff 72%, #22d3ee);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.lock.light .tag { color: #9aa2b1; }

/* 한 줄 배치 (헤더용) */
.lock.row { display: flex; align-items: baseline; gap: calc(var(--w, 40px) * .22); }
.lock.row .tag.top { display: none; }
.lock.row .tag.bot { margin: 0; text-align: left; font-size: calc(var(--w, 40px) * .32); }
</style>
