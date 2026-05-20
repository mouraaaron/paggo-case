/**
 * E2E: Assign ticket → agent balancing table updates
 *
 * Uses page.route() to intercept backend calls so the test is deterministic
 * and does not depend on real database contents.
 *
 * Prerequisites: frontend dev server running on localhost:3000
 * Run: npx playwright test e2e/assign-agent.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

const BACKEND = 'http://localhost:8000'

const MOCK_TICKET = {
  ticket_id: 'TKT-E2E-001',
  customer_id: 'CUST-001',
  customer_name: 'Acme Corp',
  customer_segment: 'ENT',
  plan: 'ENTERPRISE',
  channel: 'EMAIL',
  subject: 'Cannot access dashboard',
  body_preview: 'Our team cannot access the analytics dashboard since this morning.',
  created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  last_reply_at: null,
  last_reply_by: null,
  reply_count: 0,
  status: 'NEW',
  priority: 'URGENT',
  assigned_to: null,
  category: null,
  previous_open_tickets_for_customer: 0,
  triage_flags: ['ENT_NO_REPLY_2H'],
  risk_score: 70,
  close_reason: null,
  merged_into: null,
}

async function setupRoutes(page: Page, assignedTo: string | null = null) {
  const updatedTicket = { ...MOCK_TICKET, assigned_to: assignedTo }

  // Kanban columns: all statuses return our one ticket (in NEW column) or empty
  await page.route(`${BACKEND}/tickets?**`, async route => {
    const url = route.request().url()
    const isNew = url.includes('status=NEW')
    await route.fulfill({ json: isNew ? [MOCK_TICKET] : [] })
  })

  // Assign endpoint
  await page.route(`${BACKEND}/tickets/${MOCK_TICKET.ticket_id}/assign`, async route => {
    await route.fulfill({ json: updatedTicket })
  })

  // Single ticket fetch (used after assign to refresh side panel)
  await page.route(`${BACKEND}/tickets/${MOCK_TICKET.ticket_id}`, async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: updatedTicket })
    } else {
      await route.continue()
    }
  })

  // Audit log endpoint
  await page.route(`${BACKEND}/tickets/${MOCK_TICKET.ticket_id}/audit`, async route => {
    await route.fulfill({ json: [] })
  })

  // Stats endpoints — agent balancing reflects assignment
  const agentStats = assignedTo
    ? [{ agent: assignedTo, urgent: 1, high: 0, medium: 0, low: 0, total: 1 }]
    : []

  await page.route(`${BACKEND}/tickets/stats/agents**`, async route => {
    await route.fulfill({ json: agentStats })
  })

  await page.route(`${BACKEND}/tickets/stats/weekly**`, async route => {
    await route.fulfill({ json: [{ week: '2024-W02', total: 1, urgent: 1 }] })
  })

  // Alert sidebar (tickets with risk_score >= 70)
  await page.route(`${BACKEND}/tickets?sort_by=risk_score**`, async route => {
    await route.fulfill({ json: [MOCK_TICKET] })
  })
}

test.describe('Assign ticket → agent balancing', () => {
  test('agent appears in balancing table after assigning ticket', async ({ page }) => {
    await setupRoutes(page, null)
    await page.goto('/inbox')

    // Wait for kanban to load and see our ticket card
    await expect(page.getByText('Cannot access dashboard')).toBeVisible({ timeout: 10000 })

    // Click the ticket card to open the side panel
    await page.getByText('Cannot access dashboard').first().click()

    // Wait for side panel to open
    await expect(page.getByText('Atribuir Agente')).toBeVisible()

    // Select an agent
    await page.selectOption('select:near(:text("Atribuir Agente"))', 'Ana Souza')

    // Reconfigure routes so next agent stats call returns Ana Souza
    await page.route(`${BACKEND}/tickets/stats/agents**`, async route => {
      await route.fulfill({
        json: [{ agent: 'Ana Souza', urgent: 1, high: 0, medium: 0, low: 0, total: 1 }],
      })
    })

    // Click the Atribuir button
    await page.getByRole('button', { name: 'Atribuir' }).click()

    // Agent balancing table should update and show Ana Souza
    await expect(page.getByText('Ana Souza')).toBeVisible({ timeout: 10000 })
  })

  test('ticket card shows in urgent alerts sidebar when risk_score >= 70', async ({ page }) => {
    await setupRoutes(page, null)
    await page.goto('/inbox')

    // Wait for alerts sidebar
    await expect(page.getByText(/Alertas/)).toBeVisible({ timeout: 10000 })

    // Our ticket should appear as an alert (risk_score = 70)
    await expect(page.getByText('Cannot access dashboard').first()).toBeVisible()
  })
})
