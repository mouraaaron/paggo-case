import { describe, it, expect } from 'vitest'
import { canTransition, VALID_TRANSITIONS } from '@/lib/stateMachine'

describe('canTransition — existing valid transitions', () => {
  it('allows NEW → TRIAGED', () => expect(canTransition('NEW', 'TRIAGED')).toBe(true))
  it('allows TRIAGED → IN_PROGRESS', () => expect(canTransition('TRIAGED', 'IN_PROGRESS')).toBe(true))
  it('allows IN_PROGRESS → ESCALATED', () => expect(canTransition('IN_PROGRESS', 'ESCALATED')).toBe(true))
  it('allows IN_PROGRESS → WAITING_CUSTOMER', () => expect(canTransition('IN_PROGRESS', 'WAITING_CUSTOMER')).toBe(true))
  it('allows IN_PROGRESS → RESOLVED', () => expect(canTransition('IN_PROGRESS', 'RESOLVED')).toBe(true))
  it('allows RESOLVED → CLOSED', () => expect(canTransition('RESOLVED', 'CLOSED')).toBe(true))
  it('allows RESOLVED → IN_PROGRESS', () => expect(canTransition('RESOLVED', 'IN_PROGRESS')).toBe(true))
  it('allows WAITING_CUSTOMER → IN_PROGRESS', () => expect(canTransition('WAITING_CUSTOMER', 'IN_PROGRESS')).toBe(true))
  it('allows ESCALATED → RESOLVED', () => expect(canTransition('ESCALATED', 'RESOLVED')).toBe(true))
})

describe('canTransition — new REOPENED transitions', () => {
  it('allows RESOLVED → REOPENED', () => expect(canTransition('RESOLVED', 'REOPENED')).toBe(true))
  it('allows CLOSED → REOPENED', () => expect(canTransition('CLOSED', 'REOPENED')).toBe(true))
  it('allows REOPENED → IN_PROGRESS', () => expect(canTransition('REOPENED', 'IN_PROGRESS')).toBe(true))
  it('allows REOPENED → TRIAGED', () => expect(canTransition('REOPENED', 'TRIAGED')).toBe(true))
})

describe('canTransition — blocked transitions', () => {
  it('rejects CLOSED → IN_PROGRESS', () => expect(canTransition('CLOSED', 'IN_PROGRESS')).toBe(false))
  it('rejects REOPENED → CLOSED', () => expect(canTransition('REOPENED', 'CLOSED')).toBe(false))
  it('rejects REOPENED → RESOLVED', () => expect(canTransition('REOPENED', 'RESOLVED')).toBe(false))
  it('rejects NEW → RESOLVED', () => expect(canTransition('NEW', 'RESOLVED')).toBe(false))
  it('rejects unknown status', () => expect(canTransition('UNKNOWN', 'NEW')).toBe(false))
})

describe('VALID_TRANSITIONS completeness', () => {
  it('includes REOPENED as a key', () => {
    expect(VALID_TRANSITIONS['REOPENED']).toBeDefined()
  })
  it('REOPENED has exactly IN_PROGRESS and TRIAGED', () => {
    expect(VALID_TRANSITIONS['REOPENED'].sort()).toEqual(['IN_PROGRESS', 'TRIAGED'])
  })
  it('CLOSED has only REOPENED', () => {
    expect(VALID_TRANSITIONS['CLOSED']).toEqual(['REOPENED'])
  })
})
