<script setup>
import { store } from '../store.js'
</script>
<template>
  <transition name="t">
    <div v-if="store.toast" class="toast" :class="store.toast.type">
      {{ store.toast.message }}
    </div>
  </transition>
</template>
<style scoped>
.toast {
  position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%); z-index: 200;
  padding: 11px 20px; border-radius: 11px; font-size: 15.5px; font-weight: 600;
  background: #0d1017; border: 1px solid #0d1017; color: #fff;
  box-shadow: 0 12px 36px rgba(13,16,23,.28);
}
.toast.ok     { background: #065f46; border-color: #065f46; color: #ecfdf5; }
.toast.danger { background: #b91c1c; border-color: #b91c1c; color: #fef2f2; }
.t-enter-active, .t-leave-active { transition: opacity .22s, transform .22s; }
.t-enter-from, .t-leave-to { opacity: 0; transform: translate(-50%, 10px); }
</style>
