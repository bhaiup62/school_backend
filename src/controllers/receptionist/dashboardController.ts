// src/controllers/receptionist/dashboardController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import Parent from '../../models/parent/Parent'
import { AuthRequest } from './receptionistHelpers'

// GET /api/receptionist/stats
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalStudents = await Student.countDocuments({ isActive: true })
    const totalParents = await Parent.countDocuments({ isActive: true })

    // 🛡️ FIX: Map to new `currentClass` from the Enterprise Schema
    const studentsByClass = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$currentClass', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])

    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentStudents = await Student.countDocuments({
      isActive: true,
      admissionDate: { $gte: thirtyDaysAgo },
    })

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalParents,
        studentsByClass,
        recentRegistrations: recentStudents,
      },
    })
  } catch (err: any) {
    console.error('getDashboardStats error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}