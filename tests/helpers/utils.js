import { expect } from '@playwright/test';

// ============================================================
// HELPER GLOBAL: SPLASH SCREEN
// ============================================================

/**
 * Espera a que el Splash Screen de arranque desaparezca del DOM.
 * Solución al POINTER INTERCEPTION causado por el overlay de carga.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForSplash(page) {
  const splashLoader = page.locator('div.fixed.inset-0.z-\\[9999\\]');
  if (await splashLoader.count() > 0) {
    await splashLoader
      .waitFor({ state: 'detached', timeout: 15000 })
      .catch(() => null);
  }
}

// ============================================================
// HELPER GLOBAL: NAVEGACIÓN
// ============================================================

/**
 * Navega a la raíz de la landing page (usa baseURL del config) y
 * espera automáticamente a que el splash desaparezca.
 * @param {import('@playwright/test').Page} page
 */
export async function goToHome(page) {
  await page.goto('/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await waitForSplash(page);
}

// ============================================================
// HELPER GLOBAL: FORMULARIO DE CONTACTO
// ============================================================

/**
 * Hace scroll hasta el formulario de contacto en el footer.
 * @param {import('@playwright/test').Page} page
 */
export async function scrollToContactForm(page) {
  const contenedor = page.locator('#footer, form').first();
  await contenedor.scrollIntoViewIfNeeded();
}

/**
 * Rellena todos los campos del formulario de contacto.
 * @param {import('@playwright/test').Page} page
 * @param {{ nombre: string, email: string, mensaje: string }} datos
 */
export async function fillContactForm(page, { nombre, email, mensaje }) {
  await page.getByRole('textbox', { name: 'Tu nombre' }).fill(nombre);
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email);
  await page.getByRole('textbox', { name: 'Mensaje' }).fill(mensaje);
}

// ============================================================
// HELPER GLOBAL: VERIFICACIÓN DE IMÁGENES
// ============================================================

/**
 * Verifica que un elemento <img> se haya cargado correctamente
 * comprobando complete y naturalWidth > 0.
 * @param {import('@playwright/test').Locator} imgLocator
 * @returns {Promise<boolean>}
 */
export async function isImageLoaded(imgLocator) {
  return imgLocator.evaluate(async (el) => {
    try {
      if (el.complete && el.naturalWidth > 0) return true;
      const decoded = el.decode().then(() => el.naturalWidth > 0);
      const timeout = new Promise((res) => setTimeout(() => res(el.naturalWidth > 0), 1500));
      return await Promise.race([decoded, timeout]);
    } catch {
      return false;
    }
  });
}
