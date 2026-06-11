import { test, expect } from '@playwright/test';
import { waitForSplash, scrollToContactForm, fillContactForm, isImageLoaded } from './helpers/utils.js';

const HOME_PATH = '/';

test.describe('Suite de Estrés Avanzada y Resiliencia del Ecosistema', () => {

  // =========================================================================
  // 1. INUNDACIÓN POR CONCURRENCIA SIMULTÁNEA
  // =========================================================================
  test('CP-015: Estrés de concurrencia masiva e inundación del formulario de contacto', async ({ browser }) => {
    test.setTimeout(90000);
    const usuariosConcurrentes = 5;

    const promesasUsuarios = Array.from({ length: usuariosConcurrentes }).map(async (_, indice) => {
      const contexto = await browser.newContext();
      const page = await contexto.newPage();

      await page.goto(HOME_PATH, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await waitForSplash(page);
      await scrollToContactForm(page);

      await fillContactForm(page, {
        nombre:  `Stress User ${indice}`,
        email:   `stress_user_${indice}@qa.com`,
        mensaje: 'Inyección masiva de tráfico síncrono paralelo para evaluar resiliencia del servidor.',
      });

      const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
      await botonEnviar.click();

      return { page, contexto };
    });

    const sesiones = await Promise.all(promesasUsuarios);

    for (const [indice, { page, contexto }] of sesiones.entries()) {
      const htmlTitle = await page.title();
      expect(htmlTitle, `El servidor se cayó (Error 502) para el usuario concurrente ${indice}`).not.toContain('502');
      expect(htmlTitle, `El backend arrojó error 500 bajo estrés para el usuario ${indice}`).not.toContain('500');
      await contexto.close();
    }
  });

  // =========================================================================
  // 2. CAOS: RESILIENCIA ANTE CAÍDA DE WHATSAPP
  // =========================================================================
  test('CP-016: Simulación de caos - Resiliencia de la UI ante una caída total de la API de WhatsApp', async ({ page }) => {
    test.setTimeout(45000);

    await page.goto(HOME_PATH, { waitUntil: 'domcontentloaded' });

    // Bloqueamos todas las peticiones hacia WhatsApp antes de interactuar
    await page.route('**/*whatsapp.com/**', async (route) => {
      await route.abort('gatewaytimeout');
    });

    await waitForSplash(page);

    const campoNombre = page.getByRole('textbox', { name: 'Tu nombre' });
    await campoNombre.scrollIntoViewIfNeeded();
    await campoNombre.waitFor({ state: 'visible', timeout: 15000 });

    await fillContactForm(page, {
      nombre:  'Test Resiliencia',
      email:   'caos_red@resiliencia.com',
      mensaje: 'Validando que la Landing Page no se rompa si la API de WhatsApp no responde.',
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click({ timeout: 5000 });

    // Si hay alerta de error, debe ser visible; si no, el botón debe seguir activo
    const alertaError = page.locator('div[role="alert"], .error-message, .toast').first();
    if (await alertaError.count() > 0) {
      await expect(alertaError).toBeVisible();
    } else {
      await expect(botonEnviar).toBeEnabled({ timeout: 5000 });
    }
  });

  // =========================================================================
  // 3. LATENCIA EXTREMA DE RED (3G LENTO)
  // =========================================================================
  test('CP-017: Resiliencia bajo degradación crítica de red (3G Lento / Latencia masiva)', async ({ page, context }) => {
    test.setTimeout(60000);

    // Emulamos red 3G lenta vía CDP antes de cargar la página
    const sessionCDP = await context.newCDPSession(page);
    await sessionCDP.send('Network.emulateNetworkConditions', {
      offline:             false,
      downloadThroughput:  (400 * 1024) / 8,   // 400 Kbps
      uploadThroughput:    (128 * 1024) / 8,   // 128 Kbps
      latency:             3000,               // 3 segundos de latencia
    });

    await page.goto(HOME_PATH, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    const clientesHeading = page.getByRole('heading', { name: 'Nuestros Clientes', level: 2 });
    await clientesHeading.waitFor({ state: 'visible', timeout: 20000 });
    await clientesHeading.scrollIntoViewIfNeeded();
    await expect(clientesHeading).toBeVisible();

    // El primer logo de cliente debe cargarse incluso con red degradada
    const clientesSection = page.locator('div, section').filter({ has: clientesHeading });
    const primerLogo = clientesSection.locator('img').filter({ hasAttribute: 'alt' }).first();
    await primerLogo.waitFor({ state: 'visible', timeout: 20000 });
    await expect(primerLogo).toBeVisible();
  });

  // =========================================================================
  // 4. SOAK TESTING: DETECCIÓN DE FUGAS DE MEMORIA
  // =========================================================================
  test('CP-018: Soak Testing - Interacción cíclica prolongada para detección de fugas de memoria', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(HOME_PATH, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await waitForSplash(page);
    await scrollToContactForm(page);

    const iteraciones = 10;
    const tiemposDeRespuesta = [];

    console.log(`\n[Soak Testing] Iniciando ciclo de ${iteraciones} interacciones continuas...`);

    for (let i = 1; i <= iteraciones; i++) {
      const marcaInicio = Date.now();

      await fillContactForm(page, {
        nombre:  `Soak User Pasada ${i}`,
        email:   `soak_test_${i}@qa.com`,
        mensaje: `Ejecutando iteración de resistencia número ${i} para evaluar fugas de memoria.`,
      });

      // Solo limpiamos en las primeras N-1 iteraciones; la última la dejamos para posible envío
      if (i < iteraciones) {
        await page.getByRole('textbox', { name: 'Tu nombre' }).clear();
        await page.getByRole('textbox', { name: 'Correo electrónico' }).clear();
        await page.getByRole('textbox', { name: 'Mensaje' }).clear();
      }

      const duracionCiclo = Date.now() - marcaInicio;
      tiemposDeRespuesta.push(duracionCiclo);
      console.log(`   -> Ciclo ${i} completado en ${duracionCiclo}ms`);

      await page.waitForTimeout(1000);
    }

    const tiempoPromedio = tiemposDeRespuesta.reduce((a, b) => a + b, 0) / tiemposDeRespuesta.length;
    console.log(`[Soak Testing Finished] Tiempo promedio de interacción en UI: ${tiempoPromedio.toFixed(2)}ms\n`);

    const ultimoCiclo = tiemposDeRespuesta[tiemposDeRespuesta.length - 1];
    const margenDegradacion = tiempoPromedio * 2;

    expect(
      ultimoCiclo,
      `Se detectó fatiga o fuga de memoria en la UI. El último ciclo tardó ${ultimoCiclo}ms (límite: ${margenDegradacion.toFixed(0)}ms)`
    ).toBeLessThan(margenDegradacion);
  });

  // =========================================================================
  // 5. NUEVO — MÉTRICAS DE RENDIMIENTO: CARGA DE SECCIÓN BAJO RED 3G
  // =========================================================================
  test('CP-037: Medir tiempo de carga de sección "Nuestros Clientes" bajo red 3G degradada', async ({ page, context }) => {
    test.setTimeout(90000);

    const sessionCDP = await context.newCDPSession(page);
    await sessionCDP.send('Network.emulateNetworkConditions', {
      offline:             false,
      downloadThroughput:  (400 * 1024) / 8,  // 400 Kbps
      uploadThroughput:    (128 * 1024) / 8,  // 128 Kbps
      latency:             800,               // 800ms latencia — 3G lento real
    });

    const tiempoInicio = Date.now();
    await page.goto(HOME_PATH, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitForSplash(page);

    // ASERCIÓN CRÍTICA: La sección debe ser visible incluso bajo 3G degradado
    const clientesHeading = page.getByRole('heading', { name: 'Nuestros Clientes', level: 2 });
    await clientesHeading.waitFor({ state: 'visible', timeout: 40000 });
    await clientesHeading.scrollIntoViewIfNeeded();

    const tiempoHastaSeccion = Date.now() - tiempoInicio;

    // Esperamos carga de la red
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    const tiempoTotal = Date.now() - tiempoInicio;

    // --- Métricas de rendimiento ---
    const clientesSection = page.locator('div, section').filter({ has: clientesHeading });
    const logos = clientesSection.locator('img').filter({ hasAttribute: 'alt' });
    const countLogos = await logos.count();

    let logosCompletos = 0;
    for (let i = 0; i < countLogos; i++) {
      const completo = await logos.nth(i).evaluate((el) => el.complete);
      if (completo) logosCompletos++;
    }

    const porcentajeCargado = countLogos > 0 ? ((logosCompletos / countLogos) * 100).toFixed(1) : '0';

    console.log(`\n[CP-037 Rendimiento 3G]`);
    console.log(`   → Tiempo hasta sección visible : ${tiempoHastaSeccion}ms`);
    console.log(`   → Tiempo total (networkidle)   : ${tiempoTotal}ms`);
    console.log(`   → Logos encontrados            : ${countLogos}`);
    console.log(`   → Logos con descarga completa  : ${logosCompletos} (${porcentajeCargado}%)\n`);

    // Anotamos las métricas en el reporte HTML de Playwright
    test.info().annotations.push({ type: 'Tiempo hasta sección visible', description: `${tiempoHastaSeccion}ms` });
    test.info().annotations.push({ type: 'Tiempo total bajo 3G',         description: `${tiempoTotal}ms` });
    test.info().annotations.push({ type: 'Logos cargados',               description: `${logosCompletos}/${countLogos} (${porcentajeCargado}%)` });

    if (Number(porcentajeCargado) < 100) {
      test.info().annotations.push({
        type: 'HALLAZGO DE RENDIMIENTO',
        description: `Solo el ${porcentajeCargado}% de los logos completaron su descarga bajo 3G en ${tiempoTotal}ms. Considerar optimización con formatos WebP/AVIF o CDN.`,
      });
      console.warn(`[CP-037] ⚠️ HALLAZGO: Solo ${porcentajeCargado}% de logos cargaron bajo 3G. Optimización recomendada.`);
    }

    // ASERCIÓN MÍNIMA: Al menos la sección debe estar visible (no es aceptable que no cargue nada)
    await expect(clientesHeading).toBeVisible();

    // UMBRAL DE ACEPTACIÓN: La sección debe ser visible en menos de 45 segundos bajo 3G
    expect(
      tiempoHastaSeccion,
      `FALLO RENDIMIENTO: La sección "Nuestros Clientes" tardó ${tiempoHastaSeccion}ms en aparecer bajo 3G — supera el umbral de 45s`
    ).toBeLessThan(45000);
  });
});