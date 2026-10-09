// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-loader')).toBeHidden();
});

test('crear una lista, agregar tareas y completarlas persiste tras recargar', async ({ page }) => {
    await page.getByLabel('Nombre de la nueva lista').fill('Mudanza');
    await page.getByRole('button', { name: 'Crear lista' }).click();

    const card = page.locator('.list-card', { hasText: 'Mudanza' });
    await expect(card).toBeVisible();

    const composer = card.getByPlaceholder('Añadir una tarea…');
    await composer.fill('Embalar libros');
    await composer.press('Enter');
    await composer.fill('Cancelar internet');
    await composer.press('Enter');
    await expect(card.locator('.task-item')).toHaveCount(2);

    await card.locator('.task-item', { hasText: 'Embalar libros' })
        .getByRole('button', { name: 'Marcar como realizada' }).click();

    await expect(card.locator('.column[data-status="Realizada"] .task-item')).toHaveCount(1);
    await expect(card.locator('.list-card__count')).toHaveText('1/2');
    await expect(page.locator('[data-stat="progress"]')).toHaveText('50');

    await page.reload();
    const reloaded = page.locator('.list-card', { hasText: 'Mudanza' });
    await expect(reloaded.locator('.column[data-status="Realizada"] .task-item')).toHaveText(/Embalar libros/);
});

test('las plantillas con variables reemplazan los valores', async ({ page }) => {
    await page.locator('.template__use', { hasText: 'Sesión Fotográfica' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Cliente').fill('Lucía Ferreyra');
    await dialog.getByLabel('Fecha').fill('2026-11-20');
    await dialog.getByRole('button', { name: 'Crear lista' }).click();

    const card = page.locator('.list-card', { hasText: 'Sesión Fotográfica - Lucía Ferreyra' });
    await expect(card).toBeVisible();
    await expect(card.locator('.task-item')).toHaveCount(4);
    await expect(card).toContainText('Enviar presupuesto a Lucía Ferreyra');
});

test('borrar una lista se puede deshacer', async ({ page }) => {
    await page.getByLabel('Nombre de la nueva lista').fill('Temporal');
    await page.getByLabel('Nombre de la nueva lista').press('Enter');
    const card = page.locator('.list-card', { hasText: 'Temporal' });
    await card.getByRole('button', { name: 'Eliminar lista' }).click();
    await expect(card).toHaveCount(0);

    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.locator('.list-card', { hasText: 'Temporal' })).toBeVisible();
});

test('funciona sin conexión: carga, permite editar y conserva los cambios', async ({ page, context }) => {
    // Espera a que el service worker controle la página.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Lo que importa/ })).toBeVisible();

    await page.getByLabel('Nombre de la nueva lista').fill('Sin red');
    await page.getByLabel('Nombre de la nueva lista').press('Enter');
    await expect(page.locator('.list-card', { hasText: 'Sin red' })).toBeVisible();

    await page.reload();
    await expect(page.locator('.list-card', { hasText: 'Sin red' })).toBeVisible();
    await context.setOffline(false);
});

test('sin errores de JavaScript al cargar', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.reload();
    await expect(page.locator('#app-loader')).toBeHidden();
    expect(errors).toEqual([]);
});
