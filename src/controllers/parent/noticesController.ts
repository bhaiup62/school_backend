// src/controllers/parent/noticesController.ts

import { Response } from 'express'
import Parent from '../../models/parent/Parent'
import Student from '../../models/student/Student'
import Notice from '../../models/principal/Notice'
import { AuthRequest } from '../../middleware/authMiddleware'

// GET /api/parent/notices
export const getNotices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({ parentId: req.user!.admissionNumber, isActive: true })
    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    const children = await Student.find({
      admissionNumber: { $in: parent.children },
      isActive: true,
    }).select('currentClass currentSection')

    // 🛡️ SECURE BASE FILTER: Only approved, non-deleted notices meant for parents/students
    const baseFilter = {
      isActive: true,
      status: 'approved',
      isDeleted: false,
      targetAudience: { $in: ['all', 'parents', 'students'] } 
    }

    // If parent has no active children linked, only show school-wide ALL notices
    if (children.length === 0) {
      const notices = await Notice.find({
        ...baseFilter,
        targetClass: 'ALL',
      })
        .sort({ createdAt: -1 })
        .limit(50)
      res.status(200).json({ success: true, data: notices })
      return
    }

    // Build filter based on their children's CURRENT class and section
    const classFilters = children.map((c) => ({
      targetClass: c.currentClass,
      $or: [{ targetSection: 'ALL' }, { targetSection: c.currentSection }],
    }))

    const notices = await Notice.find({
      ...baseFilter,
      $or: [{ targetClass: 'ALL' }, ...classFilters],
    })
      .sort({ createdAt: -1 })
      .limit(50)

    res.status(200).json({ success: true, data: notices })
  } catch (err: any) {
    console.error('getNotices error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}