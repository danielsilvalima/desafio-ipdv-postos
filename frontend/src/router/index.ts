import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/postos' },
  {
    path: '/postos',
    name: 'postos',
    component: () => import('@/views/PostosView.vue'),
    meta: { titulo: 'Postos' },
  },
  {
    path: '/importar',
    name: 'importar',
    component: () => import('@/views/ImportarView.vue'),
    meta: { titulo: 'Importar planilha' },
  },
  {
    path: '/importacoes',
    name: 'historico',
    component: () => import('@/views/HistoricoView.vue'),
    meta: { titulo: 'Histórico de importações' },
  },
  {
    path: '/importacoes/:id(\\d+)',
    name: 'importacao',
    component: () => import('@/views/ImportacaoDetalheView.vue'),
    props: true,
    meta: { titulo: 'Importação' },
  },
  { path: '/:caminho(.*)*', redirect: '/postos' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.afterEach((rota) => {
  const titulo = rota.meta.titulo as string | undefined;
  document.title = titulo ? `${titulo} · Postos de Combustível` : 'Postos de Combustível';
});
