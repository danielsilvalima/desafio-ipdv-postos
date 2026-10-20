<script setup lang="ts">
import { useNotificacoes } from '@/composables/useNotificacoes';

const { fila } = useNotificacoes();
</script>

<template>
  <v-snackbar-queue v-model="fila" location="bottom right" closable close-text="Fechar" />
</template>
