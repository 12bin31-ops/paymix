<script setup>
import { computed } from 'vue'

const p = defineProps({
  cardCode: String,
  cardName: String,
  maskedNumber: String,
  cardAlias: String,
  brand: String,
  imageUrl: String,
  size: { type: String, default: 'md' },   // sm | md | lg
  dim: Boolean,                            // 미보유/판매중지 표현
})

/* card_code 별 카드 페이스. image_url 이 있으면 그 이미지를 우선 사용한다. */
const THEME = {
  'PM-PLATINUM': {
    bg: 'linear-gradient(128deg,#1a1d24 0%,#2b303b 38%,#141821 72%,#0b0d12 100%)',
    sheen: 'linear-gradient(112deg,transparent 28%,rgba(147,197,253,.30) 44%,rgba(196,181,253,.24) 53%,rgba(103,232,249,.20) 61%,transparent 76%)',
    ink: '#ffffff', sub: 'rgba(255,255,255,.62)', line: 'rgba(255,255,255,.14)',
  },
  'PM-CLASSIC': {
    bg: 'linear-gradient(128deg,#1e40af 0%,#2563eb 44%,#1d4ed8 74%,#172554 100%)',
    sheen: 'linear-gradient(112deg,transparent 30%,rgba(255,255,255,.26) 48%,transparent 70%)',
    ink: '#ffffff', sub: 'rgba(255,255,255,.66)', line: 'rgba(255,255,255,.17)',
  },
  'PM-TRAVEL': {
    bg: 'linear-gradient(128deg,#0e7490 0%,#0891b2 40%,#0ea5e9 70%,#075985 100%)',
    sheen: 'linear-gradient(112deg,transparent 30%,rgba(224,242,254,.34) 47%,transparent 68%)',
    ink: '#ffffff', sub: 'rgba(255,255,255,.68)', line: 'rgba(255,255,255,.18)',
  },
  'PM-DAILY': {
    bg: 'linear-gradient(128deg,#065f46 0%,#047857 38%,#0d9488 72%,#134e4a 100%)',
    sheen: 'linear-gradient(112deg,transparent 30%,rgba(209,250,229,.32) 48%,transparent 70%)',
    ink: '#ffffff', sub: 'rgba(255,255,255,.68)', line: 'rgba(255,255,255,.18)',
  },
  'PM-BASIC': {
    bg: 'linear-gradient(128deg,#e2e8f0 0%,#f1f5f9 42%,#cbd5e1 100%)',
    sheen: 'linear-gradient(112deg,transparent 32%,rgba(255,255,255,.7) 50%,transparent 70%)',
    ink: '#0f172a', sub: 'rgba(15,23,42,.55)', line: 'rgba(15,23,42,.13)',
  },
}
const DEFAULT = THEME['PM-CLASSIC']
const t = computed(() => THEME[p.cardCode] || DEFAULT)
const digits = computed(() => (p.maskedNumber || '••••-****-****-••••').split('-'))
</script>

<template>
  <div class="art" :class="[size, { dim }]" :style="{ '--bg': t.bg, '--ink': t.ink, '--sub': t.sub, '--line': t.line }">
    <img v-if="imageUrl" :src="imageUrl" :alt="cardName" class="photo" />
    <template v-else>
      <div class="sheen" :style="{ background: t.sheen }"></div>

      <div class="top">
        <span class="logo">PayMix</span>
        <span class="wave" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" :stroke="t.ink" stroke-width="1.5" stroke-linecap="round" opacity=".8">
            <path d="M6 5.5a7 7 0 0 1 0 9"/><path d="M9.5 3a11 11 0 0 1 0 14"/><path d="M2.5 8a3.5 3.5 0 0 1 0 4"/>
          </svg>
        </span>
      </div>

      <div class="chip" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>

      <div class="num">
        <span v-for="(d, i) in digits" :key="i">{{ d }}</span>
      </div>

      <div class="bot">
        <div class="nm">
          <div class="l">{{ cardAlias || cardName }}</div>
          <div class="s" v-if="cardAlias">{{ cardName }}</div>
        </div>
        <div class="brand">{{ brand || 'VISA' }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.art {
  position: relative; width: var(--w, 300px); aspect-ratio: 1.586;
  border-radius: calc(var(--w, 300px) / 22);
  background: var(--bg); color: var(--ink);
  padding: calc(var(--w, 300px) / 16);
  display: flex; flex-direction: column;
  overflow: hidden; flex: 0 0 auto;
  box-shadow: 0 10px 26px rgba(13,16,23,.22), 0 2px 6px rgba(13,16,23,.12);
  font-size: calc(var(--w, 300px) / 25);
  transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s;
}
.art.xs { --w: 104px; }
.art.sm { --w: 132px; }
.art.md { --w: 300px; }
.art.lg { --w: 372px; }
.art.dim { filter: grayscale(.75) opacity(.55); box-shadow: none; }

.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.sheen { position: absolute; inset: -30%; pointer-events: none; mix-blend-mode: screen; }

.top { display: flex; align-items: center; justify-content: space-between; position: relative; }
.logo { font-weight: 800; letter-spacing: -0.05em; font-size: 1.22em; line-height: 1; }
.wave { display: inline-flex; opacity: .9; }

.chip {
  position: relative; width: 2.05em; height: 1.55em; border-radius: .3em; margin-top: .85em;
  background: linear-gradient(140deg,#f2d98c 0%,#d9b45c 42%,#f6e6ae 70%,#c99f42 100%);
  display: flex; flex-direction: column; justify-content: center; gap: .18em; padding: 0 .22em;
  box-shadow: inset 0 0 0 .5px rgba(0,0,0,.18);
}
.chip span { height: .5px; background: rgba(0,0,0,.3); display: block; }
.chip span:nth-child(2) { width: 70%; }

.num {
  position: relative; margin-top: auto; display: flex; gap: .62em;
  font-family: ui-monospace,'SF Mono',Menlo,monospace;
  font-size: 1.02em; letter-spacing: .01em; font-weight: 600;
}
.bot { position: relative; display: flex; align-items: flex-end; justify-content: space-between; margin-top: .62em; gap: .6em; }
.nm { min-width: 0; }
.nm .l { font-weight: 700; font-size: .92em; letter-spacing: -0.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nm .s { font-size: .74em; color: var(--sub); margin-top: .1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.brand { font-weight: 800; font-style: italic; font-size: 1.02em; letter-spacing: -0.03em; opacity: .95; }

.art.sm .chip, .art.xs .chip { margin-top: .45em; }
.art.sm .nm .s, .art.xs .nm .s { display: none; }
.art.xs .num { font-size: .92em; gap: .42em; }
</style>
