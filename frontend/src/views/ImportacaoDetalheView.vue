<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ErroApi } from '@/api/cliente';
import { buscarImportacao } from '@/api/importacoes';
import type { RelatorioImportacao as Relatorio } from '@/api/tipos';
import RelatorioImportacao from '@/components/importacao/RelatorioImportacao.vue';

const props = defineProps<{ id: string }>();
const router = useRouter();

const relatorio = ref<Relatorio | null>(null);
const carregando = ref(true);
const erro = ref<{ mensagem: string; naoEncontrada: boolean } | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  relatorio.value = null;
  try {
    relatorio.value = await buscarImportacao(Number(props.id));
  } catch (falha) {
    erro.value = {
      mensagem: falha instanceof ErroApi ? falha.message : 'Não foi possível carregar a importação.',
      naoEncontrada: falha instanceof ErroApi && falha.status === 404,
    };
  } finally {
    carregando.value = false;
  }
}

watch(() => props.id, carregar, { immediate: true });
</script>

<template>
  <v-container class="py-6" style="max-width: 1100px">
    <v-btn to="/importacoes" variant="text" prepend-icon="mdi-arrow-left" class="mb-3 ms-n3">Histórico</v-btn>

    <template v-if="carregando">
      <v-skeleton-loader type="list-item-two-line" class="mb-4" />
      <v-skeleton-loader type="article" />
    </template>

    <v-alert
      v-else-if="erro"
      :type="erro.naoEncontrada ? 'info' : 'error'"
      variant="tonal"
      :title="erro.naoEncontrada ? 'Importação não encontrada' : 'Não foi possível carregar a importação'"
      :text="erro.naoEncontrada ? 'Confira o endereço ou escolha a importação na lista do histórico.' : erro.mensagem"
    >
      <template v-if="!erro.naoEncontrada" #append>
        <v-btn variant="outlined" size="small" @click="carregar">Tentar novamente</v-btn>
      </template>
    </v-alert>

    <RelatorioImportacao v-else-if="relatorio" :relatorio="relatorio" @importar-corrigido="router.push('/importar')" />
  </v-container>
</template>
