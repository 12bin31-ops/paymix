<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store } from './store.js'
import AppHeader from './components/AppHeader.vue'
import Toast from './components/Toast.vue'

const route = useRoute()
const router = useRouter()
const showHeader = computed(() => !!store.user && route.name !== 'login')
</script>

<template>
  <div class="app-shell">
    <AppHeader v-if="showHeader" />
    <router-view v-slot="{ Component }">
      <component :is="Component" :key="route.fullPath" />
    </router-view>
    <Toast />
  </div>
</template>
