// src/controllers/student/eventController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import Event from '../../models/principal/Event' // Adjust path if your Event model is located elsewhere
import { AuthRequest } from '../../middleware/authMiddleware'

// ── GET /api/student/events ─────────────────────────────
export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Get the student's current class/section for targeting
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

    // 2. Filter events (School-wide 'ALL' or specific to their Class)
    // Assuming your Event model uses similar targeting to Notice
    const filter = {
      isActive: true,
      $or: [
        { targetClass: 'ALL' },
        { targetClass: student.currentClass },
        { targetClass: { $exists: false } } // Fallback in case targetClass isn't mandatory on events
      ]
    }

    // 3. Fetch events sorted by date (upcoming first)
    // Note: checking both 'date' and 'eventDate' to be safe with your schema naming
    const [events, total] = await Promise.all([
      Event.find(filter).sort({ date: 1, eventDate: 1, createdAt: -1 }).skip(skip).limit(limit),
      Event.countDocuments(filter),
    ])

    res.status(200).json({
      success: true,
      data: events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('getEvents error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}