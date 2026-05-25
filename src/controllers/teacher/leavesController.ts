import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import LeaveRequest from '../../models/leave/LeaveRequest'
import LeaveBalance from '../../models/leave/LeaveBalance'
import AcademicSession from '../../models/admin/AcademicSession'
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

    const normalizeLeaveType = (raw: string): 'Casual' | 'Sick' | 'Earned' | 'Maternity' | 'LWP' => {
      const lower = raw.toLowerCase()
      if (lower === 'other') return 'LWP'
      if (lower === 'casual') return 'Casual'
      if (lower === 'sick') return 'Sick'
      if (lower === 'earned') return 'Earned'
      if (lower === 'maternity') return 'Maternity'
      if (lower === 'lwp') return 'LWP'
      return (raw.charAt(0).toUpperCase() + raw.slice(1)) as any
    }

    const normalizedLeaveType = normalizeLeaveType(leaveType)
    const totalDays =
      Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1

    const activeSession = await AcademicSession.findOne({ isCurrentSession: true }).select('_id')
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    if (['Casual', 'Sick', 'Earned'].includes(normalizedLeaveType)) {
      const balance = await LeaveBalance.findOne({
        staffId: teacher.user,
        academicSession: activeSession._id,
      })

      const balanceField =
        normalizedLeaveType === 'Casual'
          ? 'casualLeaves'
          : normalizedLeaveType === 'Sick'
            ? 'sickLeaves'
            : 'earnedLeaves'

      const total = (balance as any)?.[balanceField]?.total ?? 0
      const used = (balance as any)?.[balanceField]?.used ?? 0
      if (total - used < totalDays) {
        res.status(400).json({ success: false, message: 'Insufficient leave balance for this request.' })
        return
      }
    }

    const leaveRequest = await LeaveRequest.create({
      staffId: teacher.user,
      leaveType: normalizedLeaveType,
      startDate: new Date(fromDate),
      endDate: new Date(toDate),
      totalDays,
      reason,
    })

    sseManager.broadcast('leave_request_submitted', {
      requestId: leaveRequest._id,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
      leaveType: normalizedLeaveType,
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
    const filter: Record<string, any> = { staffId: teacher.user }
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

export const getMyLeaveBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    const activeSession = await AcademicSession.findOne({ isCurrentSession: true }).select('_id')
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    let balance = await LeaveBalance.findOne({
      staffId: teacher.user,
      academicSession: activeSession._id,
    })
    if (!balance) {
      balance = await LeaveBalance.create({
        staffId: teacher.user,
        academicSession: activeSession._id,
        casualLeaves: { total: 12, used: 0 },
        sickLeaves: { total: 10, used: 0 },
        earnedLeaves: { total: 15, used: 0 },
      })
    }

    res.status(200).json({
      success: true,
      data: balance,
      message: 'Leave balance fetched successfully.',
    })
  } catch (err: any) {
    console.error('getMyLeaveBalance error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
