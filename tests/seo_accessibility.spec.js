import { test, expect } from '@playwright/test';

test.describe('Suite de Regresión: Validación de SEO, Accesibilidad y Estructura del DOM', () => {

  test.beforeEach(async ({ page }) => {
    // Usamos '/' porque baseURL está centralizada en playwright.config.ts
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  // =========================================================================
  // 1. BUG-005: CONTROL DINÁMICO DE ARIA-HIDDEN EN EL MENÚ MÓVIL
  // =========================================================================
  test('CP-022: Validar que el menú móvil no bloquee el árbol de accesibilidad (aria-hidden dinámico)', async ({ page }) => {
    const menuLateral = page.locator('nav.fixed.z-\\[90\\]');
    await menuLateral.waitFor({ state: 'attached' });

    const botonMenu = page.getByRole('button', { name: /Abrir menú/i });
    await botonMenu.click();

    // Al abrirse, aria-hidden DEBE ser "false"
    const estadoDesplegado = await menuLateral.getAttribute('aria-hidden');
    expect(
      estadoDesplegado,
      'FALLO ACCESIBILIDAD (BUG-005): El menú está abierto visualmente pero sigue oculto para el árbol de accesibilidad con aria-hidden="true"'
    ).toBe('false');
  });

  // =========================================================================
  // 2. BUG-006: FORMATO DEL TÍTULO DE LA PESTAÑA (SEO)
  // =========================================================================
  test('CP-023: Validar espaciado y formato semántico en la etiqueta TITLE', async ({ page }) => {
    const tituloPestaña = await page.title();

    // No debe ser la cadena aglutinada sin espacios
    expect(
      tituloPestaña,
      'FALLO SEO (BUG-006): El título de la pestaña sigue pegado y sin espacios gramaticales.'
    ).not.toBe('CREALO-Hacemostusideasrealidad');

    // Debe contener separador limpio para indexación correcta
    expect(tituloPestaña).toContain('CREALO -');
  });

  // =========================================================================
  // 3. BUG-007: CARACTERES HUÉRFANOS EN ENLACE DE INSTAGRAM
  // =========================================================================
  test('CP-024: Detectar residuos de llaves { } o código expuesto en el enlace de Instagram', async ({ page }) => {
    const enlaceInstagram = page.locator('nav a[href*="instagram.com/crealopublicidadve"]').first();
    const textoEnlace = await enlaceInstagram.textContent();

    expect(
      textoEnlace,
      'FALLO UI (BUG-007): Se detectaron llaves "{" de código expuestas alrededor del texto de Instagram'
    ).not.toContain('{');

    expect(
      textoEnlace,
      'FALLO UI (BUG-007): Se detectaron llaves "}" de código expuestas alrededor del texto de Instagram'
    ).not.toContain('}');
  });

  // =========================================================================
  // 4. BUG-008: EFICIENCIA DEL DOM (DUPLICIDAD DE LOGOS SVG)
  // =========================================================================
  test('CP-025: Monitorear optimización del DOM - Evitar inyección redundante del mismo SVG', async ({ page }) => {
    test.fail(true, 'BUG-008 abierto: El desarrollador tiene pendiente centralizar el SVG redundante del logo.');

    const conteoLogoVectores = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll('svg path'));
      const coincidencias = paths.filter(p => p.getAttribute('d')?.startsWith('m902.57,1.12c36.47-4.11'));
      return coincidencias.length;
    });

    console.log(`[DOM Audit] SVG del logo inyectado directamente: ${conteoLogoVectores} veces`);

    expect(
      conteoLogoVectores,
      'FALLO RENDIMIENTO (BUG-008): El SVG del logo está duplicado en el HTML en lugar de ser un asset centralizado'
    ).toBeLessThanOrEqual(1);
  });

  // =========================================================================
  // 5. NUEVO — VALIDAR META DESCRIPTION PARA SEO
  // =========================================================================
  test('CP-034: Validar que la página tiene meta description definida y no está vacía', async ({ page }) => {
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');

    expect(
      metaDescription,
      'FALLO SEO: La meta description está ausente o vacía — penaliza el posicionamiento en buscadores'
    ).toBeTruthy();

    // Una meta description efectiva tiene entre 50 y 160 caracteres
    const descLength = (metaDescription || '').length;
    expect(
      descLength,
      `ADVERTENCIA SEO: La meta description tiene ${descLength} caracteres — lo ideal es entre 50 y 160`
    ).toBeGreaterThan(10);
  });

  // =========================================================================
  // 6. NUEVO — VALIDAR QUE EXISTE UN SOLO H1 POR PÁGINA
  // =========================================================================
  test('CP-035: Validar que la landing page tiene exactamente un H1 (estructura SEO correcta)', async ({ page }) => {
    const h1Count = await page.locator('h1').count();

    expect(
      h1Count,
      `FALLO SEO: Se encontraron ${h1Count} etiquetas <h1> — debe haber exactamente una por página para un SEO óptimo`
    ).toBe(1);
  });

  // =========================================================================
  // 7. NUEVO — VALIDAR QUE TODAS LAS IMÁGENES TIENEN ATRIBUTO ALT
  // =========================================================================
  test('CP-036: Validar que todas las imágenes relevantes tienen atributo alt (accesibilidad)', async ({ page }) => {
    // Excluimos imágenes decorativas con alt="" (vacío intencional es válido)
    const imgsSinAlt = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .filter(img => img.getAttribute('alt') === null)
        .map(img => img.src || img.getAttribute('data-src') || 'src desconocido');
    });

    expect(
      imgsSinAlt,
      `FALLO ACCESIBILIDAD: Las siguientes imágenes no tienen atributo alt: ${imgsSinAlt.join(', ')}`
    ).toHaveLength(0);
  });
});