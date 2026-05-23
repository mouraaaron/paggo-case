/**
 * E2E: AI auto-suggest classify
 *
 * Verifies that clicking "✦ Sugerir" in the ActionButtons panel
 * calls POST /tickets/{id}/suggest-classify and updates the category
 * and priority dropdowns with the AI response.
 *
 * Prerequisites: frontend dev server running on localhost:3000
 * Run: npx playwright test e2e/suggest-classify.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

const BACKEND = 'http://localhost:8000'

const MOCK_TICKET = {
  ticket_id: 'TKT-SUGGEST-001',
  customer_id: 'CUST-010',
  customer_name: 'Suggest Corp',
  customer_segment: 'ENT',
  plan: 'ENTERPRISE',
  channel: 'EMAIL',
  subject: 'App crashes on login',
  body_preview: 'Every login attempt crashes with a 500 error.',
  created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  last_reply_at: null,
  last_reply_by: null,
  reply_count: 0,
  status: 'NEW',
  priority: 'MEDIUM',
  assigned_to: null,
  category: null,
  previous_open_tickets_for_customer: 0,
  triage_flags: [],
  risk_score: 20,
  close_reason: null,
  merged_into: null,
}

const SUGGEST_RESPONSE = {
  category: 'BUG',
  priority: 'URGENT',
  reasoning: 'App crash on login indicates a critical bug requiring immediate attention',
}

async function setupRoutes(page: Page) {
  // Kanban columns: ticket appears in NEW column only
  await page.route(`${BACKEND}/tickets?**`, async route => {
    const url = route.request().url()
    await route.fulfill({ json: url.includes('status=NEW') ? [MOCK_TICKET] : [] })
  })

  await page.route(`${BACKEND}/tickets/${MOCK_TICKET.ticket_id}`, async route => {
    await route.fulfill({ json: MOCK_TICKET })
  })

  await page.route(`${BACKEND}/tickets/${MOCK_TICKET.ticket_id}/audit`, async route => {
    await route.fulfill({ json: [] })
  })

  await page.route(`${BACKEND}/tickets/agents`, async route => {
    await route.fulfill({ json: [] })
  })

  // Stats endpoints — return empty to avoid unrelated failures
  await page.route(`${BACKEND}/tickets/stats/**`, async route => {
    await route.fulfill({ json: [] })
  })

  // AI suggest endpoint
  await page.route(
    `${BACKEND}/tickets/${MOCK_TICKET.ticket_id}/suggest-classify`,
    async route => {
      await route.fulfill({ json: SUGGEST_RESPONSE })
    }
  )
}

test.describe('AI auto-suggest classify', () => {
  test('Sugerir button updates category and priority dropdowns', async ({ page }) => {
    await setupRoutes(page)
    await page.goto('/inbox')

    // Wait for ticket to appear in kanban
    await expect(page.getByText('App crashes on login')).toBeVisible({ timeout: 10000 })

    // Open side panel
    await page.getByText('App crashes on login').first().click()

    // Click Sugerir button
    await expect(page.getByTitle(/sugerir categoria e prioridade/i)).toBeVisible()
    await page.getByTitle(/sugerir categoria e prioridade/i).click()

    // Priority select (contains URGENT option) should update to URGENT
    await expect(
      page.locator('select').filter({ hasText: 'URGENT' }).first()
    ).toHaveValue('URGENT', { timeout: 10000 })

    // Category select (contains BUG option) should update to BUG
    await expect(
      page.locator('select').filter({ hasText: 'BUG' })
    ).toHaveValue('BUG', { timeout: 10000 })
  })

  test('AI reasoning text appears below the dropdowns after Sugerir', async ({ page }) => {
    await setupRoutes(page)
    await page.goto('/inbox')

    await expect(page.getByText('App crashes on login')).toBeVisible({ timeout: 10000 })
    await page.getByText('App crashes on login').first().click()

    await page.getByTitle(/sugerir categoria e prioridade/i).click()

    await expect(
      page.getByText(/App crash on login indicates a critical bug/)
    ).toBeVisible({ timeout: 10000 })
  })
})
