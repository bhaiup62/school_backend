import { Router } from 'express'
import { login, getMe, changePassword } from '../controllers/authController'
import { protect, authorizeRole } from '../middleware/authMiddleware'

const router = Router()

// POST /api/auth/login
router.post('/login', login)

// GET /api/auth/me  — protected
router.get('/me', protect, authorizeRole('student', 'teacher', 'admin'), getMe)

// POST /api/auth/change-password — protected
router.post('/change-password', protect, changePassword)

export default router