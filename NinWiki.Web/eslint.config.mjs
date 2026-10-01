// Configuração moderna do ESLint usada pelo Next.js 16. Mantemos as regras
// recomendadas do framework e ignoramos somente arquivos gerados.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);