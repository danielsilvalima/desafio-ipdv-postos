<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { ErroApi } from '@/api/cliente';
import { importarCsv, URL_MODELO_CSV } from '@/api/importacoes';
import type { DetalhesErroArquivo, RelatorioImportacao as Relatorio } from '@/api/tipos';
import ErroArquivoAlerta from '@/components/importacao/ErroArquivoAlerta.vue';
import RelatorioImportacao from '@/components/importacao/RelatorioImportacao.vue';
import SeletorArquivo from '@/components/importacao/SeletorArquivo.vue';

type Etapa = 'selecao' | 'envio' | 'resultado';

const etapa = ref<Etapa>('selecao');
const arquivo = ref<File | null>(null);
const progressoEnvio = ref(0);
const relatorio = ref<Relatorio | null>(null);
const erroArquivo = ref<{ mensagem: string; detalhes: DetalhesErroArquivo } | null>(null);
const erroGeral = ref<string | null>(null);
const topo = ref<HTMLElement | null>(null);
const areaErro = ref<HTMLElement | null>(null);

const processando = computed(() => etapa.value === 'envio' && progressoEnvio.value >= 100);

async function enviar() {
  if (!arquivo.value) return;
  etapa.value = 'envio';
  progressoEnvio.value = 0;
  erroArquivo.value = null;
  erroGeral.value = null;

  try {
    relatorio.value = await importarCsv(arquivo.value, (percentual) => (progressoEnvio.value = percentual));
    etapa.value = 'resultado';
  } catch (falha) {
    etapa.value = 'selecao';
    if (falha instanceof ErroApi && typeof falha.detalhes.dica === 'string') {
      erroArquivo.value = { mensagem: falha.message, detalhes: falha.detalhes as DetalhesErroArquivo };
    } else {
      erroGeral.value = falha instanceof ErroApi ? falha.message : 'Não foi possível enviar o arquivo.';
    }
    await nextTick();
    areaErro.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function novaImportacao() {
  etapa.value = 'selecao';
  arquivo.value = null;
  relatorio.value = null;
  erroArquivo.value = null;
  erroGeral.value = null;
  await nextTick();
  topo.value?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <v-container class="py-6" style="max-width: 1100px">
    <div ref="topo" class="d-flex flex-wrap align-center ga-4 mb-5">
      <div class="me-auto">
        <h1 class="text-h5 font-weight-bold">Importar planilha</h1>
        <p class="text-body-2 text-medium-emphasis">Envie o CSV de postos. O sistema valida cada linha e mostra o que corrigir.</p>
      </div>
      <v-btn :href="URL_MODELO_CSV" download variant="outlined" color="primary" prepend-icon="mdi-file-download-outline">
        Baixar modelo CSV
      </v-btn>
    </div>

    <template v-if="etapa !== 'resultado'">
      <v-card variant="flat" border class="pa-5">
        <SeletorArquivo v-model="arquivo" :desabilitado="etapa === 'envio'" />

        <div v-if="etapa === 'envio'" class="mt-5">
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span>{{ processando ? 'Validando e salvando os postos…' : 'Enviando arquivo…' }}</span>
            <span v-if="!processando">{{ progressoEnvio }}%</span>
          </div>
          <v-progress-linear
            :model-value="progressoEnvio"
            :indeterminate="processando"
            color="primary"
            height="6"
            rounded
          />
        </div>

        <div class="d-flex flex-wrap align-center ga-3 mt-5">
          <p class="text-body-2 text-medium-emphasis me-auto" style="max-width: 640px">
            Pode importar o arquivo completo ou só as linhas corrigidas. Postos que já existem (mesmo CNPJ) são
            atualizados, não duplicados.
          </p>
          <v-btn
            color="primary"
            variant="flat"
            size="large"
            prepend-icon="mdi-file-upload"
            :disabled="!arquivo"
            :loading="etapa === 'envio'"
            @click="enviar"
          >
            Importar
          </v-btn>
        </div>
      </v-card>

      <div ref="areaErro">
        <ErroArquivoAlerta
          v-if="erroArquivo"
          class="mt-4"
          :mensagem="erroArquivo.mensagem"
          :detalhes="erroArquivo.detalhes"
          mostrar-link-historico
        />

        <v-alert v-if="erroGeral" type="error" variant="tonal" class="mt-4" title="Não foi possível importar" :text="erroGeral" />
      </div>
    </template>

    <template v-else-if="relatorio">
      <RelatorioImportacao :relatorio="relatorio" @importar-corrigido="novaImportacao">
        <template #acoes-cabecalho>
          <v-btn variant="text" prepend-icon="mdi-file-upload" @click="novaImportacao">Importar outro arquivo</v-btn>
          <v-btn to="/postos" variant="text" color="primary" prepend-icon="mdi-gas-station">Ver postos</v-btn>
        </template>
      </RelatorioImportacao>
    </template>
  </v-container>
</template>
