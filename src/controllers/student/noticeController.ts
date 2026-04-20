// src/controllers/student/noticeController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import Notice from '../../models/principal/Notice'
import { AuthRequest } from '../../middleware/authMiddleware'

// ── GET /api/student/notices ─────────────────────────────
export const getNotices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 🛡️ FIX: Properly select the new Enterprise Schema fields
    const student = await Student.findOne({
      admissionNumber: req.user!.admissionNumber,
      isActive: true,
    }).select('currentClass currentSection')

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // Pagination params
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const skip = (page - 1) * limit

    // Find notices targeted to this student's class or ALL
    // Only show approved notices that are not deleted
    const filter = {
      isActive: true,
      status: 'approved',
      isDeleted: { $ne: true },
      $or: [
        { targetClass: 'ALL' },
        { 
          targetClass: student.currentClass,
          $or: [
            { targetSection: 'ALL' },
            { targetSection: student.currentSection }
          ]
        }
      ]
    }

    const [notices, total] = await Promise.all([
      Notice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notice.countDocuments(filter),
    ])

    res.status(200).json({
      success: true,
      data: notices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('getNotices error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}