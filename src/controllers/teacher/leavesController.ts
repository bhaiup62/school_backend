import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import { LeaveRequest } from '../../models/teacher/LeaveRequest'
import { sseManager } from '../../lib/sseManager'
import { getTeacher } from './teacherHelpers'

// POST /api/teacher/leave-request
export const submitLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    const { leaveType, fromDate, toDate, reason } = req.body

    if (!leaveType || !fromDate || !toDate || !reason) {
      res.status(400).json({ success: false, message: 'leaveType, fromDate, toDate, and reason are required.' })
      return
    }

    const leaveRequest = await LeaveRequest.create({
      requestorId: teacher.teacherId,
      requestorName: `${teacher.firstName} ${teacher.lastName}`,
      requestorRole: 'teacher',
      department: teacher.subjects?.join(', ') || 'General',
      leaveType,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
    })

    sseManager.broadcast('leave_request_submitted', {
      requestId: leaveRequest._id,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
      leaveType,
      fromDate,
      toDate,
    }, 'principal')

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully.',
      data: leaveRequest,
    })
  } catch (err: any) {
    console.error('submitLeaveRequest error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/teacher/leave-requests
export const getMyLeaveRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    const { status, page = 1, limit = 20 } = req.query as any
    const filter: Record<string, any> = { requestorId: teacher.teacherId }
    if (status) filter.status = status

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const requests = await LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await LeaveRequest.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getMyLeaveRequests error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
