import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from '../store.js'

const routes = [
  { path: '/',        redirect: '/login' },
  { path: '/login',   name: 'login',   component: () => import('../views/LoginView.vue'),          meta: { public: true, screen: 1 } },
  { path: '/cards',   name: 'cards',   component: () => import('../views/CardLinkView.vue'),       meta: { role: 'CUSTOMER', screen: 2 } },
  { path: '/diagnosis', name: 'diagnosis', component: () => import('../views/DiagnosisView.vue'),  meta: { role: 'CUSTOMER', screen: 3 } },
  { path: '/channels', name: 'channels', component: () => import('../views/ChannelView.vue'),      meta: { role: 'CUSTOMER', screen: 4 } },
  { path: '/plan',    name: 'plan',    component: () => import('../views/RecommendationView.vue'), meta: { role: 'CUSTOMER', screen: 5 } },
  { path: '/issuer/dashboard',  name: 'issuer-dashboard',  component: () => import('../views/IssuerDashboardView.vue'),  meta: { role: 'ISSUER_MANAGER', screen: 6 } },
  { path: '/issuer/simulation', name: 'issuer-simulation', component: () => import('../views/IssuerSimulationView.vue'), meta: { role: 'ISSUER_MANAGER', screen: 7 } },
  { path: '/issuer/rules',      name: 'issuer-rules',      component: () => import('../views/IssuerRuleView.vue'),       meta: { role: 'ISSUER_MANAGER', screen: 8 } },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (!store.user) return { name: 'login' }
  if (to.meta.role && store.user.role !== to.meta.role) {
    // 403 — 액터 불일치 시 자신의 홈으로
    return store.user.role === 'CUSTOMER' ? { name: 'cards' } : { name: 'issuer-dashboard' }
  }
  return true
})

export default router
