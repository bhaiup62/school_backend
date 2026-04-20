// src/routes/sseRoutes.ts
// Real-time SSE endpoint — accessible by student, parent, teacher

import { Router } from 'express'
import { protect } from '../middleware/authMiddleware'
import { sseConnect } from '../controllers/shared/sseController'

const router = Router()

// GET /api/events — connect to live event stream
router.get('/', protect, sseConnect)

export default router
