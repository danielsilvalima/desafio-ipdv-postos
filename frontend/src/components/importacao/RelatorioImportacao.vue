<script setup lang="ts">
import { computed } from 'vue';
import type { RelatorioImportacao } from '@/api/tipos';
import ErroArquivoAlerta from '@/components/importacao/ErroArquivoAlerta.vue';
import { formatarDataHora, formatarNumero, plural, STATUS_IMPORTACAO } from '@/utils/formatacao';

const props = defineProps<{ relatorio: RelatorioImportacao }>();

const totais = computed(() => props.relatorio.totais);
const importados = computed(() => totais.value.inseridos + totais.value.atualizados);
const status = computed(() => STATUS_IMPORTACAO[props.relatorio.status]);

const tipoAlerta = computed(() => {
  if (totais.value.rejeitados === 0) return 'success';
  return importados.value === 0 ? 'error' : 'warning';
});

const tituloResumo = computed(() => {
  const partes = [
    importados.value === 0
      ? 'Nenhum posto importado'
      : `${plural(importados.value, 'posto importado', 'postos importados')} (${formatarNumero(totais.value.inseridos)} ${totais.value.inseridos === 1 ? 'novo' : 'novos'}, ${formatarNumero(totais.value.atualizados)} ${totais.value.atualizados === 1 ? 'atualizado' : 'atualizados'})`,
  ];
  if (totais.value.rejeitados > 0) {
    partes.push(
      `${plural(totais.value.rejeitados, 'linha precisa', 'linhas precisam')} de correção`,
    );
  }
  return `${partes.join('. ')}.`;
});

const textoResumo = computed(() => {
  if (totais.value.rejeitados === 0) {
    return 'Todas as linhas válidas foram salvas. Postos que já existiam (mesmo CNPJ) foram atualizados, sem duplicar.';
  }
  if (importados.value === 0) {
    return 'Nenhuma linha passou na validação. Veja abaixo o que corrigir, ajuste a planilha e importe de novo.';
  }
  return 'As linhas corretas já foram salvas. Só as linhas com erro ficaram de fora: corrija-as e importe de novo.';
});

const indicadores = computed(() => [
  { rotulo: 'Linhas no arquivo', valor: totais.value.linhas, cor: undefined, icone: 'mdi-table-row' },
  { rotulo: 'Novos', valor: totais.value.inseridos, cor: 'success', icone: 'mdi-plus-circle-outline' },
  { rotulo: 'Atualizados', valor: totais.value.atualizados, cor: 'primary', icone: 'mdi-sync' },
  { rotulo: 'Com erro', valor: totais.value.rejeitados, cor: 'error', icone: 'mdi-alert-circle-outline' },
  { rotulo: 'Avisos', valor: totais.value.avisos, cor: 'warning', icone: 'mdi-information-outline' },
]);

const temNovosCadastros = computed(
  () => props.relatorio.novosCadastros.bandeiras.length + props.relatorio.novosCadastros.combustiveis.length > 0,
);
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div class="d-flex flex-wrap align-center ga-3">
      <v-chip :color="status.cor" :prepend-icon="status.icone" label variant="tonal">{{ status.texto }}</v-chip>
      <div class="me-auto">
        <div class="text-subtitle-1 font-weight-medium text-break">{{ relatorio.nomeArquivo }}</div>
        <div class="text-caption text-medium-emphasis">
          Importação nº {{ relatorio.id }} · {{ formatarDataHora(relatorio.criadaEm) }}
        </div>
      </div>
      <slot name="acoes-cabecalho" />
    </div>

    <ErroArquivoAlerta
      v-if="relatorio.erroArquivo"
      :mensagem="relatorio.erroArquivo.mensagem"
      :detalhes="relatorio.erroArquivo.detalhes"
    />

    <template v-else>
      <v-alert :type="tipoAlerta" variant="tonal" border="start" :title="tituloResumo">
        <p class="mt-1">{{ textoResumo }}</p>
        <p v-if="totais.ignorados > 0" class="mt-2 text-body-2">
          {{ plural(totais.ignorados, 'linha repetida foi ignorada', 'linhas repetidas foram ignoradas') }}: o mesmo
          CNPJ aparece mais de uma vez no arquivo e valeu a última ocorrência.
        </p>
      </v-alert>

      <v-row dense>
        <v-col v-for="indicador in indicadores" :key="indicador.rotulo" cols="6" sm="4" md>
          <v-card variant="flat" border class="pa-3 h-100">
            <div class="d-flex align-center ga-2 text-caption text-medium-emphasis">
              <v-icon :icon="indicador.icone" size="16" :color="indicador.valor > 0 ? indicador.cor : undefined" />
              {{ indicador.rotulo }}
            </div>
            <div class="text-h6 font-weight-bold" :class="indicador.valor > 0 && indicador.cor ? `text-${indicador.cor}` : ''">
              {{ formatarNumero(indicador.valor) }}
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-card v-if="temNovosCadastros" variant="flat" border class="pa-4">
        <div class="text-body-2 font-weight-medium mb-2">Cadastrados automaticamente nesta importação</div>
        <div v-if="relatorio.novosCadastros.bandeiras.length" class="d-flex flex-wrap align-center ga-1 mb-1">
          <span class="text-caption text-medium-emphasis me-1">Bandeiras:</span>
          <v-chip v-for="nome in relatorio.novosCadastros.bandeiras" :key="nome" size="small" label color="primary" variant="tonal">
            {{ nome }}
          </v-chip>
        </div>
        <div v-if="relatorio.novosCadastros.combustiveis.length" class="d-flex flex-wrap align-center ga-1">
          <span class="text-caption text-medium-emphasis me-1">Combustíveis:</span>
          <v-chip
            v-for="nome in relatorio.novosCadastros.combustiveis"
            :key="nome"
            size="small"
            label
            color="primary"
            variant="tonal"
          >
            {{ nome }}
          </v-chip>
        </div>
        <p class="text-caption text-medium-emphasis mt-2">
          Se algum nome estiver escrito errado, corrija na planilha e importe de novo.
        </p>
      </v-card>
    </template>
  </div>
</template>
