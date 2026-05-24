import { Response } from 'express'
import { Timetable } from '../../../models/principal/Timetable'
import ClassSubjectMapping from '../../../models/admin/ClassSubjectMapping'
import AcademicSession from '../../../models/admin/AcademicSession'
import ClassMaster from '../../../models/admin/ClassMaster'
import Teacher from '../../../models/teacher/Teacher'
import { AuthRequest } from '../../../middleware/authMiddleware'

export const upsertClassTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, section, dayOfWeek, periods } = req.body

    if (!classId || !section || !dayOfWeek || !Array.isArray(periods)) {
      res.status(400).json({ success: false, message: 'classId, section, dayOfWeek, and periods are required.' })
      return
    }

    const activeSession = await AcademicSession.findOne({ isCurrentSession: true })
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active session found.' })
      return
    }

    const classDoc = await ClassMaster.findById(classId)
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' })
      return
    }

    // Enterprise Normalizer: Extract "10" from "Class 10" to satisfy enum ['1'..'12']
    const match = classDoc.className.match(/\d+/)
    const classLevel = match ? match[0] : classDoc.className

    // 1. Prepare Validated Periods
    const populatedPeriods = []
    for (const p of periods) {
      if (!p.subjectId || !p.teacherId) continue

      const tchr = await Teacher.findById(p.teacherId)

      // 2. Collision Engine Check
      const collision = await Timetable.findOne({
        academicYear: activeSession.sessionName,
        $or: [{ class: { $ne: classLevel } }, { section: { $ne: section } }],
        schedule: {
          $elemMatch: {
            day: dayOfWeek,
            periods: {
              $elemMatch: { periodNumber: p.periodNumber, teacherId: p.teacherId }
            }
          }
        }
      })

      if (collision) {
         res.status(409).json({ 
             success: false, 
             message: `Collision Detected: ${tchr?.firstName || 'Teacher'} is already scheduled in another class during Period ${p.periodNumber} on ${dayOfWeek}.` 
         })
         return
      }

      populatedPeriods.push({
        periodNumber: p.periodNumber,
        startTime: p.startTime || "00:00",
        endTime: p.endTime || "00:00",
        subject: p.subjectId, // Store as String to bypass schema limits seamlessly
        teacherId: p.teacherId, // Store as String
        teacherName: tchr ? `${tchr.firstName} ${tchr.lastName}`.trim() : 'Unknown'
      })
    }

    // 3. Upsert Weekly Timetable Document
    let timetable = await Timetable.findOne({
      class: classLevel,
      section: section,
      academicYear: activeSession.sessionName
    })

    if (!timetable) {
      // Create new weekly document
      timetable = new Timetable({
        class: classLevel,
        section: section,
        academicYear: activeSession.sessionName,
        effectiveFrom: new Date(),
        schedule: [{ day: dayOfWeek, periods: populatedPeriods }],
       createdBy: req.user?.userId || 'ADMIN',
        createdByName: req.user?.admissionNumber || 'Admin',
      })
    } else {
      // Update existing weekly document
      const dayIndex = timetable.schedule.findIndex(s => s.day === dayOfWeek)
      if (dayIndex > -1) {
        timetable.schedule[dayIndex].periods = populatedPeriods
      } else {
        timetable.schedule.push({ day: dayOfWeek, periods: populatedPeriods })
      }
    }

    await timetable.save()

    res.status(200).json({ success: true, message: 'Timetable saved successfully.' })
  } catch (error: any) {
    console.error('upsertClassTimetable error:', error)
    res.status(500).json({ success: false, message: 'Server error saving class timetable.' })
  }
}

export const getAdminClassTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params
    const { section } = req.query

    const activeSession = await AcademicSession.findOne({ isCurrentSession: true })
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active session found.' })
      return
    }

    const classDoc = await ClassMaster.findById(classId)
    if (!classDoc) {
       res.status(404).json({ success: false, message: 'Class not found.' })
       return
    }

    const match = classDoc.className.match(/\d+/)
    const classLevel = match ? match[0] : classDoc.className

    const timetable = await Timetable.findOne({
      class: classLevel,
      section: section as string,
      academicYear: activeSession.sessionName
    })

    if (!timetable) {
      res.status(200).json({ success: true, data: [] })
      return
    }

    // ── THE ADAPTER ──
    // Converts your Weekly Database Document into the Daily Array format your frontend expects!
    const dailyDocs = timetable.schedule.map(daySch => {
      return {
        dayOfWeek: daySch.day,
        section: timetable.section,
        periods: daySch.periods.map(p => ({
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          subjectId: p.subject, // Map DB 'subject' string back to frontend 'subjectId'
          teacherId: p.teacherId
        }))
      }
    })

    res.status(200).json({ success: true, data: dailyDocs })
  } catch (error: any) {
    console.error('getAdminClassTimetable error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching timetable.' })
  }
}