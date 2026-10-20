<script setup lang="ts">
defineProps<{ rotulo: string; valor?: string | number | null }>();
</script>

<template>
  <div>
    <div class="text-caption text-medium-emphasis">{{ rotulo }}</div>
    <div class="text-body-2">
      <slot>{{ valor === null || valor === undefined || valor === '' ? '—' : valor }}</slot>
    </div>
  </div>
</template>
