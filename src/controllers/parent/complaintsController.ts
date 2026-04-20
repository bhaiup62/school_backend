import { Response } from 'express'
import Parent from '../../models/parent/Parent'
import Student from '../../models/student/Student'
import Complaint from '../../models/parent/Complaint'
import { AuthRequest } from '../../middleware/authMiddleware'

// POST /api/parent/complaints
export const submitComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.user!.admissionNumber,
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    const { category, subject, description, relatedStudent, relatedTeacher, priority } = req.body

    if (!category || !subject || !description) {
      res.status(400).json({ success: false, message: 'Category, subject, and description are required.' })
      return
    }

    let studentId = undefined
    let studentClass = ''
    let studentSection = ''
    let session = ''

    if (relatedStudent && relatedStudent.trim() !== '') {
      const studentRecord = await Student.findOne({
        admissionNumber: relatedStudent.trim().toUpperCase(),
        isActive: true,
      })

      if (!studentRecord) {
        res
          .status(400)
          .json({ success: false, message: `No active student found with Admission Number: ${relatedStudent}` })
        return
      }

      studentId = studentRecord._id
      studentClass = studentRecord.currentClass
      studentSection = studentRecord.currentSection
      session = studentRecord.currentSession || '2024-25'
    }

    const count = await Complaint.countDocuments()
    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${String(count + 1).padStart(4, '0')}`

    const complaint = new Complaint({
      ticketNumber,
      category,
      subject,
      description,
      raisedBy: parent._id,
      raisedByRole: 'parent',
      raisedByName: `${parent.firstName} ${parent.lastName}`,
      raisedByContact: parent.phone || '',
      relatedStudent: studentId,
      studentClassAtTime: studentClass,
      studentSectionAtTime: studentSection,
      sessionAtTime: session,
      againstType: relatedTeacher ? 'teacher' : 'none',
      againstPersonName: relatedTeacher || '',
      priority: priority || 'medium',
    })

    await complaint.save()

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      data: complaint,
    })
  } catch (err: any) {
    console.error('submitComplaint error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/parent/complaints
export const getMyComplaints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.user!.admissionNumber,
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    const { status, page = 1, limit = 20 } = req.query as any

    const filter: Record<string, any> = {
      raisedBy: parent._id,
    }
    if (status) filter.status = status

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))

    const total = await Complaint.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getMyComplaints error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/parent/complaints/:ticketNumber
export const getComplaintDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.user!.admissionNumber,
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    const complaint = await Complaint.findOne({
      ticketNumber: req.params.ticketNumber,
      raisedBy: parent._id,
    })

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' })
      return
    }

    res.status(200).json({ success: true, data: complaint })
  } catch (err: any) {
    console.error('getComplaintDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// POST /api/parent/complaints/:ticketNumber/comments
export const addComplaintComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.user!.admissionNumber,
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    const { text } = req.body
    if (!text) {
      res.status(400).json({ success: false, message: 'Comment text is required.' })
      return
    }

    const complaint = await Complaint.findOne({
      ticketNumber: req.params.ticketNumber,
      raisedBy: parent._id,
    })

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' })
      return
    }

    complaint.comments.push({
      author: parent._id,
      authorRole: 'parent',
      authorName: `${parent.firstName} ${parent.lastName}`,
      message: text,
      createdAt: new Date(),
    } as any)

    await complaint.save()

    res.status(200).json({
      success: true,
      message: 'Comment added.',
      data: complaint,
    })
  } catch (err: any) {
    console.error('addComplaintComment error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
