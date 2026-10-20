<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Ocorrencia } from '@/api/tipos';

const props = defineProps<{ ocorrencias: Ocorrencia[] }>();

const cabecalhos = [
  { title: 'Linha', key: 'linha', width: 90 },
  { title: 'Coluna', key: 'rotulo', width: 180 },
  { title: 'Valor recebido', key: 'valorRecebido', width: 220 },
  { title: 'Problema', key: 'mensagem', sortable: false },
];

const busca = ref('');
const coluna = ref<string | null>(null);

const colunas = computed(() => [...new Set(props.ocorrencias.map((o) => o.rotulo))].sort((a, b) => a.localeCompare(b)));

const filtradas = computed(() =>
  coluna.value ? props.ocorrencias.filter((o) => o.rotulo === coluna.value) : props.ocorrencias,
);
</script>

<template>
  <div>
    <div class="d-flex flex-wrap ga-3 mb-3">
      <v-text-field
        v-model="busca"
        prepend-inner-icon="mdi-magnify"
        label="Buscar linha, valor ou mensagem"
        variant="outlined"
        density="compact"
        clearable
        hide-details
        style="max-width: 320px"
      />
      <v-select
        v-model="coluna"
        :items="colunas"
        label="Coluna"
        variant="outlined"
        density="compact"
        clearable
        hide-details
        style="max-width: 240px"
      />
    </div>

    <v-data-table
      :headers="cabecalhos"
      :items="filtradas"
      :search="busca ?? ''"
      :sort-by="[{ key: 'linha', order: 'asc' }]"
      :items-per-page="10"
      :items-per-page-options="[10, 25, 50, 100]"
      density="comfortable"
      no-data-text="Nenhuma ocorrência com esse filtro."
    >
      <template #item.valorRecebido="{ item }">
        <code v-if="item.valorRecebido" class="valor text-break">{{ item.valorRecebido }}</code>
        <span v-else class="text-medium-emphasis">(vazio)</span>
      </template>
    </v-data-table>
  </div>
</template>

<style scoped>
.valor {
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.8125rem;
}
</style>
