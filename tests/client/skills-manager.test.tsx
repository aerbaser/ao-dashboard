import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SkillsManager from '../../src/components/agents/SkillsManager'

const mockUpdateAgentSkills = vi.fn()
const mockFetchAllSkills = vi.fn()

vi.mock('../../src/lib/api', () => ({
  updateAgentSkills: (...args: unknown[]) => mockUpdateAgentSkills(...args),
  fetchAllSkills: (...args: unknown[]) => mockFetchAllSkills(...args),
}))

const AGENT_SKILLS = ['github', 'coding-agent', 'tmux']
const ALL_SKILLS = {
  global: [
    { name: 'github', path: '/skills/github/SKILL.md', size: 100, content: '' },
    { name: 'coding-agent', path: '/skills/coding-agent/SKILL.md', size: 200, content: '' },
    { name: 'tmux', path: '/skills/tmux/SKILL.md', size: 50, content: '' },
    { name: 'ontology', path: '/skills/ontology/SKILL.md', size: 80, content: '' },
    { name: 'web-search', path: '/skills/web-search/SKILL.md', size: 90, content: '' },
  ],
}

describe('SkillsManager', () => {
  const onToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAllSkills.mockResolvedValue(ALL_SKILLS)
    mockUpdateAgentSkills.mockResolvedValue({ ok: true, skills: ['github', 'coding-agent'] })
  })

  afterEach(() => { cleanup() })

  it('renders correct toggle state from API', async () => {
    render(<SkillsManager agentId="archimedes" initialSkills={[...AGENT_SKILLS]} onToast={onToast} />)
    await waitFor(() => {
      expect(screen.getByText('github')).toBeTruthy()
    })

    // All 3 agent skills should be checked
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)
    checkboxes.forEach(cb => {
      expect((cb as HTMLInputElement).checked).toBe(true)
    })
  })

  it('batch changes collected until Apply', async () => {
    render(<SkillsManager agentId="archimedes" initialSkills={[...AGENT_SKILLS]} onToast={onToast} />)
    await waitFor(() => {
      expect(screen.getByText('github')).toBeTruthy()
    })

    // Uncheck tmux
    const tmuxCheckbox = screen.getAllByRole('checkbox')[2] // tmux is last alphabetically? No, sorted: coding-agent, github, tmux
    fireEvent.click(tmuxCheckbox)

    // Should show change summary with -tmux
    await waitFor(() => {
      expect(screen.getByText('-tmux')).toBeTruthy()
    })

    // Apply button should be visible
    expect(screen.getByText('Apply')).toBeTruthy()

    // API should NOT have been called yet
    expect(mockUpdateAgentSkills).not.toHaveBeenCalled()
  })

  it('Apply sends PUT and shows confirmation toast', async () => {
    mockUpdateAgentSkills.mockResolvedValue({ ok: true, skills: ['coding-agent', 'github'] })

    render(<SkillsManager agentId="archimedes" initialSkills={[...AGENT_SKILLS]} onToast={onToast} />)
    await waitFor(() => {
      expect(screen.getByText('github')).toBeTruthy()
    })

    // Uncheck tmux
    const checkboxes = screen.getAllByRole('checkbox')
    // Skills are sorted: coding-agent, github, tmux
    fireEvent.click(checkboxes[2]) // tmux

    // Click Apply
    await waitFor(() => {
      expect(screen.getByText('Apply')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Apply'))

    await waitFor(() => {
      expect(mockUpdateAgentSkills).toHaveBeenCalledWith(
        'archimedes',
        expect.arrayContaining(['coding-agent', 'github']),
      )
    })

    expect(onToast).toHaveBeenCalledWith({
      message: 'Skills updated. Restart required.',
      variant: 'success',
    })
  })

  it('Add Skill dropdown shows unassigned skills', async () => {
    render(<SkillsManager agentId="archimedes" initialSkills={[...AGENT_SKILLS]} onToast={onToast} />)
    await waitFor(() => {
      expect(screen.getByText('github')).toBeTruthy()
    })

    // Click Add Skill button
    fireEvent.click(screen.getByText('Add Skill'))

    // Should show unassigned skills: ontology, web-search
    await waitFor(() => {
      expect(screen.getByText('ontology')).toBeTruthy()
      expect(screen.getByText('web-search')).toBeTruthy()
    })

    // Select ontology
    fireEvent.click(screen.getByText('ontology'))

    // Now ontology should appear as a checkbox in the grid
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(4)
    })

    // Should show +ontology in changes
    expect(screen.getByText('+ontology')).toBeTruthy()
  })
})
