// src/controllers/principal/approvalsController.ts
// Certificate approvals and requests management for Principal
// ═══════════════════════════════════════════════════════════════════════════════
// Production-ready with atomic operations to prevent race conditions
// ═══════════════════════════════════════════════════════════════════════════════

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import { CertificateRequest } from '../../models/principal/CertificateRequest'
import { LeaveRequest } from '../../models/teacher/LeaveRequest'
import { Counter } from '../../models/shared/Counter'

const getISTDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

// ═══════════════════════════════════════════════════════════
// CERTIFICATE REQUESTS
// ═══════════════════════════════════════════════════════════

// GET /api/principal/approvals/certificates
export const getCertificateRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query as any

    const filter: Record<string, any> = {}
    if (status) filter.status = status
    if (type) filter.type = type

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Single aggregation for efficiency
    const [result] = await CertificateRequest.aggregate([
      {
        $facet: {
          requests: [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
          ],
          totalCount: [{ $match: filter }, { $count: 'count' }],
          pendingCount: [{ $match: { status: 'pending' } }, { $count: 'count' }],
        },
      },
    ])

    const requests = result.requests
    const total = result.totalCount[0]?.count || 0
    const pendingCount = result.pendingCount[0]?.count || 0

    res.status(200).json({
      success: true,
      data: requests,
      pendingCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err: any) {
    console.error('getCertificateRequests error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/principal/approvals/certificates/:requestId/approve
// FIX #2 & #3: Atomic certificate number generation + atomic status update
// ═══════════════════════════════════════════════════════════════════════════════
export const approveCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requestId } = req.params
    const approvedBy = req.user!.admissionNumber
    const now = getISTDate()
    const year = now.getFullYear()

    // First, atomically claim this request (prevents double-approval race condition)
    // Only update if status is still 'pending'
    const request = await CertificateRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      { $set: { status: 'processing' } }, // Temporary state to lock the record
      { new: false } // Return original to get the type
    )

    if (!request) {
      // Either not found or already processed
      const exists = await CertificateRequest.findById(requestId)
      if (!exists) {
        res.status(404).json({ success: false, message: 'Request not found.' })
      } else {
        res.status(400).json({ success: false, message: 'Request already processed.' })
      }
      return
    }

    // FIX #2: Atomic certificate number generation using Counter model
    // Prefix based on certificate type: BON, CHA, TRA, MIG
    const typePrefix = request.type.toUpperCase().slice(0, 3)
    const certificateNumber = await Counter.getNextSequence(typePrefix, year)

    // Atomic update with all approval data
    const updated = await CertificateRequest.findOneAndUpdate(
      { _id: requestId, status: 'processing' },
      {
        $set: {
          status: 'approved',
          approvedBy,
          approvedAt: now,
          certificateNumber,
        },
      },
      { new: true }
    )

    if (!updated) {
      // Edge case: record was modified between our operations (shouldn't happen)
      res.status(500).json({ success: false, message: 'Concurrent modification error.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Certificate approved.',
      data: {
        certificateNumber: updated.certificateNumber,
        type: updated.type,
        studentName: updated.studentName,
        studentId: updated.studentId,
        approvedAt: updated.approvedAt,
      },
    })
  } catch (err: any) {
    console.error('approveCertificate error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/principal/approvals/certificates/:requestId/reject
// FIX #3: Atomic update instead of findById + save
// ═══════════════════════════════════════════════════════════════════════════════
export const rejectCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const { requestId } = req.params

    // Atomic update: only reject if still pending
    const result = await CertificateRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason || 'No reason provided',
        },
      },
      { new: true }
    )

    if (!result) {
      const exists = await CertificateRequest.findById(requestId)
      if (!exists) {
        res.status(404).json({ success: false, message: 'Request not found.' })
      } else {
        res.status(400).json({ success: false, message: 'Request already processed.' })
      }
      return
    }

    res.status(200).json({
      success: true,
      message: 'Certificate request rejected.',
      data: { _id: result._id, status: result.status },
    })
  } catch (err: any) {
    console.error('rejectCertificate error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// LEAVE REQUESTS
// ═══════════════════════════════════════════════════════════

// GET /api/principal/approvals/leaves
export const getLeaveRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query as any

    const filter: Record<string, any> = {}
    if (status) filter.status = status

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Single aggregation for efficiency
    const [result] = await LeaveRequest.aggregate([
      {
        $facet: {
          requests: [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
          ],
          totalCount: [{ $match: filter }, { $count: 'count' }],
          pendingCount: [{ $match: { status: 'pending' } }, { $count: 'count' }],
        },
      },
    ])

    const requests = result.requests
    const total = result.totalCount[0]?.count || 0
    const pendingCount = result.pendingCount[0]?.count || 0

    res.status(200).json({
      success: true,
      data: requests,
      pendingCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err: any) {
    console.error('getLeaveRequests error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/principal/approvals/leaves/:requestId/approve
// FIX #3: Atomic update instead of findById + save
// ═══════════════════════════════════════════════════════════════════════════════
export const approveLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requestId } = req.params
    const approvedBy = req.user!.admissionNumber
    const now = getISTDate()

    // Atomic update: only approve if still pending
    const result = await LeaveRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      {
        $set: {
          status: 'approved',
          approvedBy,
          approvedAt: now,
        },
      },
      { new: true }
    )

    if (!result) {
      const exists = await LeaveRequest.findById(requestId)
      if (!exists) {
        res.status(404).json({ success: false, message: 'Request not found.' })
      } else {
        res.status(400).json({ success: false, message: 'Request already processed.' })
      }
      return
    }

    res.status(200).json({
      success: true,
      message: 'Leave approved.',
      data: result,
    })
  } catch (err: any) {
    console.error('approveLeave error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/principal/approvals/leaves/:requestId/reject
// FIX #3: Atomic update instead of findById + save
// ═══════════════════════════════════════════════════════════════════════════════
export const rejectLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const { requestId } = req.params

    // Atomic update: only reject if still pending
    const result = await LeaveRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason || 'No reason provided',
        },
      },
      { new: true }
    )

    if (!result) {
      const exists = await LeaveRequest.findById(requestId)
      if (!exists) {
        res.status(404).json({ success: false, message: 'Request not found.' })
      } else {
        res.status(400).json({ success: false, message: 'Request already processed.' })
      }
      return
    }

    res.status(200).json({
      success: true,
      message: 'Leave request rejected.',
      data: { _id: result._id, status: result.status },
    })
  } catch (err: any) {
    console.error('rejectLeave error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PENDING APPROVALS SUMMARY
// ═══════════════════════════════════════════════════════════

// GET /api/principal/approvals/summary
export const getApprovalsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Optimized: single aggregation per collection with $facet
    const [certResult, leaveResult] = await Promise.all([
      CertificateRequest.aggregate([
        {
          $facet: {
            pendingCount: [{ $match: { status: 'pending' } }, { $count: 'count' }],
            recentPending: [
              { $match: { status: 'pending' } },
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { type: 1, studentName: 1, studentId: 1, class: 1, section: 1, createdAt: 1 } },
            ],
          },
        },
      ]),
      LeaveRequest.aggregate([
        {
          $facet: {
            pendingCount: [{ $match: { status: 'pending' } }, { $count: 'count' }],
            recentPending: [
              { $match: { status: 'pending' } },
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: { requestorName: 1, requestorRole: 1, leaveType: 1, fromDate: 1, toDate: 1, createdAt: 1 } },
            ],
          },
        },
      ]),
    ])

    const pendingCertificates = certResult[0]?.pendingCount[0]?.count || 0
    const pendingLeaves = leaveResult[0]?.pendingCount[0]?.count || 0

    res.status(200).json({
      success: true,
      data: {
        pendingCounts: {
          certificates: pendingCertificates,
          leaves: pendingLeaves,
          total: pendingCertificates + pendingLeaves,
        },
        recentPending: {
          certificates: certResult[0]?.recentPending || [],
          leaves: leaveResult[0]?.recentPending || [],
        },
      },
    })
  } catch (err: any) {
    console.error('getApprovalsSummary error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
