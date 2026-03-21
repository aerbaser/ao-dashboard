import { Router } from 'express'
import { collectVitals } from '../lib/vitals.js'

export function createVitalsRouter(deps = {}) {
  const router = Router()
  const readVitals = deps.collectVitals ?? collectVitals

  router.get('/', async (_req, res) => {
    try {
      const vitals = await readVitals()
      res.json(vitals)
    } catch (error) {
      res.status(500).json({ error: 'Failed to read vitals', detail: String(error) })
    }
  })

  return router
}

const router = createVitalsRouter()

export default router
