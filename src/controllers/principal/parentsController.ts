// src/controllers/principal/parentsController.ts
// Parents management for Principal - Read Only

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Parent from '../../models/parent/Parent'
import Student from '../../models/student/Student'

// GET /api/principal/parents
// List all parents with search & pagination
export const getAllParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = 1, limit = 25 } = req.query as any

    const filter: Record<string, any> = { isActive: true }

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { parentId: searchRegex },
        { phone: searchRegex },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const parents = await Parent.find(filter)
      .select('firstName lastName parentId phone email relation children')
      .sort({ parentId: 1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await Parent.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: parents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getAllParents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/principal/parents/:parentId
// Get detailed parent info including children details
export const getParentDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.params.parentId.toUpperCase(),
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    // Get children details
    const children = await Student.find({
      admissionNumber: { $in: parent.children },
      isActive: true,
    }).select('firstName lastName admissionNumber currentClass currentSection rollNumber')

    res.status(200).json({
      success: true,
      data: {
        ...parent.toObject(),
        childrenDetails: children,
      },
    })
  } catch (err: any) {
    console.error('getParentDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
