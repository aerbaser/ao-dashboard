import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import FlowStrip from '../../src/components/pipeline/FlowStrip'

describe('FlowStrip — current owner emphasis', () => {
  afterEach(cleanup)

  it('emphasizes the current owner with a ring when owner is last actor', () => {
    render(<FlowStrip actors={['sokrat', 'archimedes']} currentOwner="archimedes" />)
    const avatars = screen.getAllByRole('img')
    // archimedes (last) should have the emphasis ring
    expect(avatars[1].className).toContain('ring-2')
    expect(avatars[1].className).toContain('w-6')
    // sokrat (prior) should NOT have emphasis
    expect(avatars[0].className).not.toContain('ring-2')
    expect(avatars[0].className).toContain('w-5')
  })

  it('emphasizes the current owner even when NOT the last actor', () => {
    render(<FlowStrip actors={['sokrat', 'archimedes', 'leo']} currentOwner="sokrat" />)
    const avatars = screen.getAllByRole('img')
    // sokrat (first) should have emphasis
    expect(avatars[0].className).toContain('ring-2')
    expect(avatars[0].className).toContain('w-6')
    // others should not
    expect(avatars[1].className).not.toContain('ring-2')
    expect(avatars[2].className).not.toContain('ring-2')
  })

  it('shows current owner avatar even when actors[] is empty', () => {
    render(<FlowStrip actors={[]} currentOwner="archimedes" />)
    const avatar = screen.getByRole('img')
    expect(avatar.className).toContain('ring-2')
    expect(avatar.textContent).toContain('⚙️')
  })

  it('shows current owner avatar when actors is undefined', () => {
    // @ts-expect-error testing runtime safety
    render(<FlowStrip actors={null} currentOwner="archimedes" />)
    const avatar = screen.getByRole('img')
    expect(avatar.className).toContain('ring-2')
  })

  it('appends current owner when absent from actors[]', () => {
    render(<FlowStrip actors={['sokrat', 'leo']} currentOwner="archimedes" />)
    const avatars = screen.getAllByRole('img')
    // 3 avatars total: sokrat, leo, + archimedes appended
    expect(avatars.length).toBe(3)
    // archimedes (appended) should be emphasized
    expect(avatars[2].className).toContain('ring-2')
    expect(avatars[2].textContent).toContain('⚙️')
    // prior actors should not be emphasized
    expect(avatars[0].className).not.toContain('ring-2')
    expect(avatars[1].className).not.toContain('ring-2')
  })

  it('emphasizes owner in overflow chain (owner visible)', () => {
    const actors = ['sokrat', 'platon', 'leo', 'aristotle', 'archimedes']
    render(<FlowStrip actors={actors} currentOwner="archimedes" />)
    // All 5 visible (maxVisible=5), archimedes is last
    const avatars = screen.getAllByRole('img')
    expect(avatars[4].className).toContain('ring-2')
    expect(avatars[4].textContent).toContain('⚙️')
  })

  it('keeps owner visible even when overflow would hide it', () => {
    // 7 actors, maxVisible=5 → normally shows first 4 + overflow
    // But archimedes at position 6 is the owner and must remain visible
    const actors = ['sokrat', 'platon', 'leo', 'aristotle', 'herodotus', 'hephaestus', 'archimedes']
    render(<FlowStrip actors={actors} currentOwner="archimedes" />)
    const strip = screen.getByTestId('flow-strip')
    // Owner emoji must be present in the rendered output
    expect(strip.textContent).toContain('⚙️')
    // And it should have emphasis
    const avatars = screen.getAllByRole('img')
    const ownerAvatar = avatars.find(a => a.textContent?.includes('⚙️'))
    expect(ownerAvatar).toBeTruthy()
    expect(ownerAvatar!.className).toContain('ring-2')
  })

  it('normalizes currentOwner "main" to "sokrat"', () => {
    render(<FlowStrip actors={['sokrat', 'archimedes']} currentOwner="main" />)
    const avatars = screen.getAllByRole('img')
    // sokrat should be emphasized (main → sokrat)
    expect(avatars[0].className).toContain('ring-2')
  })

  it('renders without emphasis when no currentOwner is provided', () => {
    render(<FlowStrip actors={['sokrat', 'archimedes']} />)
    const avatars = screen.getAllByRole('img')
    // No avatar should have emphasis ring
    avatars.forEach(avatar => {
      expect(avatar.className).not.toContain('ring-2')
    })
  })

  it('mobile overflow still shows emphasized owner', () => {
    // With 4+ actors, mobile hides actors beyond 3rd
    // Owner should still be visible on mobile via the mobile overflow indicator
    const actors = ['sokrat', 'archimedes', 'leo', 'aristotle']
    render(<FlowStrip actors={actors} currentOwner="aristotle" />)
    const avatars = screen.getAllByRole('img')
    // aristotle (4th) should have emphasis in the DOM
    const ownerAvatar = avatars.find(a => a.textContent?.includes('📚'))
    expect(ownerAvatar).toBeTruthy()
    expect(ownerAvatar!.className).toContain('ring-2')
  })

  it('prior actors are visually subordinate (opacity reduced)', () => {
    render(<FlowStrip actors={['sokrat', 'archimedes']} currentOwner="archimedes" />)
    const avatars = screen.getAllByRole('img')
    // Prior actor (sokrat) should have reduced opacity
    expect(avatars[0].className).toContain('opacity-60')
    // Owner should not have reduced opacity
    expect(avatars[1].className).not.toContain('opacity-60')
  })
})
