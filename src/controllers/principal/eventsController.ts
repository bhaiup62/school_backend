// src/controllers/principal/eventsController.ts
// Events & Calendar Management for Principal
// ═══════════════════════════════════════════════════════════════════════════════
// Production-ready with atomic operations, sanitized payloads, and optimized queries
// ═══════════════════════════════════════════════════════════════════════════════

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Event, { EVENT_TYPES, EventType } from '../../models/principal/Event'
import { Counter } from '../../models/shared/Counter'
import Principal from '../../models/principal/Principal'

const getISTDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

// FIX #6: Allowed fields whitelist for updates (security - prevents payload injection)
const ALLOWED_UPDATE_FIELDS = [
  'title', 'description', 'eventType', 'category', 'startDate', 'endDate',
  'startTime', 'endTime', 'venue', 'venueType', 'targetAudience',
  'participants', 'targetClasses',
  'priority', 'notifyParents', 'notifyTeachers', 'notifyStudents',
  'isPTM', 'ptmAgenda', 'ptmSlotDuration', 'status', 'isAllDay',
  'isRecurring', 'recurringPattern', 'onlineLink', 'expectedAttendance',
  'contactPerson', 'contactPhone', 'estimatedBudget', 'showOnPublicCalendar',
] as const

type AllowedUpdateField = typeof ALLOWED_UPDATE_FIELDS[number]

// ═══════════════════════════════════════════════════════════
// GET /api/principal/events
// Get all events with filters
// ═══════════════════════════════════════════════════════════
export const getAllEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      eventType,
      startDate,
      endDate,
      month,
      year,
      pendingOnly,
      page = '1',
      limit = '50',
    } = req.query as any

    const filter: Record<string, any> = { isActive: true }

    if (status) filter.status = status
    if (eventType) filter.eventType = eventType
    if (pendingOnly === 'true') filter.status = 'pending_approval'

    // Date range filter
    if (month && year) {
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)
      filter.startDate = { $gte: startOfMonth, $lte: endOfMonth }
    } else if (startDate || endDate) {
      filter.startDate = {}
      if (startDate) filter.startDate.$gte = new Date(startDate)
      if (endDate) filter.startDate.$lte = new Date(endDate)
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Event.countDocuments(filter),
    ])

    res.status(200).json({
      success: true,
      data: events.map(e => ({
        _id: e._id,
        eventId: e.eventId,
        title: e.title,
        eventType: e.eventType,
        category: e.category,
        startDate: e.startDate,
        endDate: e.endDate,
        startTime: e.startTime,
        endTime: e.endTime,
        venue: e.venue,
        targetAudience: e.targetAudience,
        participants: e.participants,
        status: e.status,
        priority: e.priority,
        isPTM: e.isPTM,
        requestedByName: e.requestedByName,
        approvedByName: e.approvedByName,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err: any) {
    console.error('getAllEvents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/events/calendar
// Get calendar view (month/week)
// ═══════════════════════════════════════════════════════════
export const getCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query as any

    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    const startOfMonth = new Date(targetYear, targetMonth - 1, 1)
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59)

    const events = await Event.find({
      isActive: true,
      status: { $in: ['approved', 'completed'] },
      $or: [
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } },
      ],
    })
      .sort({ startDate: 1 })
      .lean()

    // Group by date
    const calendarData: Record<string, any[]> = {}
    events.forEach(e => {
      const dateKey = new Date(e.startDate).toISOString().split('T')[0]
      if (!calendarData[dateKey]) calendarData[dateKey] = []
      calendarData[dateKey].push({
        _id: e._id,
        eventId: e.eventId,
        title: e.title,
        eventType: e.eventType,
        startTime: e.startTime,
        endTime: e.endTime,
        venue: e.venue,
        priority: e.priority,
        isPTM: e.isPTM,
      })
    })

    res.status(200).json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        totalEvents: events.length,
        calendar: calendarData,
      },
    })
  } catch (err: any) {
    console.error('getCalendar error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/events/pending
// Get events pending approval
// ═══════════════════════════════════════════════════════════
export const getPendingEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await Event.find({
      status: 'pending_approval',
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean()

    res.status(200).json({
      success: true,
      data: events.map(e => ({
        _id: e._id,
        eventId: e.eventId,
        title: e.title,
        description: e.description,
        eventType: e.eventType,
        startDate: e.startDate,
        endDate: e.endDate,
        venue: e.venue,
        targetAudience: e.targetAudience,
        participants: e.participants,
        requestedByName: e.requestedByName,
        requestedAt: e.requestedAt,
        estimatedBudget: e.estimatedBudget,
        isPTM: e.isPTM,
        ptmAgenda: e.ptmAgenda,
      })),
      count: events.length,
    })
  } catch (err: any) {
    console.error('getPendingEvents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/events/:id
// Get event detail
// ═══════════════════════════════════════════════════════════
export const getEventDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await Event.findById(req.params.id).lean()

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: event,
    })
  } catch (err: any) {
    console.error('getEventDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/principal/events
// Create a new event (Principal can create directly as approved)
// FIX #2: Handle missing endDate
// FIX #3: Atomic eventId generation
// ═══════════════════════════════════════════════════════════
export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      eventType,
      category,
      startDate,
      endDate,
      startTime,
      endTime,
      venue,
      venueType,
      targetAudience,
      targetClasses,
      priority,
      isAllDay,
      onlineLink,
      notifyParents,
      notifyTeachers,
      notifyStudents,
      estimatedBudget,
      showOnPublicCalendar,
    } = req.body

    // Validate required fields
    if (!title || !startDate || !eventType) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: title, startDate, eventType',
      })
      return
    }

    // Validate eventType
    if (!EVENT_TYPES.includes(eventType as EventType)) {
      res.status(400).json({
        success: false,
        message: `Invalid eventType. Must be one of: ${EVENT_TYPES.join(', ')}`,
      })
      return
    }

    const principal = await Principal.findOne({ user: req.user!.userId }).lean()
    const principalName = principal ? `${principal.firstName} ${principal.lastName}` : 'Principal'

    // FIX #3: Atomic eventId generation
    const eventId = await Counter.getNextSequence('EVT')

    // FIX #2: Set endDate = startDate if missing (prevents 500 crash)
    const parsedStartDate = new Date(startDate)
    const parsedEndDate = endDate ? new Date(endDate) : parsedStartDate
    const participantsPayload = {
      type: targetAudience === 'specific_classes' ? 'class' : 'all',
      classes: targetAudience === 'specific_classes' && Array.isArray(targetClasses) ? targetClasses : [],
      sections: []
    };

    const event = new Event({
      eventId,
      title,
      description: description || '',
      eventType,
      category: category || 'internal',
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      startTime: startTime || '09:00',
      endTime: endTime || '17:00',
      venue: venue || 'School Campus',
      venueType: venueType || 'school_premises',
      targetAudience: targetAudience || 'all',
      participants: participantsPayload,
      priority: priority || 'normal',
      isAllDay: isAllDay || false,
      onlineLink: onlineLink || '',
      notifyParents: notifyParents !== false,
      notifyTeachers: notifyTeachers !== false,
      notifyStudents: notifyStudents !== false,
      estimatedBudget: estimatedBudget || 0,
      showOnPublicCalendar: showOnPublicCalendar !== false,
      organizer: principal?._id,
      organizerRole: 'principal',
      organizerName: principalName,
      status: 'approved',  // Principal-created events are auto-approved
      approvedBy: principal?._id,
      approvedByName: principalName,
      approvedAt: getISTDate(),
    })

    await event.save()

    res.status(201).json({
      success: true,
      message: 'Event created and approved.',
      data: event,
    })
  } catch (err: any) {
    console.error('createEvent error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/principal/events/:id/approve
// Approve an event
// FIX #5: Atomic update with findOneAndUpdate
// ═══════════════════════════════════════════════════════════
export const approveEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { approvalRemarks, budgetApproved } = req.body

    const principal = await Principal.findOne({ user: req.user!.userId }).lean()
    const principalName = principal ? `${principal.firstName} ${principal.lastName}` : 'Principal'

    // FIX #5: Build atomic $set object
    const updateFields: Record<string, any> = {
      status: 'approved',
      approvedBy: principal?._id,
      approvedByName: principalName,
      approvedAt: getISTDate(),
    }

    if (approvalRemarks) updateFields.approvalRemarks = approvalRemarks
    if (typeof budgetApproved === 'boolean') updateFields.budgetApproved = budgetApproved

    // FIX #5: Atomic update - no race condition
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean()

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Event approved.',
      data: event,
    })
  } catch (err: any) {
    console.error('approveEvent error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/principal/events/:id/reject
// Reject an event
// FIX #5: Atomic update with findOneAndUpdate
// ═══════════════════════════════════════════════════════════
export const rejectEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rejectedReason } = req.body

    const principal = await Principal.findOne({ user: req.user!.userId }).lean()

    // FIX #5: Atomic update
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      {
        $set: {
          status: 'rejected',
          rejectedBy: principal?._id,
          rejectedReason: rejectedReason || '',
          rejectedAt: getISTDate(),
        },
      },
      { new: true, runValidators: true }
    ).lean()

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Event rejected.',
      data: event,
    })
  } catch (err: any) {
    console.error('rejectEvent error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/principal/events/:id
// Update an event
// FIX #5: Atomic update with findOneAndUpdate
// FIX #6: Sanitized payload - only allowed fields
// ═══════════════════════════════════════════════════════════
export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // FIX #6: Explicitly construct $set object with allowed fields only
    // This prevents payload injection attacks
    const updateFields: Record<string, any> = {}

    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        // Handle date fields specially
        if (field === 'startDate' || field === 'endDate') {
          updateFields[field] = new Date(req.body[field])
        } else {
          updateFields[field] = req.body[field]
        }
      }
    }

    // FIX #2: If startDate is set but endDate is not, set endDate = startDate
    if (updateFields.startDate && !updateFields.endDate && !req.body.endDate) {
      updateFields.endDate = updateFields.startDate
    }

    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields to update.' })
      return
    }

    // FIX #5: Atomic update - no race condition
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean()

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Event updated.',
      data: event,
    })
  } catch (err: any) {
    console.error('updateEvent error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/principal/events/:id
// Cancel/delete an event
// FIX #5: Atomic update with findOneAndUpdate
// ═══════════════════════════════════════════════════════════
export const cancelEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // FIX #5: Atomic update
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      {
        $set: {
          status: 'cancelled',
          isActive: false,
        },
      },
      { new: true }
    ).lean()

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Event cancelled.',
    })
  } catch (err: any) {
    console.error('cancelEvent error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/principal/events/ptm
// Create a PTM event with special configuration
// FIX #1: Accept { classes, agenda } from frontend (not targetClasses, ptmAgenda)
// FIX #2: Handle missing endDate
// FIX #3: Atomic eventId generation
// ═══════════════════════════════════════════════════════════
export const createPTM = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // FIX #1: Accept frontend payload fields: classes (array), agenda (string/array)
    const {
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      venue,
      classes,        // FIX #1: Frontend sends 'classes' (array of strings like ['1', '2'])
      agenda,         // FIX #1: Frontend sends 'agenda' (string or array)
      ptmSlotDuration = 10,
    } = req.body

    if (!startDate) {
      res.status(400).json({
        success: false,
        message: 'startDate is required.',
      })
      return
    }

    const principal = await Principal.findOne({ user: req.user!.userId }).lean()
    const principalName = principal ? `${principal.firstName} ${principal.lastName}` : 'Principal'

    // FIX #3: Atomic eventId generation
    const eventId = await Counter.getNextSequence('EVT')

    // FIX #2: Set endDate = startDate if missing
    const parsedStartDate = new Date(startDate)
    const parsedEndDate = endDate ? new Date(endDate) : parsedStartDate

    // FIX #1: Handle agenda - could be string or array
    const ptmAgenda = Array.isArray(agenda) ? agenda : agenda ? [agenda] : []

    // FIX #1 & #4: Build participants with classes array (no studentIds/teacherIds)
    const participants = {
      type: classes && classes.length > 0 ? 'class' : 'all',
      classes: Array.isArray(classes) ? classes : classes ? [classes] : [],
      sections: [],
    }

    const event = new Event({
      eventId,
      title: title || 'Parent-Teacher Meeting',
      description: description || '',
      eventType: 'ptm',
      category: 'mandatory',
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      startTime: startTime || '09:00',
      endTime: endTime || '17:00',
      venue: venue || 'School Campus',
      venueType: 'school_premises',
      targetAudience: 'parents',
      participants,
      organizer: principal?._id,
      organizerRole: 'principal',
      organizerName: principalName,
      status: 'approved',
      approvedBy: principal?._id,
      approvedByName: principalName,
      approvedAt: new Date(),
      isPTM: true,
      ptmAgenda,
      ptmSlotDuration,
      priority: 'high',
      notifyParents: true,
      notifyTeachers: true,
    })

    await event.save()

    res.status(201).json({
      success: true,
      message: 'PTM event created.',
      data: event,
    })
  } catch (err: any) {
    console.error('createPTM error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
