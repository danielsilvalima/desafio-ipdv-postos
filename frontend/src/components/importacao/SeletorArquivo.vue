<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ desabilitado?: boolean }>();
const arquivo = defineModel<File | null>({ default: null });

const entrada = ref<HTMLInputElement | null>(null);
const arrastando = ref(false);

function abrirSeletor() {
  entrada.value?.click();
}

function aoEscolher(evento: Event) {
  const alvo = evento.target as HTMLInputElement;
  arquivo.value = alvo.files?.[0] ?? null;
  // Permite escolher o mesmo arquivo de novo depois de corrigi-lo.
  alvo.value = '';
}

function aoSoltar(evento: DragEvent) {
  arrastando.value = false;
  const solto = evento.dataTransfer?.files?.[0];
  if (solto) arquivo.value = solto;
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
    :class="{ 'seletor--ativo': arrastando, 'seletor--desabilitado': desabilitado }"
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
    <input ref="entrada" type="file" accept=".csv,text/csv" hidden @change="aoEscolher" />

    <template v-if="arquivo">
      <v-icon icon="mdi-file-delimited" size="40" color="primary" class="mb-2" />
      <div class="text-subtitle-1 font-weight-medium text-break">{{ arquivo.name }}</div>
      <div class="text-body-2 text-medium-emphasis">{{ tamanhoLegivel(arquivo.size) }} · clique para trocar o arquivo</div>
    </template>
    <template v-else>
      <v-icon icon="mdi-cloud-upload-outline" size="40" color="primary" class="mb-2" />
      <div class="text-subtitle-1 font-weight-medium">Arraste o arquivo CSV para cá</div>
      <div class="text-body-2 text-medium-emphasis">ou clique para escolher no computador (até 20 MB)</div>
    </template>
  </div>
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
.seletor--desabilitado {
  cursor: default;
  opacity: 0.6;
  pointer-events: none;
}
</style>
