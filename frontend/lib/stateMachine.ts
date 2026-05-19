export const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAGED'],
  TRIAGED: ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED'],
  WAITING_CUSTOMER: ['IN_PROGRESS'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
}

export function canTransition(current: string, target: string): boolean {
  return (VALID_TRANSITIONS[current] ?? []).includes(target)
}
