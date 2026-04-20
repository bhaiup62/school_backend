// src/controllers/principal/noticesController.ts
// Notices management for Principal - full CRUD with approval workflow

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Notice from '../../models/principal/Notice'
import Teacher from '../../models/teacher/Teacher'
import Principal from '../../models/principal/Principal'
import { sseManager } from '../../lib/sseManager'

// Priority options for notices
const PRIORITY_OPTIONS = ['general', 'academic', 'event', 'holiday', 'exam', 'sports', 'high', 'normal', 'urgent']

// ═══════════════════════════════════════════════════════════
// GET /api/principal/notices
// List all notices with filters (including deleted for history)
// ═══════════════════════════════════════════════════════════
export const getAllNotices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, showDeleted, page = 1, limit = 50 } = req.query as any

    const filter: Record<string, any> = {}

    // Status filter
    if (status && status !== 'all') {
      filter.status = status
    }

    // Priority filter
    if (priority && priority !== 'all') {
      filter.priority = priority
    }

    // By default, don't show deleted unless requested
    if (showDeleted === 'true') {
      // Show all including deleted
    } else if (showDeleted === 'only') {
      filter.isDeleted = true
    } else {
      filter.isDeleted = { $ne: true }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const notices = await Notice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()

    const total = await Notice.countDocuments(filter)
    const pendingCount = await Notice.countDocuments({ status: 'pending', isDeleted: { $ne: true } })

    res.status(200).json({
      success: true,
      data: notices,
      pendingCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getAllNotices error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/notices/:noticeId
// Get single notice with creator details
// ═══════════════════════════════════════════════════════════
export const getNoticeDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notice = await Notice.findById(req.params.noticeId).lean()

    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found.' })
      return
    }

    // Get creator details
    let creatorDetails: any = null
    if (notice.postedByRole === 'teacher') {
      const teacher = await Teacher.findOne({ teacherId: notice.postedById })
        .select('teacherId firstName lastName email phone subjects currentAssignedClasses currentClassTeacherOf')
        .lean()
      if (teacher) {
        creatorDetails = {
          id: teacher.teacherId,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          phone: teacher.phone,
          role: 'Teacher',
          subjects: teacher.subjects,
          assignedClasses: teacher.currentAssignedClasses,
          classTeacherOf: teacher.currentClassTeacherOf,
        }
      }
    } else if (notice.postedByRole === 'principal') {
      const principal = await Principal.findOne({ principalId: notice.postedById })
        .select('principalId firstName lastName email phone')
        .lean()
      if (principal) {
        creatorDetails = {
          id: principal.principalId,
          name: `${principal.firstName} ${principal.lastName}`,
          email: principal.email,
          phone: principal.phone,
          role: 'Principal',
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...notice,
        creatorDetails,
      },
    })
  } catch (err: any) {
    console.error('getNoticeDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/principal/notices
// Create a new notice (auto-approved for principal)
// ═══════════════════════════════════════════════════════════
export const createNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      content,
      priority = 'normal',
      targetAudience = 'all',
      targetClass = 'ALL',
      targetSection = 'ALL',
      expiryDate,
    } = req.body

    if (!title || !content) {
      res.status(400).json({
        success: false,
        message: 'Title and content are required.',
      })
      return
    }

    // Validate priority
    if (!PRIORITY_OPTIONS.includes(priority)) {
      res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${PRIORITY_OPTIONS.join(', ')}`,
      })
      return
    }

    // Get principal name
    const principal = await Principal.findOne({ principalId: req.user!.admissionNumber })
    const principalName = principal 
      ? `${principal.firstName} ${principal.lastName}` 
      : 'Principal'

    const notice = await Notice.create({
      title,
      content,
      tag: priority === 'urgent' ? 'urgent' : 'general',
      priority,
      targetAudience,
      targetClass,
      targetSection,
      postedBy: principalName,
      postedById: req.user!.admissionNumber,
      postedByRole: 'principal',
      status: 'approved', // Auto-approved for principal
      approvedBy: req.user!.admissionNumber,
      approvedAt: new Date(),
      publishDate: new Date(),
      expiresAt: expiryDate ? new Date(expiryDate) : null,
      isActive: true,
      isDeleted: false,
    })

    // Broadcast to all relevant users
    sseManager.broadcast('notice_created', {
      noticeId: notice._id,
      title: notice.title,
      priority: notice.priority,
      targetAudience: notice.targetAudience,
      targetClass: notice.targetClass,
    })

    res.status(201).json({
      success: true,
      message: 'Notice created and published successfully.',
      data: notice,
    })
  } catch (err: any) {
    console.error('createNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/notices/pending
// Get notices pending approval (from teachers)
// ═══════════════════════════════════════════════════════════
export const getPendingNotices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notices = await Notice.find({
      status: 'pending',
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean()

    res.status(200).json({
      success: true,
      data: notices,
      count: notices.length,
    })
  } catch (err: any) {
    console.error('getPendingNotices error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PATCH /api/principal/notices/:noticeId/approve
// Approve a pending notice
// ═══════════════════════════════════════════════════════════
export const approveNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notice = await Notice.findById(req.params.noticeId)

    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found.' })
      return
    }

    if (notice.status === 'approved') {
      res.status(400).json({ success: false, message: 'Notice already approved.' })
      return
    }

    notice.status = 'approved'
    notice.approvedBy = req.user!.admissionNumber
    notice.approvedAt = new Date()
    notice.publishDate = new Date()
    await notice.save()

    // Broadcast approval
    sseManager.broadcast('notice_approved', {
      noticeId: notice._id,
      title: notice.title,
    })

    // Notify the teacher who created it
    sseManager.sendToUser(notice.postedById, 'notice_status_changed', {
      noticeId: notice._id,
      title: notice.title,
      status: 'approved',
    })

    res.status(200).json({
      success: true,
      message: 'Notice approved successfully.',
      data: notice,
    })
  } catch (err: any) {
    console.error('approveNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PATCH /api/principal/notices/:noticeId/reject
// Reject a pending notice
// ═══════════════════════════════════════════════════════════
export const rejectNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const notice = await Notice.findById(req.params.noticeId)

    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found.' })
      return
    }

    if (notice.status === 'rejected') {
      res.status(400).json({ success: false, message: 'Notice already rejected.' })
      return
    }

    notice.status = 'rejected'
    notice.rejectionReason = reason || 'No reason provided'
    await notice.save()

    // Notify the teacher who created it
    sseManager.sendToUser(notice.postedById, 'notice_status_changed', {
      noticeId: notice._id,
      title: notice.title,
      status: 'rejected',
      reason: notice.rejectionReason,
    })

    res.status(200).json({
      success: true,
      message: 'Notice rejected.',
      data: notice,
    })
  } catch (err: any) {
    console.error('rejectNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/principal/notices/:noticeId
// Soft delete a notice (principal can delete any notice)
// ═══════════════════════════════════════════════════════════
export const deleteNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notice = await Notice.findById(req.params.noticeId)

    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found.' })
      return
    }

    // Soft delete
    notice.isDeleted = true
    notice.deletedBy = req.user!.admissionNumber
    notice.deletedByRole = 'principal'
    notice.deletedAt = new Date()
    notice.isActive = false
    await notice.save()

    // Broadcast deletion
    sseManager.broadcast('notice_deleted', {
      noticeId: notice._id,
      deletedBy: 'principal',
    })

    // Notify the teacher if they created it
    if (notice.postedByRole === 'teacher') {
      sseManager.sendToUser(notice.postedById, 'notice_deleted_by_principal', {
        noticeId: notice._id,
        title: notice.title,
      })
    }

    res.status(200).json({
      success: true,
      message: 'Notice deleted successfully.',
    })
  } catch (err: any) {
    console.error('deleteNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PATCH /api/principal/notices/:noticeId
// Update a notice
// ═══════════════════════════════════════════════════════════
export const updateNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, priority, targetAudience, targetClass, targetSection, expiryDate } = req.body
    const notice = await Notice.findById(req.params.noticeId)

    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found.' })
      return
    }

    if (title) notice.title = title
    if (content) notice.content = content
    if (priority && PRIORITY_OPTIONS.includes(priority)) notice.priority = priority
    if (targetAudience) notice.targetAudience = targetAudience
    if (targetClass) notice.targetClass = targetClass
    if (targetSection) notice.targetSection = targetSection
    if (expiryDate) notice.expiresAt = new Date(expiryDate)

    await notice.save()

    // Broadcast update
    sseManager.broadcast('notice_updated', {
      noticeId: notice._id,
      title: notice.title,
    })

    res.status(200).json({
      success: true,
      message: 'Notice updated successfully.',
      data: notice,
    })
  } catch (err: any) {
    console.error('updateNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PATCH /api/principal/notices/:noticeId/restore
// Restore a deleted notice
// ═══════════════════════════════════════════════════════════
export const restoreNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notice = await Notice.findById(req.params.noticeId)

    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found.' })
      return
    }

    if (!notice.isDeleted) {
      res.status(400).json({ success: false, message: 'Notice is not deleted.' })
      return
    }

    notice.isDeleted = false
    notice.deletedBy = null
    notice.deletedByRole = null
    notice.deletedAt = null
    notice.isActive = true
    await notice.save()

    res.status(200).json({
      success: true,
      message: 'Notice restored successfully.',
      data: notice,
    })
  } catch (err: any) {
    console.error('restoreNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

