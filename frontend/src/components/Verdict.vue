<script setup>
defineProps({
  eyebrow: String,
  tone: { type: String, default: 'blue' },   // blue | ok | warn | danger
})
</script>

<template>
  <div class="verdict" :class="tone">
    <div class="v-main">
      <div v-if="eyebrow" class="v-eyebrow">{{ eyebrow }}</div>
      <div class="v-big"><slot name="headline" /></div>
      <p v-if="$slots.sub" class="v-sub"><slot name="sub" /></p>
      <slot name="sub2" />
    </div>
    <div v-if="$slots.side" class="v-side"><slot name="side" /></div>
  </div>
</template>

<style scoped>
.verdict {
  display: flex; gap: 30px; align-items: center;
  position: relative; overflow: hidden;
  padding: 28px 30px; border-radius: var(--r-lg); box-shadow: var(--shadow);
  border: 1px solid rgba(27,77,255,.2);
  background: linear-gradient(120deg, rgba(34,211,238,.06), rgba(27,77,255,.06) 45%, rgba(192,38,211,.05)), #fff;
}
.verdict::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--grad);
}
.verdict.ok     { border-color: rgba(4,120,87,.24);  background: linear-gradient(120deg, rgba(4,120,87,.07), rgba(4,120,87,.02)), #fff; }
.verdict.ok::before     { background: linear-gradient(90deg,#34d399,#047857); }
.verdict.warn::before   { background: linear-gradient(90deg,#fbbf24,#b45309); }
.verdict.danger::before { background: linear-gradient(90deg,#fb7185,#dc2626); }
.verdict.warn   { border-color: rgba(180,83,9,.26);  background: linear-gradient(120deg, rgba(180,83,9,.07), rgba(180,83,9,.02)), #fff; }
.verdict.danger { border-color: rgba(220,38,38,.24); background: linear-gradient(120deg, rgba(220,38,38,.06), rgba(220,38,38,.02)), #fff; }
.v-main { flex: 1; min-width: 0; }
.v-eyebrow { font-size: 14px; font-weight: 600; color: var(--text-2); }
.v-big { font-size: 36px; font-weight: 800; letter-spacing: -0.045em; line-height: 1.18; margin-top: 2px; }
.v-sub { font-size: 15px; line-height: 1.7; color: var(--text-2); margin-top: 12px; max-width: 660px; }
.v-side { width: 288px; flex: 0 0 288px; min-width: 0; padding-left: 26px; border-left: 1px solid var(--line); }
.v-side :deep(.tnum) { white-space: nowrap; }
@media (max-width: 980px) {
  .verdict { flex-direction: column; align-items: stretch; }
  .v-big { font-size: 29px; }
  .v-side { width: auto; flex: none; padding-left: 0; padding-top: 18px; border-left: none; border-top: 1px solid var(--line); }
}
</style>
