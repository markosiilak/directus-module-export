import { defineModule } from "@directus/extensions-sdk";

import ModuleComponent from "./module.vue";

export const moduleExport = defineModule({
  id: "module-export",
  name: "Export & import collections",
  icon: "file_download",
  routes: [
    {
      path: "",
      component: ModuleComponent,
    },
  ],
});

export default moduleExport;
