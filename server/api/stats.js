// Stats API — throughput metrics aggregated from task-store + GitHub issues
import { Router } from 'express'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'

const TASKS_DIR = join(process.env.HOME, 'clawd/tasks')
const GH_BIN = '/home/aiadmin/.local/bin/gh'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function median(sorted) {
  const n = sorted.length
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Scan task-store directories (active + archive) for tasks with status.json */
function readLocalTasks() {
  const results = []
  for (const sub of ['active', 'archive']) {
    const dir = join(TASKS_DIR, sub)
    if (!existsSync(dir)) continue
    let entries
    try { entries = readdirSync(dir).filter(d => d.startsWith('tsk_')) } catch { continue }
    for (const id of entries) {
      const statusPath = join(dir, id, 'status.json')
      if (!existsSync(statusPath)) continue
      try {
        const status = JSON.parse(readFileSync(statusPath, 'utf8'))
        results.push({
          id,
          state: status.state,
          createdAt: status.created_at ? new Date(status.created_at).getTime() : null,
          completedAt: status.updated_at ? new Date(status.updated_at).getTime() : null,
        })
      } catch { /* skip malformed */ }
    }
  }
  return results
}

/** Fetch closed GitHub issues with agent:archimedes label */
function readGitHubClosedIssues() {
  const repos = ['aerbaser/ao-dashboard', 'aerbaser/sokrat-core']
  return Promise.all(repos.map(repo =>
    new Promise(resolve => {
      execFile(GH_BIN, [
        'issue', 'list', '--repo', repo, '--state', 'closed',
        '--label', 'agent:archimedes',
        '--json', 'number,title,state,createdAt,closedAt',
        '--limit', '100',
      ], { timeout: 15_000 }, (err, stdout) => {
        if (err) return resolve([])
        try {
          const issues = JSON.parse(stdout)
          resolve(issues.map(i => ({
            id: `gh-${repo.split('/')[1]}-${i.number}`,
            state: 'DONE',
            createdAt: i.createdAt ? new Date(i.createdAt).getTime() : null,
            completedAt: i.closedAt ? new Date(i.closedAt).getTime() : null,
          })))
        } catch { resolve([]) }
      })
    })
  )).then(arrays => arrays.flat())
}

// ─── Router factory ───────────────────────────────────────────────────────────

export function createStatsRouter(deps = {}) {
  const {
    getLocalTasks = readLocalTasks,
    getGitHubTasks = readGitHubClosedIssues,
  } = deps

  const router = Router()

  router.get('/throughput', async (_req, res) => {
    try {
      const now = Date.now()
      const cutoff24h = now - 24 * 60 * 60 * 1000
      const cutoff7d = now - 7 * 24 * 60 * 60 * 1000

      const [localTasks, ghTasks] = await Promise.all([
        Promise.resolve(getLocalTasks()),
        getGitHubTasks(),
      ])

      // Merge and deduplicate — only DONE tasks count for throughput
      const allDone = [...localTasks, ...ghTasks].filter(
        t => t.state === 'DONE' && t.completedAt
      )

      const completed24h = allDone.filter(t => t.completedAt >= cutoff24h).length
      const completed7d = allDone.filter(t => t.completedAt >= cutoff7d).length

      // Cycle times in minutes (only tasks with both timestamps, exclude FAILED)
      const cycleTimes = allDone
        .filter(t => t.createdAt && t.completedAt > t.createdAt)
        .map(t => Math.round((t.completedAt - t.createdAt) / 60_000))
        .sort((a, b) => a - b)

      const avgCycleMin = cycleTimes.length > 0
        ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
        : 0
      const medianCycleMin = cycleTimes.length > 0
        ? Math.round(median(cycleTimes))
        : 0

      // Backlog trend: compare 24h completion rate to 7d daily average
      const dailyAvg7d = completed7d / 7
      const backlog_trend = completed24h > dailyAvg7d * 1.2
        ? 'shrinking'
        : completed24h < dailyAvg7d * 0.8
          ? 'growing'
          : 'stable'

      res.json({
        completed_24h: completed24h,
        completed_7d: completed7d,
        avg_cycle_time_minutes: avgCycleMin,
        median_cycle_time_minutes: medianCycleMin,
        backlog_trend,
        computed_at: new Date().toISOString(),
      })
    } catch (err) {
      res.status(500).json({ error: 'Throughput computation failed', detail: String(err) })
    }
  })

  return router
}

const router = createStatsRouter()
export default router
