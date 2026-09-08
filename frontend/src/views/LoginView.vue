<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { ApiError } from '../api/client.js'
import BrandLock from '../components/BrandLock.vue'

const router = useRouter()
const mode = ref('login')           // 'login' | 'signup'
const busy = ref(false)
const error = reactive({ msg: '', field: '' })

const loginForm  = reactive({ email: 'subin@paymix.co.kr', password: 'paymix123' })
const signupForm = reactive({ role: 'CUSTOMER', name: '', email: '', password: '', birthYear: '' })

const accounts = [
  { email: 'subin@paymix.co.kr',   name: '박수빈', desc: '고객 · 개선 제안 있음',        tone: 'blue' },
  { email: 'optimal@paymix.co.kr', name: '이최적', desc: '고객 · 이미 최적 (예외)',      tone: 'ok' },
  { email: 'newbie@paymix.co.kr',  name: '김신규', desc: '고객 · 진단 불가 (예외)',      tone: 'warn' },
  { email: 'issuer@paymix.co.kr',  name: '이담당', desc: '카드사 담당자',                tone: '' },
]

function clearErr() { error.msg = ''; error.field = '' }

async function doLogin() {
  clearErr(); busy.value = true
  try {
    const u = await store.login(loginForm.email, loginForm.password)
    store.notify(`${u.name} 님, 환영합니다`)
    router.push(u.role === 'CUSTOMER' ? '/cards' : '/issuer/dashboard')
  } catch (e) {
    error.msg = e.message
  } finally { busy.value = false }
}

async function doSignup() {
  clearErr(); busy.value = true
  try {
    await store.signup({
      ...signupForm,
      birthYear: signupForm.birthYear ? Number(signupForm.birthYear) : null,
    })
    store.notify('가입이 완료되었습니다. 로그인해 주세요.')
    loginForm.email = signupForm.email
    loginForm.password = ''
    mode.value = 'login'
  } catch (e) {
    error.msg = e.message
    error.field = e.field || ''
  } finally { busy.value = false }
}

function quick(email) { loginForm.email = email; loginForm.password = 'paymix123'; mode.value = 'login'; clearErr() }
</script>

<template>
<div class="wrap">
  <!-- ===== 좌: 브랜드 커버 패널 ===== -->
  <aside class="cover">
    <div class="blob">
      <span class="b1"></span><span class="b2"></span><span class="b3"></span><span class="b4"></span>
      <span class="rim"></span>
    </div>
    <div class="cover-in">
      <BrandLock size="xl" variant="dark" />
      <div class="cover-who">판교 3반 &nbsp;P074 &nbsp;박수빈</div>
    </div>
  </aside>

  <!-- ===== 우: 폼 ===== -->
  <main class="panel-wrap">
    <div class="panel">
      <div class="tabs mb16">
        <button :class="{ on: mode==='login' }"  @click="mode='login'; clearErr()">로그인</button>
        <button :class="{ on: mode==='signup' }" @click="mode='signup'; clearErr()">회원가입</button>
      </div>

      <form v-if="mode==='login'" class="stack" @submit.prevent="doLogin">
        <div class="field">
          <label>이메일</label>
          <input class="input" type="email" v-model="loginForm.email" placeholder="you@paymix.co.kr" autocomplete="username" />
        </div>
        <div class="field">
          <label>비밀번호</label>
          <input class="input" type="password" v-model="loginForm.password" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div v-if="error.msg" class="note danger">{{ error.msg }}</div>
        <button class="btn pri lg block mt8" :disabled="busy">{{ busy ? '확인 중…' : '로그인' }}</button>
      </form>

      <form v-else class="stack" @submit.prevent="doSignup">
        <div class="field">
          <label>가입 유형</label>
          <div class="seg">
            <button type="button" :class="{ on: signupForm.role==='CUSTOMER' }" @click="signupForm.role='CUSTOMER'">고객</button>
            <button type="button" :class="{ on: signupForm.role==='ISSUER_MANAGER' }" @click="signupForm.role='ISSUER_MANAGER'">카드사 담당자</button>
          </div>
        </div>
        <div class="field"><label>이름</label>
          <input class="input" v-model="signupForm.name" placeholder="박수빈" /></div>
        <div class="field"><label>이메일</label>
          <input class="input" :class="{ err: error.field==='email' }" type="email" v-model="signupForm.email" placeholder="you@paymix.co.kr" /></div>
        <div class="row gap10">
          <div class="field col"><label>비밀번호 <span class="muted3">8자 이상</span></label>
            <input class="input" :class="{ err: error.field==='password' }" type="password" v-model="signupForm.password" placeholder="••••••••" /></div>
          <div class="field col" v-if="signupForm.role==='CUSTOMER'"><label>출생연도</label>
            <input class="input" v-model="signupForm.birthYear" placeholder="1999" inputmode="numeric" /></div>
        </div>
        <div v-if="error.msg" class="note danger">{{ error.msg }}</div>
        <button class="btn pri lg block mt8" :disabled="busy">{{ busy ? '처리 중…' : '회원가입' }}</button>
      </form>

      <div class="accounts">
        <div class="acc-t">데모 계정 <span class="muted3">· 비밀번호 paymix123</span></div>
        <button v-for="a in accounts" :key="a.email" class="acc" @click="quick(a.email)">
          <span class="dot" :class="a.tone"></span>
          <span class="fw6">{{ a.name }}</span>
          <span class="muted3 fs13">{{ a.desc }}</span>
          <span class="spacer"></span>
          <span class="mono muted3 fs12">{{ a.email }}</span>
        </button>
      </div>
    </div>
  </main>
</div>
</template>

<style scoped>
.wrap { display: grid; grid-template-columns: 2fr 3fr; min-height: 100vh; background: var(--bg); }

/* ===== 커버 패널 — 첨부 커버 아트 재현 ===== */
.cover {
  position: relative; overflow: hidden; background: #000;
  display: flex; align-items: center; padding: 0 clamp(32px, 4.2vw, 62px);
}
.cover-in { position: relative; z-index: 2; max-width: 460px; }
.cover-who { margin-top: 56px; font-size: 15px; font-weight: 700; color: #fff; letter-spacing: -0.015em; }

/* 크롬 이리데센트 블롭 */
.blob { position: absolute; right: -26%; top: 50%; transform: translateY(-50%);
  width: 104%; aspect-ratio: 1; pointer-events: none; }
.blob span { position: absolute; border-radius: 50%; }
.b1 { inset: 6% 4% 22% 16%;
  background: conic-gradient(from 210deg at 52% 46%, #0a1f7a, #1b4dff 18%, #7db3ff 32%, #ffffff 40%,
              #6ee7ff 50%, #1b4dff 64%, #c026d3 78%, #4c1d95 88%, #0a1f7a);
  filter: blur(26px) saturate(150%); opacity: .96; }
.b2 { inset: 26% 30% 10% 6%;
  background: radial-gradient(circle at 38% 34%, #ffffff 0%, #a5c8ff 16%, #1b4dff 46%, transparent 74%);
  filter: blur(20px); opacity: .8; }
.b3 { inset: 2% 26% 52% 30%;
  background: radial-gradient(circle at 50% 50%, #ff6ad5 0%, #c026d3 34%, transparent 70%);
  filter: blur(34px); opacity: .5; }
.b4 { inset: 46% 10% 8% 34%;
  background: radial-gradient(circle at 46% 40%, #67e8f9 0%, #22d3ee 30%, transparent 68%);
  filter: blur(30px); opacity: .48; }
.rim { inset: 12% 12% 20% 20%; border: 1.5px solid rgba(255,255,255,.16);
  filter: blur(1.5px); opacity: .55; }
.cover::after {
  content: ''; position: absolute; inset: 0; z-index: 1;
  background: radial-gradient(ellipse 66% 82% at 22% 50%, #000 30%, rgba(0,0,0,.74) 60%, rgba(0,0,0,.3) 100%);
}

/* ===== 폼 ===== */
.panel-wrap { display: flex; align-items: center; justify-content: center; padding: 48px 40px; }
.panel { width: 100%; max-width: 468px; }
.seg { display: flex; gap: 5px; }
.seg button {
  flex: 1; height: 40px; border-radius: 10px; border: 1px solid var(--line-2);
  background: var(--bg-1); font-size: 14px; font-weight: 600; color: var(--text-3); transition: all .14s;
}
.seg button.on { background: #0d1017; color: #fff; border-color: #0d1017; }

.accounts { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 5px; }
.acc-t { font-size: 12.5px; color: var(--text-2); font-weight: 600; margin-bottom: 4px; }
.acc {
  display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
  padding: 9px 12px; border-radius: 10px; border: 1px solid var(--line);
  background: #fff; font-size: 14px; transition: border-color .14s, background .14s, transform .12s;
}
.acc:hover { border-color: var(--line-2); background: var(--surface-2); transform: translateX(2px); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); flex: 0 0 7px; }
.dot.blue { background: var(--blue); } .dot.ok { background: var(--ok); } .dot.warn { background: var(--warn); }

@media (max-width: 1280px) {
  .cover-in :deep(.lock) { --w: 78px; }
}
@media (max-width: 1020px) {
  .wrap { grid-template-columns: 1fr; }
  .cover-in :deep(.lock) { --w: 62px; }
  .cover { min-height: 320px; padding: 44px 28px; }
  .blob { right: -30%; width: 96%; }
  .panel-wrap { padding: 34px 22px; }
}
</style>
