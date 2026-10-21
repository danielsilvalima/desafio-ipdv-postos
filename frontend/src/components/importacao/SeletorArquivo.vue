<script setup lang="ts">
import { ref } from 'vue';
import { TAMANHO_MAXIMO_MB, validarArquivo, type ProblemaArquivo } from '@/utils/validar-arquivo';

defineProps<{ desabilitado?: boolean }>();
const arquivo = defineModel<File | null>({ default: null });

const entrada = ref<HTMLInputElement | null>(null);
const arrastando = ref(false);
const problema = ref<ProblemaArquivo | null>(null);

function abrirSeletor() {
  entrada.value?.click();
}

/** Arquivo recusado não fica selecionado, então o botão de importar continua desabilitado. */
function selecionar(arquivos: FileList | null | undefined) {
  if (!arquivos?.length) return;
  if (arquivos.length > 1) {
    problema.value = { mensagem: 'Solte um arquivo por vez.', dica: 'Envie primeiro um arquivo e depois o outro.' };
    arquivo.value = null;
    return;
  }
  const escolhido = arquivos[0]!;
  problema.value = validarArquivo(escolhido);
  arquivo.value = problema.value ? null : escolhido;
}

function aoEscolher(evento: Event) {
  const alvo = evento.target as HTMLInputElement;
  selecionar(alvo.files);
  // Permite escolher o mesmo arquivo de novo depois de corrigi-lo.
  alvo.value = '';
}

function aoSoltar(evento: DragEvent) {
  arrastando.value = false;
  selecionar(evento.dataTransfer?.files);
}

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
</script>

<template>
  <div
    class="seletor rounded-lg pa-8 text-center"
    :class="{ 'seletor--ativo': arrastando, 'seletor--desabilitado': desabilitado, 'seletor--erro': problema && !arrastando }"
    role="button"
    tabindex="0"
    aria-label="Selecionar arquivo CSV"
    @click="!desabilitado && abrirSeletor()"
    @keydown.enter.prevent="!desabilitado && abrirSeletor()"
    @keydown.space.prevent="!desabilitado && abrirSeletor()"
    @dragenter.prevent="!desabilitado && (arrastando = true)"
    @dragover.prevent="!desabilitado && (arrastando = true)"
    @dragleave.prevent="arrastando = false"
    @drop.prevent="!desabilitado && aoSoltar($event)"
  >
    <input ref="entrada" type="file" accept=".csv,.txt,text/csv,text/plain" hidden @change="aoEscolher" />

    <template v-if="arquivo">
      <v-icon icon="mdi-file-delimited" size="40" color="primary" class="mb-2" />
      <div class="text-subtitle-1 font-weight-medium text-break">{{ arquivo.name }}</div>
      <div class="text-body-2 text-medium-emphasis">{{ tamanhoLegivel(arquivo.size) }} · clique para trocar o arquivo</div>
    </template>
    <template v-else>
      <v-icon icon="mdi-cloud-upload-outline" size="40" color="primary" class="mb-2" />
      <div class="text-subtitle-1 font-weight-medium">Arraste o arquivo CSV para cá</div>
      <div class="text-body-2 text-medium-emphasis">
        ou clique para escolher no computador (até {{ TAMANHO_MAXIMO_MB }} MB)
      </div>
    </template>
  </div>

  <v-alert
    v-if="problema"
    type="error"
    variant="tonal"
    density="compact"
    class="mt-3"
    :title="problema.mensagem"
    :text="problema.dica"
  />
</template>

<style scoped>
.seletor {
  border: 2px dashed rgba(var(--v-theme-primary), 0.35);
  background: rgba(var(--v-theme-primary), 0.03);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.seletor:hover,
.seletor:focus-visible,
.seletor--ativo {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  outline: none;
}
.seletor--erro {
  border-color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.04);
}
.seletor--desabilitado {
  cursor: default;
  opacity: 0.6;
  pointer-events: none;
}
</style>
