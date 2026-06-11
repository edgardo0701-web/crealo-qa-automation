import { defineConfig, devices } from '@playwright/test';

/**
 * URL base centralizada. Se puede sobreescribir con la variable de entorno BASE_URL
 * para apuntar a staging o desarrollo local sin tocar ningún spec.
 * Ejemplo: BASE_URL=http://localhost:3000 npx playwright test
 */
const BASE_URL = process.env.BASE_URL ?? 'https://crealowebpage-production.up.railway.app';

export default defineConfig({
  testDir: './tests',

  /* Ejecutar todos los tests en paralelo por defecto */
  fullyParallel: true,

  /* Falla el build en CI si alguien deja un test.only accidentalmente */
  forbidOnly: !!process.env.CI,

  /* Reintentos: 2 en CI, 1 en local para detectar flakiness */
  retries: process.env.CI ? 2 : 1,

  /* Workers: 1 en CI para no sobrecargar el agente, auto en local */
  workers: process.env.CI ? 1 : undefined,

  /* Timeout global por test (puede sobreescribirse con test.setTimeout) */
  timeout: 60000,

  /* ---------------------------------------------------------------
   * REPORTES: lista en consola + HTML + JSON exportable
   * En CI el HTML no se abre automáticamente
   * --------------------------------------------------------------- */
  reporter: [
    ['list'],
    ['html', { open: process.env.CI ? 'never' : 'on-failure', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  /* ---------------------------------------------------------------
   * OPCIONES GLOBALES para todos los proyectos
   * --------------------------------------------------------------- */
  use: {
    /* URL base centralizada — los specs usan page.goto('/') */
    baseURL: BASE_URL,

    /* Evidencias automáticas al fallar */
    screenshot:  'only-on-failure',
    video:       'retain-on-failure',
    trace:       'retain-on-failure',

    /* Timeouts de acción y navegación (se heredan en todos los proyectos) */
    actionTimeout:     15000,
    navigationTimeout: 45000,
  },

  /* ---------------------------------------------------------------
   * PROYECTOS: Escritorio + Móvil iOS + Móvil Android
   * --------------------------------------------------------------- */
  projects: [
    // --- Entornos de Escritorio ---
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // --- Entornos Móviles (iOS) ---
    {
      name: 'Mobile-iPhone',
      use: { ...devices['iPhone 14'] },
    },

    // --- Entornos Móviles (Android / Chromium Mobile) ---
    {
      name: 'Mobile-Android-Galaxy',
      use: { ...devices['Galaxy S22 Ultra'] },
    },
    {
      name: 'Mobile-Android-Pixel',
      use: { ...devices['Pixel 7'] },
    },
  ],
});