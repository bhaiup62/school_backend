import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import { sseManager } from '../../lib/sseManager'

// GET /api/events  (used by student, parent, teacher all)
export const sseConnect = async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId, admissionNumber, role } = req.user!

  let watchIds: string[] = []

  if (role === 'student') {
    watchIds = [admissionNumber]
  } else if (role === 'parent') {
    const { default: Parent } = await import('../../models/parent/Parent')
    const parent = await Parent.findOne({ parentId: admissionNumber })
    watchIds = parent?.children || []
  } else if (role === 'teacher') {
    watchIds = []
  }

  const clientId = `${role}-${userId}-${Date.now()}`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to live updates', clientId })}\n\n`)

  sseManager.addClient({ id: clientId, res, role, userId, watchIds })

  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`) } catch { clearInterval(heartbeat) }
  }, 25000)

  req.on('close', () => {
    clearInterval(heartbeat)
    sseManager.removeClient(clientId)
  })
}
