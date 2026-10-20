import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/postos' },
  {
    path: '/postos',
    name: 'postos',
    component: () => import('@/views/PostosView.vue'),
    meta: { titulo: 'Postos' },
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
