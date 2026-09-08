<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { store } from '../store.js'
import BrandLock from '../components/BrandLock.vue'

const router = useRouter()
const route = useRoute()

const navs = computed(() => store.isCustomer
  ? [
      { to: '/cards',     label: '카드 연결',      n: 2 },
      { to: '/diagnosis', label: '실적·연회비',    n: 3 },
      { to: '/channels',  label: '페이·정기결제',  n: 4 },
      { to: '/plan',      label: '개선 제안',      n: 5 },
    ]
  : [
      { to: '/issuer/dashboard',  label: '채널 포지션',      n: 6 },
      { to: '/issuer/simulation', label: '정책 시뮬레이션',  n: 7 },
      { to: '/issuer/rules',      label: '카드·혜택 규칙',   n: 8 },
    ])

async function doLogout() {
  await store.logout()
  router.push('/login')
}
</script>

<template>
  <header class="hd">
    <div class="container hd-in">
      <router-link :to="navs[0].to" class="brand">
        <BrandLock size="sm" variant="light" :stacked="false" />
        <span class="tag">{{ store.isIssuer ? '카드사 콘솔' : '' }}</span>
      </router-link>

      <nav class="nav">
        <router-link v-for="n in navs" :key="n.to" :to="n.to"
                     :class="['nav-i', { on: route.path === n.to }]">{{ n.label }}</router-link>
      </nav>

      <div class="spacer"></div>
      <div class="who">
        <span class="fw6">{{ store.user?.name }}</span>
        <span class="badge" :class="store.isIssuer ? 'ok' : 'blue'">
          {{ store.isIssuer ? '카드사 담당자' : '고객' }}
        </span>
      </div>
      <button class="btn sm ghost" @click="doLogout">로그아웃</button>
    </div>
  </header>
</template>

<style scoped>
.hd {
  position: sticky; top: 0; z-index: 50;
  background: rgba(255,255,255,.82); backdrop-filter: blur(18px) saturate(180%);
  border-bottom: 1px solid var(--line);
}
.hd-in { display: flex; align-items: center; gap: 22px; height: 58px; }
.brand { display: flex; align-items: baseline; gap: 8px; }
.logo {
  font-size: 23px; font-weight: 800; letter-spacing: -0.052em;
  background: linear-gradient(115deg, #0d1017 20%, #2563eb 68%, #06b6d4);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.tag {
  font-size: 12px; font-weight: 700; letter-spacing: -0.01em;
  background: linear-gradient(100deg, #2563eb, #7c3aed);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  opacity: .9;
}
.nav { display: flex; gap: 3px; }
.nav-i {
  padding: 7px 13px; border-radius: 8px; font-size: 15.5px; font-weight: 600;
  color: var(--text-3); letter-spacing: -0.012em; transition: color .14s, background .14s;
}
.nav-i:hover { color: var(--text-2); background: var(--surface); }
.nav-i.on { color: var(--text); background: var(--surface-2); }
.who { display: flex; align-items: center; gap: 8px; font-size: 15px; }
@media (max-width: 900px) { .nav { display: none; } }
</style>
