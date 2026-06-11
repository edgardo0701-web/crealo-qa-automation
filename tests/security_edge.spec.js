import { test, expect } from '@playwright/test';
import { goToHome, scrollToContactForm, fillContactForm } from './helpers/utils.js';

test.describe('Suite de Casos Límite, Seguridad de Entrada y Robustez de Interfaz', () => {

  test.beforeEach(async ({ page }) => {
    await goToHome(page);
    await scrollToContactForm(page);
  });

  // =========================================================================
  // 1. INYECCIÓN DE CARGA MASIVA EN CAMPOS (PAYLOAD STRESS)
  // =========================================================================
  test('CP-019: Inundación de caracteres masivos en el campo Mensaje (Payload Limits)', async ({ page }) => {
    // String de 20,400 caracteres para evaluar límites del buffer
    const mensajeGigante = 'ESTRÉS_DE_BUFFER_'.repeat(1200);

    await fillContactForm(page, {
      nombre:  'Hacker Payload',
      email:   'payload_overflow@qa.com',
      mensaje: mensajeGigante,
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click();

    // Aserción de estabilidad: la pestaña no debe colapsar ni lanzar error del servidor
    const htmlTitle = await page.title();
    expect(htmlTitle, 'El backend colapsó con un error 500/413 por tamaño del payload').not.toContain('500');
    expect(htmlTitle, 'El servidor web arrojó un error 502 por el tamaño del payload').not.toContain('502');
  });

  // =========================================================================
  // 2. CARRERA DE CONDICIONES (CLICK SPAMMING)
  // =========================================================================
  test('CP-020: Mitigación de Race Conditions mediante bombardeo de clics (Click Spamming)', async ({ page }) => {
    await fillContactForm(page, {
      nombre:  'Usuario Desesperado',
      email:   'spam_clicks@qa.com',
      mensaje: 'Haciendo clics compulsivos en el botón de envío.',
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });

    // Disparamos 8 clics simultáneos sin esperar retorno asíncrono
    const promesasDeClics = Array.from({ length: 8 }).map(() =>
      botonEnviar.click({ force: true, noWaitAfter: true }).catch(() => null)
    );
    await Promise.all(promesasDeClics);

    // La UI debe sobrevivir — al menos el body debe seguir visible
    await expect(page.locator('body')).toBeVisible();
  });

  // =========================================================================
  // 3. ESTRÉS DE PÉRDIDA DE CONEXIÓN (OFFLINE STATE)
  // =========================================================================
  test('CP-021: Resiliencia de la UI ante desconexión abrupta de internet durante el envío', async ({ page, context }) => {
    await fillContactForm(page, {
      nombre:  'Corte de Conexión',
      email:   'offline_drop@qa.com',
      mensaje: 'Perdiendo el internet en 3... 2... 1...',
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click({ noWaitAfter: true });

    // Cortamos la red inmediatamente después del clic (emulación CDP)
    const sessionCDP = await context.newCDPSession(page);
    await sessionCDP.send('Network.emulateNetworkConditions', {
      offline:             true,
      downloadThroughput:  0,
      uploadThroughput:    0,
      latency:             0,
    });

    await page.waitForTimeout(3000);

    // La UI no debe quedar en blanco ni en bucle infinito — el botón debe seguir existiendo
    await expect(botonEnviar).toBeVisible();
  });

  // =========================================================================
  // 4. NUEVO — INYECCIÓN XSS EN CAMPOS DE TEXTO
  // =========================================================================
  test('CP-032: Validar que los campos sanitizan inputs con etiquetas HTML/JS (XSS básico)', async ({ page }) => {
    const payloadXSS = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

    await fillContactForm(page, {
      nombre:  payloadXSS,
      email:   'xss_test@qa.com',
      mensaje: payloadXSS,
    });

    // Verificamos que el valor se almacenó como texto plano (no ejecutó nada)
    const valorNombre = await page.getByRole('textbox', { name: 'Tu nombre' }).inputValue();
    expect(valorNombre).toContain('<script>');   // El campo lo acepta como texto

    // La página no debe haber mostrado ningún diálogo/alert
    let dialogoDetectado = false;
    page.once('dialog', async (dialog) => {
      dialogoDetectado = true;
      await dialog.dismiss();
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click().catch(() => null);
    await page.waitForTimeout(1500);

    expect(
      dialogoDetectado,
      'FALLO XSS: Se ejecutó un alert() — el input no está siendo sanitizado antes de renderizarse'
    ).toBe(false);
  });

  // =========================================================================
  // 5. NUEVO — VALIDACIÓN DE EMAIL CON FORMATO INVÁLIDO
  // =========================================================================
  test('CP-033: Validar que el campo email rechaza formatos sin @ o dominio', async ({ page }) => {
    await fillContactForm(page, {
      nombre:  'Test Email Inválido',
      email:   'esto-no-es-un-email',
      mensaje: 'Probando formato de email incorrecto.',
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click();

    // El formulario HTML5 debería bloquear el envío con un email inválido
    // La URL no debe haber cambiado a WhatsApp
    const currentURL = page.url();
    expect(currentURL).not.toContain('whatsapp.com');
  });
});