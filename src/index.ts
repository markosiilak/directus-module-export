import { defineModule } from '@directus/extensions-sdk'

import ModuleComponent from './module.vue'

export default defineModule({
  id: 'module-export',
  name: 'Export & import collections',
  icon: 'file_download',
  routes: [
    {
      path: '',
      component: ModuleComponent,
    },
  ],
})

