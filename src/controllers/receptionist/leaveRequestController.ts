// src/controllers/receptionist/leaveRequestController.ts

import { Response } from 'express'
import { LeaveRequest } from '../../models/teacher/LeaveRequest'
import { AuthRequest, getReceptionist } from './receptionistHelpers'

// POST /api/receptionist/leave-requests
export const submitLeaveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receptionist = await getReceptionist(req.user!.admissionNumber)
    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found.' })
      return
    }

    const { leaveType, fromDate, toDate, reason } = req.body

    if (!leaveType || !fromDate || !toDate || !reason) {
      res.status(400).json({ success: false, message: 'leaveType, fromDate, toDate, and reason are required.' })
      return
    }

    const leaveRequest = await LeaveRequest.create({
      requestorId: receptionist.receptionistId,
      requestorName: `${receptionist.firstName} ${receptionist.lastName}`,
      requestorRole: 'receptionist',
      department: 'Front Desk', // Reception department
      leaveType,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
    })

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

// GET /api/receptionist/leave-requests
export const getMyLeaveRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receptionist = await getReceptionist(req.user!.admissionNumber)
    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found.' })
      return
    }

    const { status, page = 1, limit = 20 } = req.query as any

    const filter: Record<string, any> = { requestorId: receptionist.receptionistId }
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