<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppNotificacoes from '@/components/AppNotificacoes.vue';

const MENU = [
  { titulo: 'Postos', icone: 'mdi-gas-station', para: '/postos' },
  { titulo: 'Importar', icone: 'mdi-file-upload', para: '/importar' },
  { titulo: 'Histórico', icone: 'mdi-history', para: '/importacoes' },
];

const rota = useRoute();
/** O detalhe (/importacoes/:id) não é rota filha, então a aba é escolhida pelo início do caminho. */
const abaAtiva = computed(() => MENU.find((item) => rota.path.startsWith(item.para))?.para);
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" flat>
      <template #prepend>
        <v-icon icon="mdi-gas-station" class="ms-2" />
      </template>
      <v-app-bar-title class="font-weight-bold">Postos de Combustível</v-app-bar-title>

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
