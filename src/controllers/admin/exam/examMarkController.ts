import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../../../middleware/authMiddleware'
import ExamMark from '../../../models/admin/exam/ExamMark'
import ExamSchedule from '../../../models/admin/exam/ExamSchedule'
import Student from '../../../models/student/Student'
import ClassMaster from '../../../models/admin/ClassMaster'

export const getMarksEntrySheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const examId = typeof req.query.examId === 'string' ? req.query.examId : ''
    const classId = typeof req.query.classId === 'string' ? req.query.classId : ''
    const section = typeof req.query.section === 'string' ? req.query.section : ''
    const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : ''

    if (!examId || !classId || !section || !subjectId) {
      res.status(400).json({ success: false, message: 'examId, classId, section, and subjectId are required.' })
      return
    }

    const classDoc = await ClassMaster.findById(classId).select('className')
    if (!classDoc) {
      res.status(404).json({ success: false, message: 'Class not found.' })
      return
    }

    const students = await Student.find({
      currentClass: classDoc.className,
      currentSection: section,
    })

    const marks = await ExamMark.find({ examId, classId, subjectId })
    const marksMap = new Map<string, typeof marks[number]>()
    marks.forEach((mark) => marksMap.set(String(mark.studentId), mark))

    const data = students.map((student) => ({
      student,
      marks: marksMap.get(String(student._id)) || null,
    }))

    res.status(200).json({
      success: true,
      data,
      message: 'Marks entry sheet fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getMarksEntrySheet error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching marks entry sheet.' })
  }
}

export const bulkSaveMarks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId, classId, subjectId, marksData } = req.body as {
      examId?: string
      classId?: string
      subjectId?: string
      marksData?: Array<{
        studentId: string
        theoryMarksObtained?: number | null
        practicalMarksObtained?: number | null
        isAbsent?: boolean
        remarks?: string
      }>
    }

    if (!examId || !classId || !subjectId || !Array.isArray(marksData)) {
      res.status(400).json({ success: false, message: 'examId, classId, subjectId, and marksData are required.' })
      return
    }

    const enteredBy = (req.user as any)?._id || req.user?.userId
    if (!enteredBy) {
      res.status(401).json({ success: false, message: 'Unauthorized. Missing user context.' })
      return
    }

    const schedule = await ExamSchedule.findOne({ examId, classId, subjectId }).select('maxMarks')
    if (!schedule) {
      res.status(404).json({ success: false, message: 'Exam schedule not found.' })
      return
    }

    for (const item of marksData) {
      const theoryMarks = typeof item.theoryMarksObtained === 'number' ? item.theoryMarksObtained : null
      if (!item.isAbsent && theoryMarks !== null && theoryMarks > schedule.maxMarks) {
        res.status(400).json({ success: false, message: 'Marks cannot exceed max marks.' })
        return
      }

      await ExamMark.findOneAndUpdate(
        { examId, classId, subjectId, studentId: item.studentId },
        {
          $set: {
            ...item,
            examId: new mongoose.Types.ObjectId(examId),
            classId: new mongoose.Types.ObjectId(classId),
            subjectId: new mongoose.Types.ObjectId(subjectId),
            enteredBy,
          },
        },
        { upsert: true, new: true }
      )
    }

    res.status(200).json({
      success: true,
      message: 'Marks saved successfully.',
    })
  } catch (error: unknown) {
    console.error('bulkSaveMarks error:', error)
    res.status(500).json({ success: false, message: 'Server error saving marks.' })
  }
}
