import { Router } from 'express'

import {
  readRateLimitResponse,
  switchActiveProfile,
} from '../lib/rate-limits.js'

const router = Router()

router.get('/', async (_req, res) => {
  const payload = await readRateLimitResponse()
  res.json(payload)
})

router.post('/switch', async (req, res) => {
  const { to } = req.body ?? {}

  if (typeof to !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing "to" field' })
  }

  try {
    const payload = await switchActiveProfile(to)
    return res.json({ ok: true, active: payload.active })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unsupported profile:')) {
      return res.status(400).json({ ok: false, error: error.message })
    }

    return res.status(500).json({ ok: false, error: 'Failed to switch profile' })
  }
})

export default router
