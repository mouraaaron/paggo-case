/**
 * E2E: Kanban channel filter and sort
 *
 * Verifies that:
 * 1. Selecting a channel in the filter bar sends channel=EMAIL to the tickets API.
 * 2. Selecting a sort option sends sort_by=created_at to the tickets API.
 *
 * Prerequisites: frontend dev server running on localhost:3000
 * Run: npx playwright test e2e/kanban-filters.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

const BACKEND = 'http://localhost:8000'

async function setupBaseRoutes(page: Page) {
  // Stats endpoints — empty, not under test
  await page.route(`${BACKEND}/tickets/stats/**`, async route => {
    await route.fulfill({ json: [] })
  })
  await page.route(`${BACKEND}/tickets/agents`, async route => {
    await route.fulfill({ json: ['Ana Souza', 'Bruno Lima'] })
  })
}

test.describe('Kanban filters', () => {
  test('channel filter sends channel param to tickets API', async ({ page }) => {
    const capturedUrls: string[] = []

    await setupBaseRoutes(page)
    await page.route(`${BACKEND}/tickets?**`, async route => {
      capturedUrls.push(route.request().url())
      await route.fulfill({ json: [] })
    })

    await page.goto('/inbox')

    // Wait for initial load to finish (first batch of requests)
    await page.waitForLoadState('networkidle')
    capturedUrls.length = 0  // clear initial load URLs

    // Select EMAIL channel in the filter bar
    // The channel select has options: '', 'EMAIL', 'CHAT', 'WHATSAPP', 'PHONE_CALLBACK'
    await page.locator('select').filter({ hasText: 'Canal' }).selectOption('EMAIL')

    // Wait for debounce (300ms) + request
    await page.waitForTimeout(500)

    expect(capturedUrls.some(u => u.includes('channel=EMAIL'))).toBe(true)
  })

  test('sort option sends sort_by=created_at param to tickets API', async ({ page }) => {
    const capturedUrls: string[] = []

    await setupBaseRoutes(page)
    await page.route(`${BACKEND}/tickets?**`, async route => {
      capturedUrls.push(route.request().url())
      await route.fulfill({ json: [] })
    })

    await page.goto('/inbox')

    await page.waitForLoadState('networkidle')
    capturedUrls.length = 0

    // Select "Mais recentes" (sort_by=created_at:desc)
    await page.locator('select').filter({ hasText: 'Risco' }).selectOption('created_at:desc')

    await page.waitForTimeout(500)

    expect(capturedUrls.some(u => u.includes('sort_by=created_at'))).toBe(true)
  })
})
