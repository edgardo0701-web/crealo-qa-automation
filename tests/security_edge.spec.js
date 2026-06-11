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

  // =========================================================================
  // 6. VERIFICACIÓN DE CABECERAS DE SEGURIDAD (SECURITY HEADERS)
  // =========================================================================
  test('CP-038: Verificar presencia de cabeceras de seguridad críticas', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response.headers();

    // Cabeceras recomendadas por OWASP
    const securityHeaders = [
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security'
    ];

    securityHeaders.forEach(header => {
      if (!headers[header]) {
        console.warn(`[SECURITY WARNING]: La cabecera ${header} no está presente.`);
      }
    });

    // Al menos X-Frame-Options es crítica para evitar Clickjacking
    expect(headers['x-frame-options'] || headers['content-security-policy'], 
      'FALLO SEGURIDAD: El sitio es vulnerable a Clickjacking (falta X-Frame-Options o CSP)').toBeTruthy();
  });

  // =========================================================================
  // 7. INTENTO DE INYECCIÓN SQL (SQLi) BÁSICO
  // =========================================================================
  test('CP-039: Validar resiliencia ante payloads de SQL Injection en el formulario', async ({ page }) => {
    const sqlPayload = "' OR '1'='1' --";

    await fillContactForm(page, {
      nombre:  sqlPayload,
      email:   'sqli_test@qa.com',
      mensaje: 'DROP TABLE users;--',
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click();

    // El sistema no debe mostrar errores de base de datos expuestos (ej. "syntax error near...")
    const bodyText = await page.innerText('body');
    const dbErrors = [/sql/i, /mysql/i, /postgresql/i, /driver/i, /syntax error/i];
    
    dbErrors.forEach(errorPattern => {
      expect(bodyText).not.toMatch(errorPattern);
    });
  });

  // =========================================================================
  // 8. PRUEBA DE RATE LIMITING (DETECCIÓN DE SPAM/DOS)
  // =========================================================================
  test('CP-040: Validar si el backend implementa Rate Limiting ante envíos masivos', async ({ page }) => {
    await fillContactForm(page, {
      nombre:  'Spam Bot',
      email:   'bot@spam.com',
      mensaje: 'Intento de spam automatizado.',
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });

    // Intentamos enviar 5 veces muy rápido (si el backend es una API, debería retornar 429)
    for (let i = 0; i < 5; i++) {
      await botonEnviar.click({ force: true }).catch(() => null);
      await page.waitForTimeout(200); 
    }

    // Si el sitio implementa rate limiting correctamente, eventualmente no debería navegar a WhatsApp
    // o debería mostrar un mensaje de "Intente más tarde".
    const currentURL = page.url();
    test.info().annotations.push({ type: 'Observación', description: 'Si el rate limit es laxo, esta prueba navegará siempre.' });
  });

  // =========================================================================
  // 9. BÚSQUEDA DE ARCHIVOS SENSIBLES (SENSITIVE FILES EXPOSURE)
  // =========================================================================
  test('CP-041: Verificar que archivos de configuración sensibles no están expuestos', async ({ request }) => {
    const filesToCheck = [
      '/.env',
      '/.git/config',
      '/package.json',
      '/docker-compose.yml',
      '/.gitignore'
    ];

    for (const file of filesToCheck) {
      const response = await request.get(file);
      // Un servidor seguro debería retornar 404 (Not Found) o 403 (Forbidden)
      expect(response.status(), `ALERTA SEGURIDAD: El archivo ${file} es accesible públicamente (Status ${response.status()})`).not.toBe(200);
    }
  });

  // =========================================================================
  // 10. XSS AVANZADO (EVENT HANDLERS Y SVG INJECTION)
  // =========================================================================
  test('CP-042: Probar resiliencia ante inyecciones XSS avanzadas (Evasión de filtros)', async ({ page }) => {
    const payloads = [
      '<svg/onload=alert(1)>',
      '<img src=x onerror=prompt(1)>',
      '<details open ontoggle=confirm(1)>'
    ];

    let securityBreach = false;
    page.on('dialog', async (dialog) => {
      securityBreach = true;
      await dialog.dismiss();
    });

    for (const payload of payloads) {
      await fillContactForm(page, {
        nombre:  'XSS Adv',
        email:   'adv@security.test',
        mensaje: payload,
      });
      
      const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
      await botonEnviar.click().catch(() => null);
      // Espera corta para permitir que cualquier script inyectado se ejecute
      await page.waitForTimeout(500); 
    }

    expect(securityBreach, 'FALLO SEGURIDAD: Un payload de XSS avanzado logró ejecutar código en el navegador').toBe(false);
  });

  // =========================================================================
  // 11. INTEGRIDAD DE REDES SOCIALES (BROKEN LINK HIJACKING)
  // =========================================================================
  test('CP-043: Verificar que los enlaces a redes sociales no estén rotos (Prevención de Hijacking)', async ({ page, request }) => {
    const linksRedes = page.locator('footer a[href*="instagram.com"], footer a[href*="facebook.com"]');
    const count = await linksRedes.count();

    for (let i = 0; i < count; i++) {
      const url = await linksRedes.nth(i).getAttribute('href');
      if (url) {
        const response = await request.get(url);
        // Si el perfil no existe (404), un atacante podría registrar el nombre de usuario y suplantar a la empresa.
        expect(response.status(), `FALLO INTEGRIDAD: El enlace social ${url} devuelve un error ${response.status()}`).toBeLessThan(400);
      }
    }
  });

  // =========================================================================
  // 12. INTENTO DE INYECCIÓN NOSQL (NOSQL INJECTION)
  // =========================================================================
  test('CP-044: Validar que el formulario no procesa operadores NoSQL maliciosos', async ({ page }) => {
    const nosqlPayload = '{"$gt": ""}';

    await fillContactForm(page, {
      nombre:  'NoSQL Hunter',
      email:   'nosql@test.com',
      mensaje: nosqlPayload,
    });

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click();

    // El sistema debe tratar el JSON como un string literal, no como objeto de consulta.
    const bodyText = await page.innerText('body');
    const noSqlErrorKeywords = [/object object/i, /mongodb/i, /cursor/i];
    
    noSqlErrorKeywords.forEach(pattern => {
      expect(bodyText).not.toMatch(pattern);
    });
  });
});