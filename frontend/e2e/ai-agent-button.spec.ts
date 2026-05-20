/**
 * E2E: AI Agent button fills reply textarea with a generated suggestion
 *
 * Uses page.route() to mock backend calls. Does not require real OpenAI credentials.
 *
 * Prerequisites: frontend dev server running on localhost:3000
 * Run: npx playwright test e2e/ai-agent-button.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

const BACKEND = 'http://localhost:8000'

const MOCK_TICKET = {
  ticket_id: 'TKT-AI-001',
  customer_id: 'CUST-002',
  customer_name: 'Beta Inc',
  customer_segment: 'MID',
  plan: 'PRO',
  channel: 'EMAIL',
  subject: 'Billing charge discrepancy',
  body_preview: 'We were charged twice for the same invoice.',
  created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  last_reply_at: null,
  last_reply_by: null,
  reply_count: 0,
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  assigned_to: 'Ana Souza',
  category: 'BILLING',
  previous_open_tickets_for_customer: 0,
  triage_flags: [],
  risk_score: 40,
  close_reason: null,
  merged_into: null,
}

const AI_REPLY = 'Olá! Recebemos sua solicitação e identificamos a cobrança duplicada. Vamos resolver isso em até 24 horas.'

async function setupRoutes(page: Page) {
  await page.route(`${BACKEND}/tickets?**`, async route => {
    const url = route.request().url()
    const isInProgress = url.includes('status=IN_PROGRESS') || url.includes('status=ESCALATED')
    await route.fulfill({ json: isInProgress ? [MOCK_TICKET] : [] })
  })

  await page.route(`${BACKEND}/tickets/${MOCK_TICKET.ticket_id}`, async route => {
    await route.fulfill({ json: MOCK_TICKET })
  })

  await page.route(`${BACKEND}/tickets/${MOCK_TICKET.ticket_id}/audit`, async route => {
    await route.fulfill({ json: [] })
  })

  await page.route(`${BACKEND}/tickets/stats/agents**`, async route => {
    await route.fulfill({ json: [] })
  })

  await page.route(`${BACKEND}/tickets/stats/weekly**`, async route => {
    await route.fulfill({ json: [] })
  })

  await page.route(`${BACKEND}/tickets?sort_by=risk_score**`, async route => {
    await route.fulfill({ json: [] })
  })

  // Mock AI agent endpoint
  await page.route(`${BACKEND}/agent/chat`, async route => {
    const body = JSON.parse(route.request().postData() || '{}')
    // Verify the prompt contains ticket details
    expect(body.message).toContain('Billing charge discrepancy')
    await route.fulfill({
      json: {
        reply: AI_REPLY,
        pending_action: null,
        updated_history: [
          { role: 'user', content: body.message },
          { role: 'assistant', content: AI_REPLY },
        ],
      },
    })
  })
}

test.describe('AI Agent reply button', () => {
  test('fills reply textarea with AI-generated suggestion', async ({ page }) => {
    await setupRoutes(page)
    await page.goto('/inbox')

    // Wait for the kanban to load and find the ticket
    await expect(page.getByText('Billing charge discrepancy')).toBeVisible({ timeout: 10000 })

    // Open ticket side panel
    await page.getByText('Billing charge discrepancy').first().click()

    // Wait for side panel with action buttons
    await expect(page.getByText('Add Reply')).toBeVisible()

    // Click the AI Agent button
    await page.getByTitle(/gerar sugestão/i).click()

    // Wait for the textarea to be filled with the AI reply
    await expect(page.getByPlaceholder('Reply body...')).toHaveValue(AI_REPLY, { timeout: 15000 })
  })

  test('shows loading state while AI is generating', async ({ page }) => {
    // Delay the AI response to observe loading state
    await setupRoutes(page)
    await page.route(`${BACKEND}/agent/chat`, async route => {
      await new Promise(r => setTimeout(r, 500))
      await route.fulfill({
        json: { reply: AI_REPLY, pending_action: null, updated_history: [] },
      })
    })

    await page.goto('/inbox')
    await expect(page.getByText('Billing charge discrepancy')).toBeVisible({ timeout: 10000 })
    await page.getByText('Billing charge discrepancy').first().click()
    await expect(page.getByText('Add Reply')).toBeVisible()

    await page.getByTitle(/gerar sugestão/i).click()

    // Loading text should appear briefly
    await expect(page.getByText('Gerando...')).toBeVisible()

    // Eventually resolves
    await expect(page.getByPlaceholder('Reply body...')).toHaveValue(AI_REPLY, { timeout: 10000 })
  })

  test('prompt sent to AI includes ticket subject, segment and priority', async ({ page }) => {
    const capturedPrompts: string[] = []

    await setupRoutes(page)
    await page.route(`${BACKEND}/agent/chat`, async route => {
      const body = JSON.parse(route.request().postData() || '{}')
      capturedPrompts.push(body.message)
      await route.fulfill({
        json: { reply: AI_REPLY, pending_action: null, updated_history: [] },
      })
    })

    await page.goto('/inbox')
    await expect(page.getByText('Billing charge discrepancy')).toBeVisible({ timeout: 10000 })
    await page.getByText('Billing charge discrepancy').first().click()
    await expect(page.getByText('Add Reply')).toBeVisible()
    await page.getByTitle(/gerar sugestão/i).click()
    await expect(page.getByPlaceholder('Reply body...')).toHaveValue(AI_REPLY, { timeout: 10000 })

    expect(capturedPrompts.length).toBe(1)
    expect(capturedPrompts[0]).toContain('Billing charge discrepancy')
    expect(capturedPrompts[0]).toContain('MID')
    expect(capturedPrompts[0]).toContain('HIGH')
  })
})
