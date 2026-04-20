// src/routes/adminRoutes.ts

import { Router } from 'express'
import { protect, authorizeRole } from '../middleware/authMiddleware'

import { getAdminDashboardStats } from '../controllers/admin/dashboardController'

const router = Router()

// Apply protection and Admin-only authorization to ALL admin routes
router.use(protect)
router.use(authorizeRole('admin'))

// ── Dashboard Overview ──
router.get('/dashboard', getAdminDashboardStats)

// ── Admissions Setup ──


export default router