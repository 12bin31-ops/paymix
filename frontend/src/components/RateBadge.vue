<script setup>
const p = defineProps({ rate: Number })
</script>
<template>
  <span class="badge" :class="rate >= 1 ? 'ok' : rate > 0 ? 'warn' : 'danger'">
    {{ Math.round(rate * 100) }}%
  </span>
</template>
