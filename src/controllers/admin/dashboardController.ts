// src/controllers/admin/dashboardController.ts

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'
import User from '../../models/shared/User'

// ── GET /api/admin/dashboard ──────────────────────────────
export const getAdminDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Run multiple count queries concurrently for speed
    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalReceptionists
    ] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'parent', isActive: true }),
      User.countDocuments({ role: 'receptionist', isActive: true })
    ])

    // 2. Total Staff Calculation
    const totalStaff = totalTeachers + totalReceptionists + 1 // +1 for the Admin/Principal

    // 3. Mocked Financial & Health Data (Until we build the Finance module)
    const stats = {
      totalStudents,
      totalStaff,
      totalParents,
      monthlyRevenue: 1245000, // Mocked INR/USD amount
      systemHealth: 99.9,
    }

    // 4. Mocked System Alerts
    const alerts = [
      { id: 1, type: 'warning', message: 'Database backup scheduled in 2 hours.', time: '10 mins ago' },
      { id: 2, type: 'critical', message: 'Failed login attempt detected from unknown IP.', time: '1 hour ago' },
      { id: 3, type: 'info', message: 'Term 1 Exam results published by Principal.', time: '3 hours ago' },
    ]

    res.status(200).json({
      success: true,
      data: { stats, alerts }
    })
  } catch (error: any) {
    console.error('getAdminDashboardStats error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching dashboard stats.' })
  }
}