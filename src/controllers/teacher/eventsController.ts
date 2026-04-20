import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Event from '../../models/principal/Event'
import { getTeacher } from './teacherHelpers'

// GET /api/teacher/events
export const getUpcomingEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    // 1. Get teacher's assigned classes to show class-specific events
    const assignedClassesRaw = teacher.currentAssignedClasses || []
    const ctInfo = teacher.currentClassTeacherOf
    
    let baseClasses = assignedClassesRaw.map(c => String(c).includes('-') ? String(c).split('-')[0] : String(c))
    if (ctInfo) baseClasses.push(String(ctInfo.class))
    
    const uniqueClasses = Array.from(new Set(baseClasses))

    // 2. Fetch both past and upcoming events (let frontend filter via tabs)
    const events = await Event.find({
      isActive: true,
      status: 'approved',
      $or: [
        { targetAudience: { $in: ['all', 'teachers', 'staff'] } },
        {
          targetAudience: 'specific',
          'participants.classes': { $in: ['ALL', ...uniqueClasses] }
        }
      ]
    })
      .sort({ startDate: -1 }) // Sort newest first
      .limit(100) // Keep payload reasonable

    res.status(200).json({
      success: true,
      data: events.map(e => ({
        _id: e._id,
        title: e.title,
        description: e.description,
        eventType: e.eventType,
        date: e.startDate, // Sends full ISO string
        endDate: e.endDate,
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