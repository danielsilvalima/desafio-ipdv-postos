import { ref } from 'vue';

export interface Notificacao {
  text: string;
  color: 'error' | 'success' | 'info' | 'warning';
  timeout?: number;
}

/** Fila global de mensagens, exibida pelo `AppNotificacoes` no layout. */
const fila = ref<Notificacao[]>([]);

export function useNotificacoes() {
  return {
    fila,
    notificar: (notificacao: Notificacao) => {
      fila.value.push(notificacao);
    },
  };
}
