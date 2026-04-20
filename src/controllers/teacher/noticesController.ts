import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Notice from '../../models/principal/Notice'
import { sseManager } from '../../lib/sseManager'
import { canAccessClass, getTeacher } from './teacherHelpers'

// POST /api/teacher/notices
export const postNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { title, content, tag, targetClass, targetSection } = req.body
    if (!title || !content) {
      res.status(400).json({ success: false, message: 'title and content are required.' })
      return
    }

    if (targetClass && targetClass !== 'ALL' && !canAccessClass(teacher, targetClass, targetSection)) {
      res.status(403).json({ success: false, message: 'You are not assigned to this class.' })
      return
    }

    const needsApproval = !targetClass || targetClass === 'ALL'
    const status = needsApproval ? 'pending' : 'approved'

    const notice = await Notice.create({
      title,
      content,
      tag: tag || 'general',
      priority: 'normal', // FIX 1: Safely hardcode priority to avoid Mongoose Enum crashes
      targetClass: targetClass || 'ALL',
      targetSection: targetSection || 'ALL',
      targetAudience: 'students',
      postedBy: teacher.fullName,
      postedById: teacher.teacherId,
      postedByRole: 'teacher',
      date: new Date().toISOString().split('T')[0],
      status,
      isActive: true,
      isDeleted: false,
      approvedBy: needsApproval ? null : teacher.teacherId,
      approvedAt: needsApproval ? null : new Date(),
    })

    if (needsApproval) {
      sseManager.broadcast('notice_pending_approval', {
        noticeId: notice._id,
        title: notice.title,
        teacherName: teacher.fullName,
        targetClass: notice.targetClass,
      }, 'principal')
    } else {
      sseManager.broadcastNotice({
        _id: notice._id.toString(),
        title: notice.title,
        tag: notice.tag,
        message: notice.content,
        targetClass: notice.targetClass,
        targetSection: notice.targetSection,
        postedBy: notice.postedBy,
        teacherId: notice.postedById,
        date: notice.date,
        createdAt: notice.createdAt,
      })
    }

    const responseMessage = needsApproval
      ? 'Notice submitted for principal approval.'
      : 'Notice posted successfully.'

    res.status(201).json({ success: true, message: responseMessage, data: notice })
  } catch (err: any) {
    console.error('postNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/teacher/notices
export const getNotices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    // FIX 3: Extract base class numbers (e.g., "10-A" -> "10") so teachers see whole-class notices
   const assignedClassesRaw = teacher.currentAssignedClasses || []
   const ctInfo = teacher.currentClassTeacherOf
    let baseClasses = assignedClassesRaw.map(c => String(c).includes('-') ? String(c).split('-')[0] : String(c))
    if (ctInfo) baseClasses.push(String(ctInfo.class))
    
    const uniqueBaseClasses = Array.from(new Set(baseClasses))

    const notices = await Notice.find({
      isActive: true,
      $or: [
        { postedById: teacher.teacherId }, // Notices I posted
        {
          targetClass: { $in: ['ALL', ...uniqueBaseClasses] }, // FIX 3 Applied here
          status: 'approved',
          isDeleted: { $ne: true },
        },
      ],
    }).sort({ createdAt: -1 }).limit(100)

    const formattedNotices = notices.map(n => ({
      _id: n._id,
      title: n.title,
      content: n.content,
      tag: n.tag,
      priority: n.priority,
      targetClass: n.targetClass,
      targetSection: n.targetSection,
      postedBy: n.postedBy,
      postedById: n.postedById,
      date: n.date,
      status: n.status,
      isDeleted: n.isDeleted,
      deletedByPrincipal: n.isDeleted && n.deletedByRole === 'principal',
      deletedByTeacher: n.isDeleted && n.deletedByRole === 'teacher',
      deletedAt: n.deletedAt,
      isOwn: n.postedById === teacher.teacherId,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }))

    res.status(200).json({ success: true, data: formattedNotices })
  } catch (err: any) {
    console.error('getNotices error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// DELETE /api/teacher/notices/:id (soft delete)
export const deleteNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { id } = req.params
    const notice = await Notice.findOne({ _id: id, postedById: teacher.teacherId })
    if (!notice) {
      res.status(404).json({ success: false, message: 'Notice not found or you are not authorized to delete it.' })
      return
    }

    notice.isDeleted = true
    notice.deletedBy = teacher.teacherId
    notice.deletedByRole = 'teacher'
    notice.deletedAt = new Date()
    await notice.save()

    res.status(200).json({ success: true, message: 'Notice deleted.' })
  } catch (err: any) {
    console.error('deleteNotice error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}