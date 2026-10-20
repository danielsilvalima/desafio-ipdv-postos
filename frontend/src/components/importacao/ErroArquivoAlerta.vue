<script setup lang="ts">
import { computed } from 'vue';
import { URL_MODELO_CSV } from '@/api/importacoes';
import type { DetalhesErroArquivo } from '@/api/tipos';

const props = defineProps<{
  mensagem: string;
  detalhes: DetalhesErroArquivo;
  /** Na tela de importação, leva ao registro da falha no histórico. */
  mostrarLinkHistorico?: boolean;
}>();

const colunasNaoReconhecidas = computed(() => {
  const { cabecalhoEsperado, cabecalhoRecebido } = props.detalhes;
  if (!cabecalhoEsperado || !cabecalhoRecebido) return [];
  const esperadas = new Set(cabecalhoEsperado);
  return cabecalhoRecebido.filter((coluna) => coluna && !esperadas.has(coluna));
});
</script>

<template>
  <v-alert type="error" variant="tonal" border="start" title="O arquivo não pôde ser importado">
    <p class="mt-1 font-weight-medium">{{ mensagem }}</p>
    <p v-if="detalhes.dica" class="mt-2">
      <v-icon icon="mdi-lightbulb-on-outline" size="18" class="me-1" />
      {{ detalhes.dica }}
    </p>

    <div v-if="detalhes.colunasAusentes?.length" class="mt-4">
      <div class="text-body-2 font-weight-medium mb-1">Colunas obrigatórias que faltam:</div>
      <div class="d-flex flex-wrap ga-1">
        <v-chip v-for="coluna in detalhes.colunasAusentes" :key="coluna" color="error" size="small" label>
          {{ coluna }}
        </v-chip>
      </div>
    </div>

    <div v-if="colunasNaoReconhecidas.length" class="mt-3">
      <div class="text-body-2 font-weight-medium mb-1">
        Colunas do arquivo que o sistema não reconhece (confira se não é erro de digitação):
      </div>
      <div class="d-flex flex-wrap ga-1">
        <v-chip v-for="coluna in colunasNaoReconhecidas" :key="coluna" color="warning" size="small" label>
          {{ coluna }}
        </v-chip>
      </div>
    </div>

    <div v-if="detalhes.colunasRepetidas?.length" class="mt-4">
      <div class="text-body-2 font-weight-medium mb-1">Colunas repetidas:</div>
      <div class="d-flex flex-wrap ga-1">
        <v-chip v-for="coluna in detalhes.colunasRepetidas" :key="coluna" color="error" size="small" label>
          {{ coluna }}
        </v-chip>
      </div>
    </div>

    <p v-if="detalhes.linha" class="mt-3 text-body-2">Problema encontrado perto da linha {{ detalhes.linha }} da planilha.</p>

    <div class="d-flex flex-wrap ga-2 mt-4">
      <v-btn :href="URL_MODELO_CSV" download size="small" variant="outlined" prepend-icon="mdi-file-download-outline">
        Baixar modelo CSV
      </v-btn>
      <v-btn
        v-if="mostrarLinkHistorico && detalhes.importacaoId"
        :to="`/importacoes/${detalhes.importacaoId}`"
        size="small"
        variant="text"
        prepend-icon="mdi-history"
      >
        Ver no histórico
      </v-btn>
    </div>
  </v-alert>
</template>
