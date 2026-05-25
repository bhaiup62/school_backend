import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../../../middleware/authMiddleware'
import LeaveRequest from '../../../models/leave/LeaveRequest'
import LeaveBalance from '../../../models/leave/LeaveBalance'
import AcademicSession from '../../../models/admin/AcademicSession'

// IMPORTANT: Ensure this path correctly points to your User model!
import User from '../../../models/shared/User' 

const getLeaveBalanceField = (leaveType: string) => {
  if (leaveType === 'Casual') return 'casualLeaves'
  if (leaveType === 'Sick') return 'sickLeaves'
  if (leaveType === 'Earned') return 'earnedLeaves'
  return null
}

export const getAllLeaveRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const leaveType = typeof req.query.leaveType === 'string' ? req.query.leaveType : undefined

    const filter: Record<string, any> = {}
    if (status) filter.status = status
    if (leaveType) filter.leaveType = leaveType

    const requests = await LeaveRequest.find(filter)
      // FIX: Passing the actual User object instead of the string 'User'
      .populate({ path: 'staffId', model: User, select: 'admissionNumber role' })
      .populate({ path: 'approvedBy', model: User, select: 'admissionNumber role' })
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      data: requests,
      message: 'Leave requests fetched successfully.',
    })
  } catch (error: any) {
    // Better logging so you can see exactly why it failed in your backend terminal
    console.error('getAllLeaveRequests error:', error?.message || error)
    res.status(500).json({ success: false, message: 'Server error fetching leave requests.' })
  }
}

export const updateLeaveStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession()
  try {
    const { id } = req.params
    const { status, remarks } = req.body as { status?: string; remarks?: string }
    const adminUserId = (req.user as any)?._id || req.user?.userId

    if (!adminUserId) {
      res.status(401).json({ success: false, message: 'Unauthorized. Missing user context.' })
      return
    }
    if (!status || !['Approved', 'Rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status. Only Approved or Rejected allowed.' })
      return
    }

    const normalizedStatus = status as 'Approved' | 'Rejected'

    await session.withTransaction(async () => {
      const leaveRequest = await LeaveRequest.findById(id).session(session)
      if (!leaveRequest) {
        throw new Error('Leave request not found.')
      }

      if (leaveRequest.status === 'Approved' || leaveRequest.status === 'Rejected') {
        throw new Error('Cannot change processed leave requests.')
      }

      const activeSession = await AcademicSession.findOne({ isCurrentSession: true })
        .select('_id')
        .session(session)
      if (!activeSession) {
        throw new Error('No active academic session found.')
      }

      const balanceField = normalizedStatus === 'Approved' ? getLeaveBalanceField(leaveRequest.leaveType) : null
      if (balanceField) {
        const balance = await LeaveBalance.findOne({
          staffId: leaveRequest.staffId,
          academicSession: activeSession._id,
        }).session(session)

        if (!balance) {
          throw new Error('Leave balance not found.')
        }

        const balanceData = (balance as any)[balanceField]
        const remaining = (balanceData?.total || 0) - (balanceData?.used || 0)

        if (remaining < leaveRequest.totalDays) {
          throw new Error('Insufficient leave balance')
        }

        (balance as any)[balanceField].used = (balanceData?.used || 0) + leaveRequest.totalDays
        await balance.save({ session })
      }

      leaveRequest.status = normalizedStatus
      leaveRequest.remarks = remarks ?? leaveRequest.remarks
      leaveRequest.approvedBy = adminUserId
      await leaveRequest.save({ session })
    })

    res.status(200).json({
      success: true,
      message: 'Leave status updated successfully.',
    })
  } catch (error: any) {
    console.error('updateLeaveStatus error:', error)
    res.status(500).json({ success: false, message: error?.message || 'Server error updating leave status.' })
  } finally {
    session.endSession()
  }
}

export const getStaffOnLeaveToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    const requests = await LeaveRequest.find({
      status: 'Approved',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    })
    // FIX applied here too
    .populate({ path: 'staffId', model: User, select: 'admissionNumber role' })

    res.status(200).json({
      success: true,
      data: requests,
      message: 'Staff on leave fetched successfully.',
    })
  } catch (error: any) {
    console.error('getStaffOnLeaveToday error:', error?.message || error)
    res.status(500).json({ success: false, message: 'Server error fetching staff on leave.' })
  }
}

export const getLeaveBalances = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activeSession = await AcademicSession.findOne({ isCurrentSession: true }).select('_id')
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    const balances = await LeaveBalance.find({ academicSession: activeSession._id })
      // FIX applied here too
      .populate({ path: 'staffId', model: User, select: 'admissionNumber role' })

    res.status(200).json({
      success: true,
      data: balances,
      message: 'Leave balances fetched successfully.',
    })
  } catch (error: any) {
    console.error('getLeaveBalances error:', error?.message || error)
    res.status(500).json({ success: false, message: 'Server error fetching leave balances.' })
  }
}