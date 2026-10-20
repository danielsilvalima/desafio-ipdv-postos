<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ErroApi } from '@/api/cliente';
import { listarPostos, URL_EXPORTACAO_POSTOS } from '@/api/postos';
import type { CampoOrdenacaoPosto, Posto } from '@/api/tipos';
import PostoDetalhesDialog from '@/components/postos/PostoDetalhesDialog.vue';
import { formatarNumero, mascararCnpj, mascararCpf, plural, STATUS_POSTO } from '@/utils/formatacao';

interface OpcoesTabela {
  page: number;
  itemsPerPage: number;
  sortBy: { key: string; order?: boolean | 'asc' | 'desc' }[];
}

const COMBUSTIVEIS_VISIVEIS = 3;
const ESPERA_BUSCA_MS = 350;

const cabecalhos = [
  { title: 'CNPJ', key: 'cnpj', width: 170 },
  { title: 'Razão social', key: 'razaoSocial', minWidth: 280 },
  { title: 'Bandeira', key: 'bandeira' },
  { title: 'Município', key: 'municipio' },
  { title: 'Responsável', key: 'responsavel', sortable: false, minWidth: 180 },
  { title: 'Combustíveis', key: 'combustiveis', sortable: false, minWidth: 240 },
  { title: 'Status', key: 'status', width: 140 },
] as const;

const postos = ref<Posto[]>([]);
const total = ref(0);
const carregando = ref(false);
const carregou = ref(false);
const erro = ref<string | null>(null);
const porPagina = ref(20);

const busca = ref('');
const buscaAplicada = ref('');
let esperaBusca: ReturnType<typeof setTimeout> | undefined;
watch(busca, (valor) => {
  clearTimeout(esperaBusca);
  esperaBusca = setTimeout(() => (buscaAplicada.value = (valor ?? '').trim()), ESPERA_BUSCA_MS);
});

const ultimasOpcoes = ref<OpcoesTabela | null>(null);
let requisicaoAtual: AbortController | null = null;

async function carregar(opcoes: OpcoesTabela) {
  ultimasOpcoes.value = opcoes;
  requisicaoAtual?.abort();
  const controle = new AbortController();
  requisicaoAtual = controle;

  carregando.value = true;
  erro.value = null;
  const ordenacao = opcoes.sortBy[0];
  try {
    const pagina = await listarPostos(
      {
        pagina: opcoes.page,
        porPagina: opcoes.itemsPerPage,
        busca: buscaAplicada.value || undefined,
        ordenarPor: ordenacao?.key as CampoOrdenacaoPosto | undefined,
        ordem: ordenacao?.order === 'desc' ? 'desc' : 'asc',
      },
      controle.signal,
    );
    postos.value = pagina.itens;
    total.value = pagina.total;
    carregou.value = true;
  } catch (falha) {
    if (controle.signal.aborted) return;
    erro.value = falha instanceof ErroApi ? falha.message : 'Não foi possível carregar os postos.';
  } finally {
    if (requisicaoAtual === controle) carregando.value = false;
  }
}

function tentarNovamente() {
  if (ultimasOpcoes.value) carregar(ultimasOpcoes.value);
}

const baseVazia = computed(
  () => carregou.value && !carregando.value && !erro.value && total.value === 0 && !buscaAplicada.value,
);

const resumo = computed(() => {
  if (!carregou.value) return 'Carregando…';
  return buscaAplicada.value
    ? plural(total.value, 'posto encontrado', 'postos encontrados')
    : plural(total.value, 'posto cadastrado', 'postos cadastrados');
});

const postoSelecionado = ref<Posto | null>(null);
const dialogoAberto = ref(false);
function abrirDetalhes(_evento: unknown, { item }: { item: Posto }) {
  postoSelecionado.value = item;
  dialogoAberto.value = true;
}
</script>

<template>
  <v-container class="py-6" fluid style="max-width: 1440px">
    <div class="d-flex flex-wrap align-center ga-4 mb-5">
      <div class="me-auto">
        <h1 class="text-h5 font-weight-bold">Postos</h1>
        <p class="text-body-2 text-medium-emphasis">
          {{ resumo }}
        </p>
      </div>
      <v-btn
        v-if="!baseVazia"
        :href="URL_EXPORTACAO_POSTOS"
        download
        variant="outlined"
        color="primary"
        prepend-icon="mdi-file-export"
        title="Baixa todos os postos cadastrados no mesmo formato da importação"
      >
        Exportar CSV
      </v-btn>
    </div>

    <v-card v-if="baseVazia" variant="flat" border>
      <v-empty-state
        icon="mdi-gas-station-outline"
        title="Nenhum posto cadastrado ainda"
        text="Importe a planilha de postos em CSV para começar. Depois disso, os postos aparecem aqui."
      >
        <template #actions>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-file-upload" to="/importar">Importar planilha</v-btn>
        </template>
      </v-empty-state>
    </v-card>

    <v-card v-else variant="flat" border>
      <v-card-text class="pb-0">
        <v-text-field
          v-model="busca"
          prepend-inner-icon="mdi-magnify"
          label="Buscar por nome, município, bandeira ou CNPJ"
          variant="outlined"
          density="comfortable"
          clearable
          hide-details
          style="max-width: 480px"
        />
      </v-card-text>

      <v-alert
        v-if="erro"
        type="error"
        variant="tonal"
        class="ma-4"
        title="Não foi possível carregar os postos"
        :text="erro"
      >
        <template #append>
          <v-btn variant="outlined" size="small" @click="tentarNovamente">Tentar novamente</v-btn>
        </template>
      </v-alert>

      <v-data-table-server
        v-model:items-per-page="porPagina"
        :headers="cabecalhos"
        :items="postos"
        :items-length="total"
        :loading="carregando"
        :search="buscaAplicada"
        :items-per-page-options="[10, 20, 50, 100]"
        loading-text="Carregando postos…"
        hover
        class="tabela-postos"
        @update:options="carregar"
        @click:row="abrirDetalhes"
      >
        <template #item.cnpj="{ item }">
          <span class="text-no-wrap">{{ mascararCnpj(item.cnpj) }}</span>
        </template>

        <template #item.razaoSocial="{ item }">
          <div class="py-2">
            <div class="font-weight-medium">{{ item.razaoSocial }}</div>
            <div v-if="item.nomeFantasia" class="text-caption text-medium-emphasis">{{ item.nomeFantasia }}</div>
          </div>
        </template>

        <template #item.municipio="{ item }">
          <span class="text-no-wrap">{{ item.municipio }} / {{ item.uf }}</span>
        </template>

        <template #item.responsavel="{ item }">
          <div class="py-2">
            <div>{{ item.responsavel.nome }}</div>
            <div class="text-caption text-medium-emphasis text-no-wrap">CPF {{ mascararCpf(item.responsavel.cpf) }}</div>
          </div>
        </template>

        <template #item.combustiveis="{ item }">
          <div class="d-flex flex-wrap ga-1 py-2">
            <v-chip v-for="nome in item.combustiveis.slice(0, COMBUSTIVEIS_VISIVEIS)" :key="nome" size="x-small" label>
              {{ nome }}
            </v-chip>
            <v-chip
              v-if="item.combustiveis.length > COMBUSTIVEIS_VISIVEIS"
              size="x-small"
              label
              variant="outlined"
              :title="item.combustiveis.slice(COMBUSTIVEIS_VISIVEIS).join(', ')"
            >
              +{{ formatarNumero(item.combustiveis.length - COMBUSTIVEIS_VISIVEIS) }}
            </v-chip>
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="STATUS_POSTO[item.status].cor" size="small" label variant="tonal">
            {{ STATUS_POSTO[item.status].texto }}
          </v-chip>
        </template>

        <template #no-data>
          <div class="py-8 text-medium-emphasis">
            <template v-if="buscaAplicada">Nenhum posto encontrado para "{{ buscaAplicada }}".</template>
            <template v-else-if="!erro">Nenhum posto cadastrado.</template>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <PostoDetalhesDialog v-model="dialogoAberto" :posto="postoSelecionado" />
  </v-container>
</template>

<style scoped>
.tabela-postos :deep(tbody tr) {
  cursor: pointer;
}
</style>
