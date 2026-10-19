<script setup lang="ts">
import { onMounted, ref } from 'vue';

type ApiStatus = 'verificando' | 'online' | 'offline';

const apiStatus = ref<ApiStatus>('verificando');

const statusChip: Record<ApiStatus, { color: string; text: string }> = {
  verificando: { color: 'grey', text: 'Verificando API...' },
  online: { color: 'success', text: 'API online' },
  offline: { color: 'error', text: 'API indisponível' },
};

onMounted(async () => {
  try {
    const response = await fetch('/api/health');
    apiStatus.value = response.ok ? 'online' : 'offline';
  } catch {
    apiStatus.value = 'offline';
  }
});
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" flat>
      <template #prepend>
        <v-icon icon="mdi-gas-station" class="ms-2" />
      </template>
      <v-app-bar-title>Postos de Combustível</v-app-bar-title>
      <template #append>
        <v-chip :color="statusChip[apiStatus].color" variant="flat" size="small" class="me-2">
          {{ statusChip[apiStatus].text }}
        </v-chip>
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="py-8" max-width="960">
        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Ambiente pronto</v-card-title>
            <v-card-subtitle>Importação, listagem e exportação de postos serão adicionadas nas próximas etapas.</v-card-subtitle>
          </v-card-item>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>
