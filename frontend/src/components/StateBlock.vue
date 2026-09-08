<script setup>
defineProps({ icon: String, title: String, desc: String, tone: { type: String, default: '' } })
</script>
<template>
  <div class="empty" :class="tone">
    <div class="ico">{{ icon }}</div>
    <div class="t">{{ title }}</div>
    <div class="d" v-if="desc" v-html="desc"></div>
    <div class="mt16"><slot /></div>
  </div>
</template>
<style scoped>
.empty.ok  { border-color: rgba(4,120,87,.3);  background: linear-gradient(180deg, rgba(4,120,87,.05), #fff); }
.empty.ok .t { color: var(--ok); }
.empty.warn { border-color: rgba(180,83,9,.3); background: linear-gradient(180deg, rgba(180,83,9,.045), #fff); }
</style>
