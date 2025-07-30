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

export const domainOptions = [
  { text: 'Select a domain', value: 'none' },
  { text: 'admin.siilak.com', value: 'https://admin.siilak.com' },
  { text: 'www.siilak.com', value: 'https://www.siilak.com' },
  { text: 'localhost:9055', value: 'http://localhost:9055' },
]
