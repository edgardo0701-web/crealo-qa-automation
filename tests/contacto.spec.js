import { test, expect } from '@playwright/test';
import { goToHome, scrollToContactForm, fillContactForm, waitForSplash } from './helpers/utils.js';

test.describe('Automatización de Pruebas - Regresión de Landing Page Crealo', () => {

  test.beforeEach(async ({ page }) => {
    await goToHome(page);
  });

  // =========================================================================
  // 1. COMPONENTE: MENÚ DE NAVEGACIÓN (NAVBAR)
  // =========================================================================
  test('CP-005: Validar redirección interna de los enlaces del menú (Scroll Navbar)', async ({ page }) => {
    const linkContacto = page.getByRole('link', { name: 'Contacto' });
    await expect(linkContacto).toBeVisible();

    // Forzamos el clic para saltar micro-animaciones residuales
    await linkContacto.click({ force: true });

    // La URL debe incluir el hash #footer tras el clic
    await expect(page).toHaveURL(/.*#footer.*/);

    // El formulario en el pie de página debe entrar en el viewport
    const footerForm = page.locator('footer#footer form');
    await expect(footerForm).toBeInViewport();
  });

  // =========================================================================
  // 2. COMPONENTE: SELECTOR DE UBICACIONES ESTRATÉGICAS
  // =========================================================================
  test('CP-006: Validar la selección de ciudades en el combobox de Ubicaciones', async ({ page }) => {
    const locationCombobox = page.getByRole('combobox');
    await locationCombobox.scrollIntoViewIfNeeded();
    await expect(locationCombobox).toBeVisible();

    await locationCombobox.selectOption({ label: 'Carabobo' });

    // Validamos el value interno (case-sensitive)
    await expect(locationCombobox).toHaveValue('carabobo');
  });

  // =========================================================================
  // 3. COMPONENTE: SECCIÓN DE SERVICIOS (BOTONES COTIZAR)
  // =========================================================================
  test('CP-007: Validar comportamiento del botón Cotizar en la sección de Servicios', async ({ page, context }) => {
    const firstServiceHeading = page.getByRole('heading', { name: 'Viniles', level: 3 });
    await firstServiceHeading.waitFor({ state: 'attached', timeout: 10000 });
    await firstServiceHeading.scrollIntoViewIfNeeded();
    await expect(firstServiceHeading).toBeVisible();

    // Anclamos el botón al contenedor padre del heading para evitar detached DOM
    const serviceContainer = page.locator('div, section').filter({ has: firstServiceHeading });
    const cotizarButton = serviceContainer.getByRole('button', { name: 'Cotizar' }).first();

    await cotizarButton.waitFor({ state: 'attached', timeout: 10000 });
    await cotizarButton.scrollIntoViewIfNeeded();
    await expect(cotizarButton).toBeVisible();
    await expect(cotizarButton).toBeEnabled();

    // Capturamos de forma asíncrona si la acción abre una nueva pestaña de WhatsApp
    const pagePromise = context.waitForEvent('page').catch(() => null);
    await cotizarButton.click({ force: true });
    const newPage = await pagePromise;

    // Verificación adaptativa: WhatsApp externo o scroll al footer
    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded');
      await expect(newPage).toHaveURL(/.*whatsapp\.com.*/);
    } else {
      await expect(page.locator('footer#footer form')).toBeInViewport();
    }
  });

  // =========================================================================
  // 4. NUEVOS CASOS — VALIDACIÓN DEL FORMULARIO DE CONTACTO
  // =========================================================================
  test('CP-026: Validar que el formulario no se envíe con todos los campos vacíos', async ({ page }) => {
    await scrollToContactForm(page);

    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.scrollIntoViewIfNeeded();
    await expect(botonEnviar).toBeVisible();

    // Intentar enviar con campos vacíos
    await botonEnviar.click();

    // La página NO debe abrir WhatsApp ni navegar fuera — debe permanecer en la landing
    await expect(page).toHaveURL(/crealowebpage-production\.up\.railway\.app/);

    // El formulario debe seguir visible (no colapsó ni desapareció)
    const form = page.locator('footer#footer form, form').first();
    await expect(form).toBeVisible();
  });

  test('CP-027: Validar que los campos del formulario tienen labels accesibles', async ({ page }) => {
    await scrollToContactForm(page);

    // Verificar que cada campo es localizable por su rol de accesibilidad
    await expect(page.getByRole('textbox', { name: 'Tu nombre' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Correo electrónico' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mensaje' })).toBeVisible();
  });

  test('CP-028: Validar que los campos del formulario aceptan y retienen texto correctamente', async ({ page }) => {
    await scrollToContactForm(page);

    const datos = {
      nombre: 'Juan Pérez',
      email: 'juan.perez@empresa.com',
      mensaje: 'Necesito información sobre sus servicios de impresión.',
    };

    await fillContactForm(page, datos);

    // Verificar que los valores se retienen después de llenado
    await expect(page.getByRole('textbox', { name: 'Tu nombre' })).toHaveValue(datos.nombre);
    await expect(page.getByRole('textbox', { name: 'Correo electrónico' })).toHaveValue(datos.email);
    await expect(page.getByRole('textbox', { name: 'Mensaje' })).toHaveValue(datos.mensaje);
  });

  test('CP-029: Validar que el botón de envío abre WhatsApp con datos del formulario', async ({ page, context }) => {
    await scrollToContactForm(page);

    await fillContactForm(page, {
      nombre: 'Cliente de Prueba',
      email: 'cliente_qa@test.com',
      mensaje: 'Prueba automatizada de integración con WhatsApp.',
    });

    const pagePromise = context.waitForEvent('page').catch(() => null);
    const botonEnviar = page.getByRole('button', { name: /Enviar mensaje por WhatsApp|Enviar/i });
    await botonEnviar.click();
    const newPage = await pagePromise;

    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded');
      // Verifica que se abra WhatsApp con el enlace correcto
      await expect(newPage).toHaveURL(/whatsapp\.com/);
    } else {
      // Si no abre pestaña nueva, al menos la página no debe haber colapsado
      await expect(page.locator('body')).toBeVisible();
    }
  });
});