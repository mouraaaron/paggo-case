/**
 * E2E: State machine — REOPENED transitions
 *
 * Uses page.route() to intercept backend calls deterministically.
 * Prerequisites: frontend dev server running on localhost:3000
 * Run: npx playwright test e2e/state-machine.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

const BACKEND = 'http://localhost:8000'

const BASE_TICKET = {
  ticket_id: 'TKT-SM-001',
  customer_id: 'CUST-SM-001',
  customer_name: 'Acme Corp',
  customer_segment: 'ENT',
  plan: 'ENTERPRISE',
  channel: 'EMAIL',
  subject: 'Dashboard inacessível',
  body_preview: 'Nosso time não consegue acessar o painel.',
  created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  last_reply_at: null,
  last_reply_by: null,
  reply_count: 0,
  priority: 'HIGH',
  assigned_to: null,
  category: null,
  previous_open_tickets_for_customer: 0,
  triage_flags: [],
  risk_score: 40,
  close_reason: null,
  merged_into: null,
}

async function setupRoutes(page: Page, ticket: typeof BASE_TICKET & { status: string }) {
  // Kanban columns: return our ticket only in its current status column
  await page.route(`${BACKEND}/tickets?**`, async route => {
    const url = route.request().url()
    const isMatch = url.includes(`status=${ticket.status}`)
    await route.fulfill({ json: isMatch ? [ticket] : [] })
  })

  // Single ticket GET (side panel refresh)
  await page.route(`${BACKEND}/tickets/${ticket.ticket_id}`, async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: ticket })
    } else {
      await route.continue()
    }
  })

  // Audit log
  await page.route(`${BACKEND}/tickets/${ticket.ticket_id}/audit`, async route => {
    await route.fulfill({ json: [] })
  })

  // Stats endpoints — return minimal data
  await page.route(`${BACKEND}/tickets/stats/**`, async route => {
    await route.fulfill({ json: [] })
  })
}

test.describe('State machine — REOPENED transitions via status panel', () => {
  test('RESOLVED ticket can be transitioned to REOPENED', async ({ page }) => {
    const ticket = { ...BASE_TICKET, status: 'RESOLVED' }
    await setupRoutes(page, ticket)

    // Mock the status update to succeed and return REOPENED ticket
    await page.route(`${BACKEND}/tickets/${ticket.ticket_id}/status`, async route => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      await route.fulfill({ json: { ...ticket, status: body.new_status } })
    })

    await page.goto('/inbox')
    await expect(page.getByText('Dashboard inacessível')).toBeVisible({ timeout: 10000 })

    // Open the side panel
    await page.getByText('Dashboard inacessível').first().click()
    await expect(page.getByText('Change Status')).toBeVisible()

    // Select REOPENED
    await page.selectOption('select:near(:text("Change Status"))', 'REOPENED')

    // Click Update
    await page.getByRole('button', { name: 'Update' }).click()

    // Button should become re-enabled (not stuck loading) — means no error
    await expect(page.getByRole('button', { name: 'Update' })).toBeEnabled({ timeout: 5000 })
  })

  test('CLOSED ticket cannot go directly to IN_PROGRESS — shows error', async ({ page }) => {
    const ticket = { ...BASE_TICKET, ticket_id: 'TKT-SM-002', status: 'CLOSED' }
    await setupRoutes(page, ticket)

    // Mock status update to return 422 for CLOSED → IN_PROGRESS
    await page.route(`${BACKEND}/tickets/${ticket.ticket_id}/status`, async route => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: "Cannot transition from 'CLOSED' to 'IN_PROGRESS'. Allowed transitions from 'CLOSED': ['REOPENED']",
        }),
      })
    })

    await page.goto('/inbox')
    await expect(page.getByText('Dashboard inacessível')).toBeVisible({ timeout: 10000 })

    // Open side panel
    await page.getByText('Dashboard inacessível').first().click()
    await expect(page.getByText('Change Status')).toBeVisible()

    // Select IN_PROGRESS (not allowed from CLOSED)
    await page.selectOption('select:near(:text("Change Status"))', 'IN_PROGRESS')
    await page.getByRole('button', { name: 'Update' }).click()

    // Error message should appear
    await expect(page.getByText(/Cannot transition|Erro/i)).toBeVisible({ timeout: 5000 })
  })

  test('CLOSED ticket can be moved to REOPENED', async ({ page }) => {
    const ticket = { ...BASE_TICKET, ticket_id: 'TKT-SM-003', status: 'CLOSED' }
    await setupRoutes(page, ticket)

    await page.route(`${BACKEND}/tickets/${ticket.ticket_id}/status`, async route => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      await route.fulfill({ json: { ...ticket, status: body.new_status } })
    })

    await page.goto('/inbox')
    await expect(page.getByText('Dashboard inacessível')).toBeVisible({ timeout: 10000 })

    await page.getByText('Dashboard inacessível').first().click()
    await expect(page.getByText('Change Status')).toBeVisible()

    await page.selectOption('select:near(:text("Change Status"))', 'REOPENED')
    await page.getByRole('button', { name: 'Update' }).click()

    await expect(page.getByRole('button', { name: 'Update' })).toBeEnabled({ timeout: 5000 })
  })
})
