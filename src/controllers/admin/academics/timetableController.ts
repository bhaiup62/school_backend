import { Response } from 'express'
import { Timetable } from '../../../models/principal/Timetable'
import ClassSubjectMapping from '../../../models/admin/ClassSubjectMapping'
import AcademicSession from '../../../models/admin/AcademicSession'
import { AuthRequest } from '../../../middleware/authMiddleware'

interface IIncomingPeriod {
  periodNumber: number
  startTime?: string
  endTime?: string
  subjectId?: string
  teacherId?: string
}

const normalizeId = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

export const upsertClassTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, dayOfWeek, periods } = req.body as {
      classId?: string
      dayOfWeek?: string
      periods?: IIncomingPeriod[]
    }

    if (!classId || !dayOfWeek || !Array.isArray(periods)) {
      res.status(400).json({
        success: false,
        message: 'classId, dayOfWeek, and periods are required.',
      })
      return
    }

    const activeSession = await AcademicSession.findOne({ isCurrentSession: true }).select('_id')
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    const mappingDocs = await ClassSubjectMapping.find({
      classId,
      academicSession: activeSession._id,
      isDeleted: false,
    }).lean()

    if (!mappingDocs.length) {
      res.status(400).json({ success: false, message: 'No subjects are mapped to this class yet.' })
      return
    }

    const hasValidMapping = (subjectId: string, teacherId: string): boolean => {
      for (const mappingDoc of mappingDocs as any[]) {
        // Supports both legacy structure (one subject per doc) and nested subjects[] structure.
        if (Array.isArray(mappingDoc.subjects)) {
          for (const mappedSubject of mappingDoc.subjects) {
            const mappedSubjectId = normalizeId(mappedSubject.subjectId || mappedSubject.subject)
            const teachers = Array.isArray(mappedSubject.teachers)
              ? mappedSubject.teachers
              : mappedSubject.teacher
                ? [mappedSubject.teacher]
                : []
            const teacherIds = teachers.map((teacher: unknown) => normalizeId(teacher))
            if (mappedSubjectId === subjectId && teacherIds.includes(teacherId)) {
              return true
            }
          }
        } else {
          const mappedSubjectId = normalizeId((mappingDoc as any).subjectId)
          const mappedTeacherIds = (Array.isArray((mappingDoc as any).teachers) ? (mappingDoc as any).teachers : []).map(
            (teacher: unknown) => normalizeId(teacher)
          )
          if (mappedSubjectId === subjectId && mappedTeacherIds.includes(teacherId)) {
            return true
          }
        }
      }
      return false
    }

    for (const period of periods) {
      const subjectId = normalizeId(period.subjectId)
      const teacherId = normalizeId(period.teacherId)
      if (!subjectId || !teacherId) continue

      if (!hasValidMapping(subjectId, teacherId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid Teacher-Subject mapping detected.',
        })
        return
      }
    }

    for (const period of periods) {
      const teacherId = normalizeId(period.teacherId)
      if (!teacherId) continue

      const collision = await (Timetable as any).findOne({
        academicSession: activeSession._id,
        classId: { $ne: classId },
        dayOfWeek,
        periods: {
          $elemMatch: {
            periodNumber: period.periodNumber,
            teacherId,
          },
        },
      }).select('_id')

      if (collision) {
        res.status(409).json({
          success: false,
          message: 'Collision Detected! This teacher is already booked in another class for this period.',
        })
        return
      }
    }

    const timetable = await (Timetable as any).findOneAndUpdate(
      {
        academicSession: activeSession._id,
        classId,
        dayOfWeek,
      },
      {
        $set: {
          academicSession: activeSession._id,
          classId,
          dayOfWeek,
          periods,
          updatedBy: req.user?.admissionNumber,
          updatedByName: req.user?.admissionNumber,
        },
        $setOnInsert: {
          createdBy: req.user?.admissionNumber,
          createdByName: req.user?.admissionNumber,
          isActive: true,
        },
      },
      { new: true, upsert: true }
    )

    res.status(200).json({
      success: true,
      message: 'Timetable saved successfully.',
      data: timetable,
    })
  } catch (error: unknown) {
    console.error('upsertClassTimetable error:', error)
    res.status(500).json({ success: false, message: 'Server error saving class timetable.' })
  }
}

export const getAdminClassTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params

    if (!classId) {
      res.status(400).json({ success: false, message: 'classId is required.' })
      return
    }

    const activeSession = await AcademicSession.findOne({ isCurrentSession: true }).select('_id')
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    const timetables = await (Timetable as any)
      .find({
        academicSession: activeSession._id,
        classId,
      })
      .populate({ path: 'periods.subjectId', select: 'subjectName', strictPopulate: false })
      .populate({ path: 'periods.teacherId', select: 'firstName lastName employeeId', strictPopulate: false })
      .sort({ dayOfWeek: 1 })

    res.status(200).json({
      success: true,
      data: timetables,
      message: 'Timetable fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getAdminClassTimetable error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching class timetable.' })
  }
}
