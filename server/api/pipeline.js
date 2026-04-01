import { Router } from 'express'
import { execFile } from 'child_process'

const router = Router()

// Map AO session status to pipeline state
const AO_STATUS_MAP = {
  spawning: 'in_progress',
  ready: 'in_progress', 
  working: 'in_progress',
  pr_open: 'review',
  ci_failed: 'ci_failed',
  review_pending: 'review',
  changes_requested: 'changes_requested',
  approved: 'approved',
  mergeable: 'approved',
  merged: 'done',
  needs_input: 'blocked',
  stuck: 'blocked',
  errored: 'failed',
  killed: 'failed',
  done: 'done',
}

function ghExec(args) {
  return new Promise((resolve, reject) => {
    execFile('/home/aiadmin/.local/bin/gh', args, { timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

function aoExec(args) {
  const ao = process.env.HOME + '/.npm-global/bin/ao'
  return new Promise((resolve, reject) => {
    execFile(ao, args, { timeout: 10_000, env: { ...process.env, NO_COLOR: '1' } }, (err, stdout) => {
      if (err) resolve('') // AO may not be running
      else resolve(stdout)
    })
  })
}

async function fetchGitHubIssues(repo) {
  try {
    const raw = await ghExec([
      'issue', 'list', '--repo', repo, '--state', 'all',
      '--json', 'number,title,state,labels,assignees,createdAt,closedAt',
      '--limit', '50'
    ])
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function fetchAOSessions() {
  try {
    const raw = await aoExec(['list', '--json'])
    return JSON.parse(raw)
  } catch {
    // Fallback: try HTTP
    try {
      const resp = await fetch('http://127.0.0.1:3100/api/sessions')
      const data = await resp.json()
      return data.sessions || data || []
    } catch {
      return []
    }
  }
}

// GET /api/pipeline
router.get('/', async (_req, res) => {
  try {
    const repos = ['aerbaser/ao-dashboard', 'aerbaser/sokrat-core']
    
    // Fetch in parallel
    const [issuesArrays, sessions] = await Promise.all([
      Promise.all(repos.map(r => fetchGitHubIssues(r))),
      fetchAOSessions(),
    ])

    // Build session lookup: issueId → session
    const sessionMap = new Map()
    for (const s of sessions) {
      const issueNum = s.issueId || s.issueNumber
      if (issueNum) {
        const key = `${s.projectId}#${issueNum}`
        // Keep latest session per issue
        if (!sessionMap.has(key) || new Date(s.createdAt) > new Date(sessionMap.get(key).createdAt)) {
          sessionMap.set(key, s)
        }
      }
    }

    const items = []
    for (let ri = 0; ri < repos.length; ri++) {
      const repo = repos[ri]
      const projectId = repo.split('/')[1]
      const issues = issuesArrays[ri]

      for (const issue of issues) {
        const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name)
        const agentLabel = labels.find(l => l.startsWith('agent:'))

        const sessionKey = `${projectId}#${issue.number}`
        const session = sessionMap.get(sessionKey)

        let status = 'backlog'
        let prNumber = null
        let ciBadge = null

        if (issue.state === 'CLOSED' || issue.closedAt) {
          status = 'done'
        } else if (session) {
          status = AO_STATUS_MAP[session.status] || session.status
          prNumber = session.pr?.number || session.prNumber || null
          ciBadge = session.ci || null
        } else if (!agentLabel) {
          status = 'needs_triage'
        } else if (agentLabel === 'agent:backlog') {
          status = 'backlog'
        } else {
          status = 'queued' // labeled but not spawned yet
        }

        const priority = labels.find(l => l.startsWith('priority:'))?.replace('priority:', '') || null

        items.push({
          id: `${projectId}#${issue.number}`,
          number: issue.number,
          title: issue.title,
          repo: projectId,
          status,
          priority,
          labels,
          pr: prNumber,
          ci: ciBadge,
          session: session?.id || null,
          createdAt: issue.createdAt,
          closedAt: issue.closedAt,
        })
      }
    }

    // Sort: in_progress first, then review, then queued, then backlog, then done
    const ORDER = { needs_triage: 0, in_progress: 1, ci_failed: 2, review: 3, changes_requested: 4, approved: 5, blocked: 6, queued: 7, backlog: 8, done: 9, failed: 10 }
    items.sort((a, b) => (ORDER[a.status] ?? 99) - (ORDER[b.status] ?? 99))

    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
