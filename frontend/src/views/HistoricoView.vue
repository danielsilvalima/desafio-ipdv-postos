<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ErroApi } from '@/api/cliente';
import { listarImportacoes, urlArquivoCorrecao } from '@/api/importacoes';
import type { ImportacaoResumo } from '@/api/tipos';
import { formatarDataHora, formatarNumero, plural, STATUS_IMPORTACAO } from '@/utils/formatacao';

interface OpcoesTabela {
  page: number;
  itemsPerPage: number;
}

const router = useRouter();

const cabecalhos = [
  { title: 'Data', key: 'criadaEm', sortable: false, width: 140 },
  { title: 'Arquivo', key: 'nomeArquivo', sortable: false, minWidth: 220 },
  { title: 'Status', key: 'status', sortable: false, width: 150 },
  { title: 'Linhas', key: 'totalLinhas', sortable: false, align: 'end' },
  { title: 'Novos', key: 'inseridos', sortable: false, align: 'end' },
  { title: 'Atualizados', key: 'atualizados', sortable: false, align: 'end' },
  { title: 'Com erro', key: 'rejeitados', sortable: false, align: 'end' },
  { title: 'Avisos', key: 'totalAvisos', sortable: false, align: 'end' },
  { title: '', key: 'acoes', sortable: false, width: 64, align: 'end' },
] as const;

const importacoes = ref<ImportacaoResumo[]>([]);
const total = ref(0);
const carregando = ref(false);
const carregou = ref(false);
const erro = ref<string | null>(null);
const porPagina = ref(20);

const ultimasOpcoes = ref<OpcoesTabela | null>(null);
let requisicaoAtual: AbortController | null = null;

async function carregar(opcoes: OpcoesTabela) {
  ultimasOpcoes.value = opcoes;
  requisicaoAtual?.abort();
  const controle = new AbortController();
  requisicaoAtual = controle;

  carregando.value = true;
  erro.value = null;
  try {
    const pagina = await listarImportacoes(opcoes.page, opcoes.itemsPerPage, controle.signal);
    importacoes.value = pagina.itens;
    total.value = pagina.total;
    carregou.value = true;
  } catch (falha) {
    if (controle.signal.aborted) return;
    erro.value = falha instanceof ErroApi ? falha.message : 'Não foi possível carregar o histórico.';
  } finally {
    if (requisicaoAtual === controle) carregando.value = false;
  }
}

function tentarNovamente() {
  if (ultimasOpcoes.value) carregar(ultimasOpcoes.value);
}

const semImportacoes = computed(() => carregou.value && !carregando.value && !erro.value && total.value === 0);

const resumo = computed(() =>
  carregou.value ? plural(total.value, 'importação registrada', 'importações registradas') : 'Carregando…',
);

function abrir(_evento: unknown, { item }: { item: ImportacaoResumo }) {
  router.push(`/importacoes/${item.id}`);
}

function classeNumero(valor: number, cor: string): string {
  return valor > 0 ? `text-${cor} font-weight-medium` : 'text-medium-emphasis';
}
</script>

<template>
  <v-container class="py-6" fluid style="max-width: 1440px">
    <div class="d-flex flex-wrap align-center ga-4 mb-5">
      <div class="me-auto">
        <h1 class="text-h5 font-weight-bold">Histórico de importações</h1>
        <p class="text-body-2 text-medium-emphasis">{{ resumo }}</p>
      </div>
      <v-btn to="/importar" color="primary" variant="flat" prepend-icon="mdi-file-upload">Nova importação</v-btn>
    </div>

    <v-card v-if="semImportacoes" variant="flat" border>
      <v-empty-state
        icon="mdi-history"
        title="Nenhuma importação ainda"
        text="Cada planilha importada fica registrada aqui, com o resultado e as linhas que precisaram de correção."
      >
        <template #actions>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-file-upload" to="/importar">Importar planilha</v-btn>
        </template>
      </v-empty-state>
    </v-card>

    <v-card v-else variant="flat" border>
      <v-alert
        v-if="erro"
        type="error"
        variant="tonal"
        class="ma-4"
        title="Não foi possível carregar o histórico"
        :text="erro"
      >
        <template #append>
          <v-btn variant="outlined" size="small" @click="tentarNovamente">Tentar novamente</v-btn>
        </template>
      </v-alert>

      <v-data-table-server
        v-model:items-per-page="porPagina"
        :headers="cabecalhos"
        :items="importacoes"
        :items-length="total"
        :loading="carregando"
        :items-per-page-options="[10, 20, 50, 100]"
        loading-text="Carregando histórico…"
        no-data-text="Nenhuma importação encontrada."
        hover
        class="tabela-historico"
        @update:options="carregar"
        @click:row="abrir"
      >
        <template #item.criadaEm="{ item }">
          <span class="text-no-wrap">{{ formatarDataHora(item.criadaEm) }}</span>
        </template>

        <template #item.nomeArquivo="{ item }">
          <div class="py-2">
            <div class="font-weight-medium text-break">{{ item.nomeArquivo }}</div>
            <div v-if="item.erroArquivo" class="text-caption text-error duas-linhas" :title="item.erroArquivo.mensagem">
              {{ item.erroArquivo.mensagem }}
            </div>
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="STATUS_IMPORTACAO[item.status].cor"
            :prepend-icon="STATUS_IMPORTACAO[item.status].icone"
            size="small"
            label
            variant="tonal"
          >
            {{ STATUS_IMPORTACAO[item.status].texto }}
          </v-chip>
        </template>

        <template #item.totalLinhas="{ item }">{{ formatarNumero(item.totalLinhas) }}</template>
        <template #item.inseridos="{ item }">
          <span :class="classeNumero(item.inseridos, 'success')">{{ formatarNumero(item.inseridos) }}</span>
        </template>
        <template #item.atualizados="{ item }">
          <span :class="classeNumero(item.atualizados, 'primary')">{{ formatarNumero(item.atualizados) }}</span>
        </template>
        <template #item.rejeitados="{ item }">
          <span :class="classeNumero(item.rejeitados, 'error')">{{ formatarNumero(item.rejeitados) }}</span>
        </template>
        <template #item.totalAvisos="{ item }">
          <span :class="classeNumero(item.totalAvisos, 'warning')">{{ formatarNumero(item.totalAvisos) }}</span>
        </template>

        <template #item.acoes="{ item }">
          <v-tooltip v-if="item.rejeitados > 0" text="Baixar linhas com erro para corrigir" location="start">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :href="urlArquivoCorrecao(item.id)"
                download
                icon="mdi-file-download"
                size="small"
                variant="text"
                color="primary"
                aria-label="Baixar linhas com erro"
                @click.stop
              />
            </template>
          </v-tooltip>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<style scoped>
.tabela-historico :deep(tbody tr) {
  cursor: pointer;
}
.tabela-historico :deep(th) {
  white-space: nowrap;
}
.duas-linhas {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
