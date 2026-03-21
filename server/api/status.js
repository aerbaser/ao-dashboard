import { Router } from 'express'
import { createEmptyStatus, createStatusService } from '../lib/status.js'

export function createStatusRouter(options = {}) {
  const router = Router()
  const statusService = createStatusService(options)

  router.get('/', async (_req, res) => {
    try {
      res.json(await statusService.getStatus())
    } catch {
      res.json(createEmptyStatus())
    }
  })

  return router
}

export default createStatusRouter
