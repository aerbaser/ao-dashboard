import { Router } from 'express'
import { readFile, readdir, stat } from 'fs/promises'
import { join, basename, dirname } from 'path'
import { homedir } from 'os'
import { glob } from 'fs'
import { promisify } from 'util'

const router = Router()

/** Recursively find SKILL.md files under a directory */
async function findSkillFiles(dir) {
  const results = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        // Check for SKILL.md directly in this skill folder
        const skillMd = join(fullPath, 'SKILL.md')
        try {
          const st = await stat(skillMd)
          const content = await readFile(skillMd, 'utf-8')
          results.push({
            name: entry.name,
            path: skillMd,
            size: st.size,
            content,
          })
        } catch {
          // No SKILL.md in this dir, recurse
          const nested = await findSkillFiles(fullPath)
          results.push(...nested)
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return results
}

/** GET /api/skills — scan all workspace skill directories */
router.get('/', async (_req, res) => {
  try {
    const home = homedir()
    const openclawDir = join(home, '.openclaw')

    // Find all workspace-* directories
    const entries = await readdir(openclawDir, { withFileTypes: true })
    const workspaces = entries
      .filter(e => e.isDirectory() && e.name.startsWith('workspace-'))
      .map(e => ({
        agent: e.name.replace('workspace-', ''),
        path: join(openclawDir, e.name, 'skills'),
      }))

    // Also include global skills
    workspaces.push({
      agent: 'global',
      path: join(openclawDir, 'skills'),
    })

    const result = {}
    for (const ws of workspaces) {
      const skills = await findSkillFiles(ws.path)
      if (skills.length > 0) {
        result[ws.agent] = skills
      }
    }

    res.json(result)
  } catch (err) {
    console.error('[skills]', err)
    res.status(500).json({ error: 'failed to scan skills' })
  }
})

export default router
