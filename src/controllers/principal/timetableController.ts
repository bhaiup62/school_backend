import { Request, Response } from 'express'
import { Timetable, ITimetable, IDaySchedule, IPeriod } from '../../models/principal/Timetable'
import Teacher from '../../models/teacher/Teacher'
import { logAudit } from '../../models/shared/AuditLog'

// Extended request with user info from JWT
interface AuthRequest extends Request {
  user?: {
    userId: string
    admissionNumber: string
    role: string
  }
}

// GET /principal/timetables - Get all timetables
export const getAllTimetables = async (req: Request, res: Response) => {
  try {
    const { class: cls, section, academicYear, isActive } = req.query

    const filter: Record<string, unknown> = {}
    if (cls) filter.class = cls
    if (section) filter.section = (section as string).toUpperCase()
    if (academicYear) filter.academicYear = academicYear
    if (isActive !== undefined) filter.isActive = isActive === 'true'

    const timetables = await Timetable.find(filter).sort({ class: 1, section: 1 })

    res.json({
      success: true,
      data: timetables,
      count: timetables.length,
    })
  } catch (error) {
    console.error('Get all timetables error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch timetables' })
  }
}

// GET /principal/timetables/:class/:section - Get timetable for specific class/section
export const getTimetable = async (req: Request, res: Response) => {
  try {
    const { class: cls, section } = req.params
    const { academicYear } = req.query

    const filter: Record<string, unknown> = {
      class: cls,
      section: section.toUpperCase(),
      isActive: true,
    }
    if (academicYear) filter.academicYear = academicYear

    const timetable = await Timetable.findOne(filter).sort({ effectiveFrom: -1 })

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'No timetable found for this class/section',
      })
    }

    res.json({
      success: true,
      data: timetable,
    })
  } catch (error) {
    console.error('Get timetable error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch timetable' })
  }
}

// POST /principal/timetables - Create new timetable
export const createTimetable = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { class: cls, section, academicYear, effectiveFrom, effectiveTo, schedule } = req.body

    // Validate required fields
    if (!cls || !section || !academicYear || !effectiveFrom || !schedule) {
      return res.status(400).json({
        success: false,
        message: 'Class, section, academic year, effective from date, and schedule are required',
      })
    }

    // Check if timetable already exists for this class/section/year
    const existing = await Timetable.findOne({
      class: cls,
      section: section.toUpperCase(),
      academicYear,
    })

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Timetable already exists for this class/section/academic year. Please update instead.',
      })
    }

    // Validate teacher IDs exist
    const teacherIds = new Set<string>()
    for (const day of schedule as IDaySchedule[]) {
      for (const period of day.periods) {
        if (!period.isBreak && period.teacherId) {
          teacherIds.add(period.teacherId)
        }
      }
    }

    const teachers = await Teacher.find({ teacherId: { $in: Array.from(teacherIds) } })
    if (teachers.length !== teacherIds.size) {
      const foundIds = new Set(teachers.map((t: any) => t.teacherId))
      const missingIds = Array.from(teacherIds).filter((id) => !foundIds.has(id))
      return res.status(400).json({
        success: false,
        message: `Some teacher IDs not found: ${missingIds.join(', ')}`,
      })
    }

    const timetable = await Timetable.create({
      class: cls,
      section: section.toUpperCase(),
      academicYear,
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      schedule,
      isActive: true,
      createdBy: user.admissionNumber,
      createdByName: user.admissionNumber, // Will be updated with actual name
    })

    // Audit log
    await logAudit({
      action: 'CREATE',
      entityType: 'Timetable',
      entityId: timetable._id.toString(),
      performedBy: user.admissionNumber,
      performedByName: user.admissionNumber,
      performedByRole: user.role,
      description: `Created timetable for Class ${cls}-${section} (${academicYear})`,
      newData: { class: cls, section, academicYear },
    })

    res.status(201).json({
      success: true,
      message: 'Timetable created successfully',
      data: timetable,
    })
  } catch (error) {
    console.error('Create timetable error:', error)
    res.status(500).json({ success: false, message: 'Failed to create timetable' })
  }
}

// PUT /principal/timetables/:id - Update timetable
export const updateTimetable = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { schedule, effectiveFrom, effectiveTo, isActive } = req.body

    const timetable = await Timetable.findById(id)
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found',
      })
    }

    const previousData = {
      schedule: timetable.schedule,
      effectiveFrom: timetable.effectiveFrom,
      effectiveTo: timetable.effectiveTo,
      isActive: timetable.isActive,
    }

    if (schedule) {
      // Validate teacher IDs exist
      const teacherIds = new Set<string>()
      for (const day of schedule as IDaySchedule[]) {
        for (const period of day.periods) {
          if (!period.isBreak && period.teacherId) {
            teacherIds.add(period.teacherId)
          }
        }
      }

      const teachers = await Teacher.find({ teacherId: { $in: Array.from(teacherIds) } })
      if (teachers.length !== teacherIds.size) {
        const foundIds = new Set(teachers.map((t: any) => t.teacherId))
        const missingIds = Array.from(teacherIds).filter((tid) => !foundIds.has(tid))
        return res.status(400).json({
          success: false,
          message: `Some teacher IDs not found: ${missingIds.join(', ')}`,
        })
      }
      timetable.schedule = schedule
    }

    if (effectiveFrom) timetable.effectiveFrom = new Date(effectiveFrom)
    if (effectiveTo !== undefined) timetable.effectiveTo = effectiveTo ? new Date(effectiveTo) : undefined
    if (isActive !== undefined) timetable.isActive = isActive
    timetable.updatedBy = user.admissionNumber
    timetable.updatedByName = user.admissionNumber

    await timetable.save()

    // Audit log
    await logAudit({
      action: 'UPDATE',
      entityType: 'Timetable',
      entityId: timetable._id.toString(),
      performedBy: user.admissionNumber,
      performedByName: user.admissionNumber,
      performedByRole: user.role,
      description: `Updated timetable for Class ${timetable.class}-${timetable.section}`,
      previousData,
      newData: { schedule, effectiveFrom, effectiveTo, isActive },
    })

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: timetable,
    })
  } catch (error) {
    console.error('Update timetable error:', error)
    res.status(500).json({ success: false, message: 'Failed to update timetable' })
  }
}

// DELETE /principal/timetables/:id - Delete timetable
export const deleteTimetable = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { id } = req.params

    const timetable = await Timetable.findByIdAndDelete(id)
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found',
      })
    }

    // Audit log
    await logAudit({
      action: 'DELETE',
      entityType: 'Timetable',
      entityId: id,
      performedBy: user.admissionNumber,
      performedByName: user.admissionNumber,
      performedByRole: user.role,
      description: `Deleted timetable for Class ${timetable.class}-${timetable.section}`,
      previousData: { class: timetable.class, section: timetable.section, academicYear: timetable.academicYear },
    })

    res.json({
      success: true,
      message: 'Timetable deleted successfully',
    })
  } catch (error) {
    console.error('Delete timetable error:', error)
    res.status(500).json({ success: false, message: 'Failed to delete timetable' })
  }
}

// GET /principal/timetables/teacher/:teacherId - Get timetable for a teacher
export const getTeacherTimetable = async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params

    // Find all timetables where this teacher has classes
    const timetables = await Timetable.find({
      isActive: true,
      'schedule.periods.teacherId': teacherId,
    })

    // Extract the teacher's schedule
    const teacherSchedule: {
      class: string
      section: string
      day: string
      periodNumber: number
      startTime: string
      endTime: string
      subject: string
      room?: string
    }[] = []

    for (const tt of timetables) {
      for (const day of tt.schedule) {
        for (const period of day.periods) {
          if (period.teacherId === teacherId && !period.isBreak) {
            teacherSchedule.push({
              class: tt.class,
              section: tt.section,
              day: day.day,
              periodNumber: period.periodNumber,
              startTime: period.startTime,
              endTime: period.endTime,
              subject: period.subject,
              room: period.room,
            })
          }
        }
      }
    }

    // Sort by day and period
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    teacherSchedule.sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
      if (dayDiff !== 0) return dayDiff
      return a.periodNumber - b.periodNumber
    })

    res.json({
      success: true,
      data: teacherSchedule,
      count: teacherSchedule.length,
    })
  } catch (error) {
    console.error('Get teacher timetable error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch teacher timetable' })
  }
}

// Helper: Generate default timetable template
export const generateTemplate = async (req: Request, res: Response) => {
  try {
    const { class: cls, section } = req.query

    // Get all active teachers
    const teachers = await Teacher.find({ isActive: true }).select('teacherId firstName lastName subjects')

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const periods = [
      { num: 1, start: '08:00', end: '08:45' },
      { num: 2, start: '08:45', end: '09:30' },
      { num: 3, start: '09:30', end: '10:15' },
      { num: 4, start: '10:30', end: '11:15' }, // After break
      { num: 5, start: '11:15', end: '12:00' },
      { num: 6, start: '12:00', end: '12:45' },
      { num: 7, start: '13:30', end: '14:15' }, // After lunch
    ]

    const template = {
      class: cls || '',
      section: section || '',
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      effectiveFrom: new Date(),
      schedule: days.map((day) => ({
        day,
        periods: periods.map((p) => ({
          periodNumber: p.num,
          startTime: p.start,
          endTime: p.end,
          subject: '',
          teacherId: '',
          teacherName: '',
          room: '',
          isBreak: false,
        })),
      })),
      availableTeachers: teachers.map((t: any) => ({
        teacherId: t.teacherId,
        name: t.fullName || `${t.firstName} ${t.lastName}`,
        subjects: t.subjects,
      })),
    }

    res.json({
      success: true,
      data: template,
    })
  } catch (error) {
    console.error('Generate template error:', error)
    res.status(500).json({ success: false, message: 'Failed to generate template' })
  }
}
