<script setup>
const p = defineProps({ value: Number, max: { type: Number, default: 1 }, thin: Boolean, color: String })
</script>
<template>
  <div class="meter" :class="{ thin }">
    <i :style="{ width: Math.min(100, Math.max(0, (value / max) * 100)) + '%', background: color || undefined }"></i>
  </div>
</template>
