<script setup>
defineProps({ screen: Number, title: String, desc: String })
</script>
<template>
  <div class="ph">
    <div>
      <div class="center gap8 mb4">
        <span class="badge">화면 {{ screen }}</span>
        <slot name="badge" />
      </div>
      <h1 class="h1">{{ title }}</h1>
      <p v-if="desc" class="muted fs13 mt4">{{ desc }}</p>
    </div>
    <div class="spacer"></div>
    <div class="center gap8"><slot name="actions" /></div>
  </div>
</template>
<style scoped>
.ph { display: flex; align-items: flex-end; gap: 14px; margin-bottom: 20px; }
</style>
