import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import FlowStrip from '../../src/components/pipeline/FlowStrip'

describe('FlowStrip', () => {
  afterEach(cleanup)

  it('renders correct actors from event data', () => {
    render(<FlowStrip actors={['sokrat', 'archimedes', 'leo']} />)
    const strip = screen.getByTestId('flow-strip')
    expect(strip).toBeInTheDocument()
    // Check emojis are rendered
    expect(strip.textContent).toContain('🦉')
    expect(strip.textContent).toContain('⚙️')
    expect(strip.textContent).toContain('🎨')
    // Check arrows between actors
    expect(strip.querySelectorAll('[aria-hidden="true"]').length).toBe(2)
  })

  it('normalizes "main" to sokrat', () => {
    render(<FlowStrip actors={['main']} />)
    const avatar = screen.getByRole('img')
    expect(avatar).toHaveAttribute('title', 'Сократ — Orchestrator')
    expect(avatar.textContent).toContain('🦉')
  })

  it('normalizes "brainstorm" to brainstorm-claude', () => {
    render(<FlowStrip actors={['brainstorm']} />)
    const avatar = screen.getByRole('img')
    expect(avatar).toHaveAttribute('title', 'Brainstorm Claude — Brainstorm (Claude)')
  })

  it('shows tooltip with agent name and role', () => {
    render(<FlowStrip actors={['archimedes']} />)
    const avatar = screen.getByRole('img')
    expect(avatar).toHaveAttribute('title', 'Архимед — Engineer')
    expect(avatar).toHaveAttribute('aria-label', 'Архимед — Engineer')
  })

  it('shows unknown emoji for unrecognized actors', () => {
    render(<FlowStrip actors={['mysterious-agent']} />)
    const avatar = screen.getByRole('img')
    expect(avatar.textContent).toContain('👤')
    expect(avatar).toHaveAttribute('title', 'mysterious-agent')
  })

  it('shows overflow +N when more than 5 actors', () => {
    const actors = ['sokrat', 'archimedes', 'platon', 'leo', 'aristotle', 'herodotus', 'hephaestus']
    render(<FlowStrip actors={actors} />)
    const strip = screen.getByTestId('flow-strip')
    // 4 visible avatars + 1 overflow indicator = showing +3
    expect(strip.textContent).toContain('+3')
    // Should show exactly 4 agent emojis (maxVisible-1 = 4)
    const avatars = screen.getAllByRole('img')
    expect(avatars.length).toBe(4)
  })

  it('shows all avatars when exactly at max (no desktop overflow)', () => {
    const actors = ['sokrat', 'archimedes', 'platon', 'leo', 'aristotle']
    render(<FlowStrip actors={actors} />)
    const avatars = screen.getAllByRole('img')
    expect(avatars.length).toBe(5)
    // No desktop overflow indicator (the +N with font-mono that's not hidden)
    // Mobile overflow (+2) is present in DOM but hidden via CSS max-sm:
    const strip = screen.getByTestId('flow-strip')
    const overflowSpans = strip.querySelectorAll('.font-mono')
    // Only the mobile overflow span should exist (hidden via CSS), not a desktop one
    expect(overflowSpans.length).toBe(1)
    expect(overflowSpans[0].classList.contains('hidden')).toBe(true)
  })

  it('respects custom maxVisible', () => {
    const actors = ['sokrat', 'archimedes', 'platon', 'leo']
    render(<FlowStrip actors={actors} maxVisible={3} />)
    const avatars = screen.getAllByRole('img')
    expect(avatars.length).toBe(2) // maxVisible-1 = 2
    const strip = screen.getByTestId('flow-strip')
    expect(strip.textContent).toContain('+2')
  })

  it('renders nothing for empty actors array', () => {
    const { container } = render(<FlowStrip actors={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when actors is undefined-like', () => {
    // @ts-expect-error testing runtime safety
    const { container } = render(<FlowStrip actors={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('includes code-review-gate agent', () => {
    render(<FlowStrip actors={['code-review-gate']} />)
    const avatar = screen.getByRole('img')
    expect(avatar.textContent).toContain('🛡️')
    expect(avatar).toHaveAttribute('title', 'Code Review Gate — Code Review')
  })

  it('preserves chronological order', () => {
    render(<FlowStrip actors={['leo', 'sokrat', 'archimedes']} />)
    const avatars = screen.getAllByRole('img')
    expect(avatars[0].textContent).toContain('🎨') // leo first
    expect(avatars[1].textContent).toContain('🦉') // sokrat second
    expect(avatars[2].textContent).toContain('⚙️') // archimedes third
  })
})
