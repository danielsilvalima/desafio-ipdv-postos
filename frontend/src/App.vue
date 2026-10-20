<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api/cliente';
import AppNotificacoes from '@/components/AppNotificacoes.vue';

type StatusApi = 'verificando' | 'online' | 'offline';

const statusApi = ref<StatusApi>('verificando');

const INDICADOR: Record<StatusApi, { cor: string; texto: string }> = {
  verificando: { cor: 'grey-lighten-1', texto: 'Verificando API' },
  online: { cor: 'success', texto: 'API online' },
  offline: { cor: 'error', texto: 'API indisponível' },
};

const MENU = [
  { titulo: 'Postos', icone: 'mdi-gas-station', para: '/postos' },
  { titulo: 'Importar', icone: 'mdi-file-upload', para: '/importar' },
  { titulo: 'Histórico', icone: 'mdi-history', para: '/importacoes' },
];

const rota = useRoute();
/** O detalhe (/importacoes/:id) não é rota filha, então a aba é escolhida pelo início do caminho. */
const abaAtiva = computed(() => MENU.find((item) => rota.path.startsWith(item.para))?.para);

onMounted(async () => {
  try {
    await api.get('/health', { silencioso: true });
    statusApi.value = 'online';
  } catch {
    statusApi.value = 'offline';
  }
});
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" flat>
      <template #prepend>
        <v-icon icon="mdi-gas-station" class="ms-2" />
      </template>
      <v-app-bar-title class="font-weight-bold">Postos de Combustível</v-app-bar-title>

      <template #append>
        <v-tooltip :text="INDICADOR[statusApi].texto" location="bottom">
          <template #activator="{ props }">
            <v-icon v-bind="props" icon="mdi-circle" size="12" :color="INDICADOR[statusApi].cor" class="me-4" />
          </template>
        </v-tooltip>
      </template>

      <template #extension>
        <v-tabs :model-value="abaAtiva" color="white" slider-color="secondary" class="px-2">
          <v-tab v-for="item in MENU" :key="item.para" :value="item.para" :to="item.para" :prepend-icon="item.icone">
            {{ item.titulo }}
          </v-tab>
        </v-tabs>
      </template>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>

    <AppNotificacoes />
  </v-app>
</template>
