<script setup lang="ts">
import type { Posto } from '@/api/tipos';
import CampoDetalhe from '@/components/CampoDetalhe.vue';
import { formatarData, formatarDataHora, mascararCep, mascararCnpj, mascararCpf, STATUS_POSTO } from '@/utils/formatacao';

defineProps<{ posto: Posto | null }>();
const aberto = defineModel<boolean>({ required: true });
</script>

<template>
  <v-dialog v-model="aberto" max-width="760" scrollable>
    <v-card v-if="posto">
      <v-card-item class="pt-5 px-6">
        <template #append>
          <v-btn icon="mdi-close" variant="text" density="comfortable" aria-label="Fechar" @click="aberto = false" />
        </template>
        <v-card-title class="text-wrap font-weight-bold">{{ posto.razaoSocial }}</v-card-title>
        <v-card-subtitle class="d-flex align-center ga-2 mt-1 opacity-100">
          <span v-if="posto.nomeFantasia">{{ posto.nomeFantasia }}</span>
          <v-chip :color="STATUS_POSTO[posto.status].cor" size="small" label variant="tonal">
            {{ STATUS_POSTO[posto.status].texto }}
          </v-chip>
        </v-card-subtitle>
      </v-card-item>

      <v-divider />

      <v-card-text class="px-6 py-5">
        <section>
          <h3 class="text-overline text-primary mb-2">Identificação</h3>
          <v-row dense>
            <v-col cols="12" sm="6"><CampoDetalhe rotulo="CNPJ" :valor="mascararCnpj(posto.cnpj)" /></v-col>
            <v-col cols="12" sm="6"><CampoDetalhe rotulo="Bandeira" :valor="posto.bandeira" /></v-col>
            <v-col cols="12" sm="6">
              <CampoDetalhe rotulo="Data de inauguração" :valor="formatarData(posto.dataInauguracao)" />
            </v-col>
            <v-col cols="12" sm="6">
              <CampoDetalhe rotulo="Atualizado em" :valor="formatarDataHora(posto.atualizadoEm)" />
            </v-col>
          </v-row>
        </section>

        <section class="mt-6">
          <h3 class="text-overline text-primary mb-2">Endereço</h3>
          <v-row dense>
            <v-col cols="12" sm="8">
              <CampoDetalhe rotulo="Logradouro" :valor="[posto.logradouro, posto.numero].filter(Boolean).join(', ')" />
            </v-col>
            <v-col cols="12" sm="4"><CampoDetalhe rotulo="Complemento" :valor="posto.complemento" /></v-col>
            <v-col cols="12" sm="4"><CampoDetalhe rotulo="Bairro" :valor="posto.bairro" /></v-col>
            <v-col cols="12" sm="4">
              <CampoDetalhe rotulo="Município" :valor="`${posto.municipio} / ${posto.uf}`" />
            </v-col>
            <v-col cols="12" sm="4"><CampoDetalhe rotulo="CEP" :valor="mascararCep(posto.cep)" /></v-col>
          </v-row>
        </section>

        <section class="mt-6">
          <h3 class="text-overline text-primary mb-2">Responsável</h3>
          <v-row dense>
            <v-col cols="12" sm="6"><CampoDetalhe rotulo="Nome" :valor="posto.responsavel.nome" /></v-col>
            <v-col cols="12" sm="6"><CampoDetalhe rotulo="CPF" :valor="mascararCpf(posto.responsavel.cpf)" /></v-col>
            <v-col cols="12" sm="6"><CampoDetalhe rotulo="E-mail" :valor="posto.responsavel.email" /></v-col>
            <v-col cols="12" sm="6"><CampoDetalhe rotulo="Cargo" :valor="posto.responsavel.cargo" /></v-col>
          </v-row>
        </section>

        <section class="mt-6">
          <h3 class="text-overline text-primary mb-2">Operação</h3>
          <v-row dense>
            <v-col cols="6" sm="3"><CampoDetalhe rotulo="Bicos" :valor="posto.numeroBicos" /></v-col>
            <v-col cols="6" sm="3"><CampoDetalhe rotulo="Pistas" :valor="posto.numeroPistas" /></v-col>
            <v-col cols="12" sm="6">
              <CampoDetalhe rotulo="Combustíveis">
                <div class="d-flex flex-wrap ga-1 mt-1">
                  <v-chip v-for="nome in posto.combustiveis" :key="nome" size="small" label>{{ nome }}</v-chip>
                </div>
              </CampoDetalhe>
            </v-col>
          </v-row>
        </section>

        <section v-if="posto.observacoes" class="mt-6">
          <h3 class="text-overline text-primary mb-2">Observações</h3>
          <p class="text-body-2 observacoes">{{ posto.observacoes }}</p>
        </section>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.observacoes {
  white-space: pre-line;
}
</style>
