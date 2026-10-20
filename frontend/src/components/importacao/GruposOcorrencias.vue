<script setup lang="ts">
import { ref } from 'vue';
import type { GrupoOcorrencias } from '@/api/tipos';
import { formatarNumero, plural } from '@/utils/formatacao';

defineProps<{ grupos: GrupoOcorrencias[]; tipo: 'erro' | 'aviso' }>();

const LINHAS_VISIVEIS = 30;
const expandidos = ref(new Set<string>());

function chave(grupo: GrupoOcorrencias): string {
  return `${grupo.codigo}|${grupo.campo}|${grupo.dica ?? ''}`;
}

function linhasVisiveis(grupo: GrupoOcorrencias): number[] {
  return expandidos.value.has(chave(grupo)) ? grupo.linhas : grupo.linhas.slice(0, LINHAS_VISIVEIS);
}

function alternar(grupo: GrupoOcorrencias) {
  const k = chave(grupo);
  const novo = new Set(expandidos.value);
  if (novo.has(k)) novo.delete(k);
  else novo.add(k);
  expandidos.value = novo;
}
</script>

<template>
  <v-expansion-panels variant="accordion" multiple>
    <v-expansion-panel v-for="grupo in grupos" :key="chave(grupo)" elevation="0" class="border">
      <v-expansion-panel-title>
        <div class="d-flex align-center ga-3 flex-grow-1 me-2">
          <v-icon
            :icon="tipo === 'erro' ? 'mdi-alert-circle-outline' : 'mdi-information-outline'"
            :color="tipo === 'erro' ? 'error' : 'warning'"
          />
          <div class="flex-grow-1">
            <div class="font-weight-medium">{{ grupo.titulo }}</div>
            <div class="text-caption text-medium-emphasis">Coluna {{ grupo.rotulo }} ({{ grupo.campo }})</div>
          </div>
          <v-chip :color="tipo === 'erro' ? 'error' : 'warning'" size="small" label variant="tonal" class="flex-shrink-0">
            {{ plural(grupo.linhas.length, 'linha', 'linhas') }}
          </v-chip>
        </div>
      </v-expansion-panel-title>

      <v-expansion-panel-text>
        <p v-if="grupo.dica" class="mb-3">
          <v-icon icon="mdi-lightbulb-on-outline" size="18" color="secondary" class="me-1" />
          <span class="font-weight-medium">Como corrigir:</span> {{ grupo.dica }}
        </p>
        <div class="text-body-2 text-medium-emphasis mb-1">Linhas na planilha (o cabeçalho é a linha 1):</div>
        <div class="d-flex flex-wrap ga-1">
          <v-chip v-for="linha in linhasVisiveis(grupo)" :key="linha" size="x-small" label variant="outlined">
            {{ linha }}
          </v-chip>
          <v-btn
            v-if="grupo.linhas.length > LINHAS_VISIVEIS"
            size="x-small"
            variant="text"
            color="primary"
            @click="alternar(grupo)"
          >
            {{
              expandidos.has(chave(grupo))
                ? 'Mostrar menos'
                : `e mais ${formatarNumero(grupo.linhas.length - LINHAS_VISIVEIS)}`
            }}
          </v-btn>
        </div>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>
