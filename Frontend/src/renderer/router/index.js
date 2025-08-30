import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  {
    path: "/",
    redirect: "/expo",
  },
  {
    path: "/expo",
    name: "Expo",
    component: () => import("../views/Expo.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/expo",
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  next();
});

export default router;
