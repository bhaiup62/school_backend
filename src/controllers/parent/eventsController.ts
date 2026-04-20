// src/controllers/parent/eventsController.ts

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Event from '../../models/principal/Event'

// GET /api/parent/events
export const getUpcomingEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 🛡️ Removed the strict `$gte: today` filter so parents can see past events too!
    const events = await Event.find({
      isActive: true,
      status: 'approved',
      targetAudience: { $in: ['all', 'parents', 'students'] },
    })
      .sort({ startDate: -1 }) // Sort newest first
      .limit(50)

    res.status(200).json({
      success: true,
      data: events.map(e => ({
        _id: e._id, 
        title: e.title, 
        description: e.description, 
        eventType: e.eventType,
        date: e.startDate, 
        startTime: e.startTime, 
        endTime: e.endTime, 
        venue: e.venue,
        targetAudience: e.targetAudience, 
        targetClasses: e.participants?.classes?.length ? e.participants.classes : ['ALL'],
        status: e.status, 
        createdAt: e.createdAt,
      })),
    })
  } catch (err: any) {
    console.error('getUpcomingEvents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}