// @vitest-environment node
/**
 * Tests for service status dual-mode detection (#149).
 * Verifies that readServiceStatus tries both user and system scopes
 * so services deployed as system services are not falsely reported inactive.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock child_process before importing the module
const mockExecFile = vi.fn()
vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}))

// Mock fs/promises for forbidden-services.json
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    appendFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  }
})

describe('service status dual-mode detection', () => {
  beforeEach(() => {
    mockExecFile.mockReset()
  })

  it('detects system service as active when user scope returns inactive', async () => {
    // Simulate: --user show returns inactive, system show returns active
    mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: Function) => {
      const isUserScope = args.includes('--user')
      if (args.includes('show')) {
        if (isUserScope) {
          cb(null, 'ActiveState=inactive\nSubState=dead\n', '')
        } else {
          cb(null, 'ActiveState=active\nSubState=running\nMemoryCurrent=134217728\nActiveEnterTimestamp=Thu 2026-03-26 17:26:28 UTC\n', '')
        }
      } else {
        cb(new Error('unknown command'), '', 'unknown')
      }
    })

    // Re-import to get fresh module with our mocks
    const mod = await import('../../server/api/services.js')
    const snapshot = await mod.getServicesSnapshot()

    const gateway = snapshot.find((s: { name: string }) => s.name === 'openclaw-gateway')
    expect(gateway).toBeDefined()
    expect(gateway!.status).toBe('active')
  })

  it('detects user service as active when user scope returns active', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: Function) => {
      const isUserScope = args.includes('--user')
      if (args.includes('show')) {
        if (isUserScope) {
          cb(null, 'ActiveState=active\nSubState=running\nMemoryCurrent=67108864\nActiveEnterTimestamp=Thu 2026-03-26 10:00:00 UTC\n', '')
        } else {
          cb(null, 'ActiveState=inactive\nSubState=dead\n', '')
        }
      } else {
        cb(new Error('unknown command'), '', 'unknown')
      }
    })

    const mod = await import('../../server/api/services.js')
    const snapshot = await mod.getServicesSnapshot()

    const gateway = snapshot.find((s: { name: string }) => s.name === 'openclaw-gateway')
    expect(gateway).toBeDefined()
    expect(gateway!.status).toBe('active')
  })

  it('reports inactive when neither scope has the service active', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: Function) => {
      if (args.includes('show')) {
        cb(null, 'ActiveState=inactive\nSubState=dead\n', '')
      } else {
        cb(new Error('unknown command'), '', 'unknown')
      }
    })

    const mod = await import('../../server/api/services.js')
    const snapshot = await mod.getServicesSnapshot()

    const gateway = snapshot.find((s: { name: string }) => s.name === 'openclaw-gateway')
    expect(gateway).toBeDefined()
    expect(gateway!.status).toBe('inactive')
  })
})
