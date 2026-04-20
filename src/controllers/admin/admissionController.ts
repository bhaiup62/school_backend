// src/controllers/admin/admissionController.ts

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'

// ── GET /api/admin/admissions/pipeline ──────────────────────────────
export const getAdmissionPipeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Calculate high-level pipeline statistics
    const totalStudents = await Student.countDocuments()
    const activeStudents = await Student.countDocuments({ isActive: true })
    const inactiveStudents = await Student.countDocuments({ isActive: false })

    // Calculate admissions in the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentCount = await Student.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })

    // 2. Fetch the 10 most recent admissions for the pipeline table
    const recentAdmissions = await Student.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('admissionNumber firstName lastName currentClass currentSection gender createdAt isActive')

    res.status(200).json({
      success: true,
      data: {
        stats: {
          total: totalStudents,
          active: activeStudents,
          inactive: inactiveStudents,
          last30Days: recentCount,
        },
        recent: recentAdmissions,
        // Mocking the current system config for admissions
        config: {
          currentSession: '2026-2027',
          status: 'OPEN',
          totalCapacity: 1500,
        }
      }
    })
  } catch (error: any) {
    console.error('getAdmissionPipeline error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching admission pipeline.' })
  }
}