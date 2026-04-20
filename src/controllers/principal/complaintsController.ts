// src/controllers/principal/complaintsController.ts
// Grievance & Helpdesk Escalation for Principal
// ═══════════════════════════════════════════════════════════════════════════════
// Production-ready with atomic operations and optimized aggregations
// ═══════════════════════════════════════════════════════════════════════════════

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Complaint, { COMPLAINT_CATEGORIES, ComplaintCategory } from '../../models/parent/Complaint'
import { Counter } from '../../models/shared/Counter'
import Principal from '../../models/principal/Principal'
import Teacher from '../../models/teacher/Teacher'
import Student from '../../models/student/Student'
import mongoose from 'mongoose'

// ═══════════════════════════════════════════════════════════
// GET /api/principal/complaints
// Get all complaints with filters
// ═══════════════════════════════════════════════════════════
export const getAllComplaints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      priority,
      category,
      department,
      escalatedOnly,
      overdueOnly,
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = req.query as any

    const filter: Record<string, any> = { isActive: true }

    if (status) filter.status = status
    if (priority) filter.priority = priority
    if (category) filter.category = category
    if (department) filter.department = department
    if (escalatedOnly === 'true') filter.escalatedToPrincipal = true
    if (overdueOnly === 'true') filter.isOverdue = true

    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) filter.createdAt.$lte = new Date(endDate)
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .populate('relatedStudent', 'firstName lastName admissionNumber class section')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),  // Use lean() for read-only operations
      Complaint.countDocuments(filter),
    ])

    const formattedComplaints = complaints.map(c => ({
      _id: c._id,
      ticketNumber: c.ticketNumber,
      subject: c.subject,
      category: c.category,
      priority: c.priority,
      status: c.status,
      raisedByName: c.raisedByName,
      raisedByRole: c.raisedByRole,
      relatedStudent: c.relatedStudent
        ? {
            name: `${(c.relatedStudent as any)?.firstName} ${(c.relatedStudent as any)?.lastName}`,
            class: `${(c.relatedStudent as any)?.class}-${(c.relatedStudent as any)?.section}`,
          }
        : null,
      department: c.department,
      assignedToName: c.assignedToName || 'Unassigned',
      escalatedToPrincipal: c.escalatedToPrincipal,
      isOverdue: c.isOverdue,
      createdAt: c.createdAt,
      dueDate: c.dueDate,
      resolution: c.resolution,  // FIX #1: Include resolution object
    }))

    res.status(200).json({
      success: true,
      data: formattedComplaints,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err: any) {
    console.error('getAllComplaints error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/complaints/summary
// Get complaints summary dashboard
// FIX #5: Optimized with single $facet aggregation
// ═══════════════════════════════════════════════════════════
export const getComplaintsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date()
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // FIX #5: Single aggregation with $facet to reduce DB strain
    const [result] = await Complaint.aggregate([
      { $match: { isActive: true } },
      {
        $facet: {
          // Status counts (single pass)
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          
          // Escalated count (open/in_progress only)
          escalatedCount: [
            {
              $match: {
                escalatedToPrincipal: true,
                status: { $nin: ['resolved', 'closed', 'rejected'] },
              },
            },
            { $count: 'count' },
          ],
          
          // Overdue count
          overdueCount: [
            {
              $match: {
                dueDate: { $lt: new Date() },
                status: { $nin: ['resolved', 'closed', 'rejected'] },
              },
            },
            { $count: 'count' },
          ],
          
          // This month's complaints
          thisMonthCount: [
            { $match: { createdAt: { $gte: thisMonth } } },
            { $count: 'count' },
          ],
          
          // By category (this month only for relevance)
          byCategory: [
            { $match: { createdAt: { $gte: thisMonth } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          
          // By priority (open complaints only)
          byPriority: [
            { $match: { status: { $nin: ['resolved', 'closed', 'rejected'] } } },
            { $group: { _id: '$priority', count: { $sum: 1 } } },
          ],
          
          // Recent urgent complaints (limit 5)
          urgentComplaints: [
            {
              $match: {
                priority: 'urgent',
                status: { $nin: ['resolved', 'closed', 'rejected'] },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 1,
                ticketNumber: 1,
                subject: 1,
                category: 1,
                raisedByName: 1,
                createdAt: 1,
              },
            },
          ],
          
          // FIX #5: Simplified resolution time - only last 100 resolved for performance
          avgResolutionTime: [
            {
              $match: {
                status: 'resolved',
                'resolution.resolvedDate': { $exists: true },
              },
            },
            { $sort: { 'resolution.resolvedDate': -1 } },
            { $limit: 100 },  // Sample last 100 for performance
            {
              $project: {
                resolutionTime: {
                  $subtract: ['$resolution.resolvedDate', '$createdAt'],
                },
              },
            },
            {
              $group: {
                _id: null,
                avgTime: { $avg: '$resolutionTime' },
              },
            },
          ],
        },
      },
    ])

    // Extract counts from aggregation result
    const statusMap: Record<string, number> = {}
    result.statusCounts.forEach((s: { _id: string; count: number }) => {
      statusMap[s._id] = s.count
    })

    res.status(200).json({
      success: true,
      data: {
        summary: {
          open: statusMap['open'] || 0,
          inProgress: statusMap['in_progress'] || 0,
          escalated: result.escalatedCount[0]?.count || 0,
          overdue: result.overdueCount[0]?.count || 0,
          thisMonth: result.thisMonthCount[0]?.count || 0,
          avgResolutionDays: result.avgResolutionTime[0]?.avgTime
            ? Math.round(result.avgResolutionTime[0].avgTime / (1000 * 60 * 60 * 24))
            : 0,
        },
        byCategory: result.byCategory.map((c: { _id: string; count: number }) => ({
          category: c._id,
          count: c.count,
        })),
        byPriority: result.byPriority.map((p: { _id: string; count: number }) => ({
          priority: p._id,
          count: p.count,
        })),
        urgentComplaints: result.urgentComplaints,
      },
    })
  } catch (err: any) {
    console.error('getComplaintsSummary error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/complaints/:id
// Get complaint detail
// ═══════════════════════════════════════════════════════════
export const getComplaintDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('relatedStudent', 'firstName lastName admissionNumber class section phone')
      .populate('againstPerson', 'firstName lastName')
      .lean()

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: complaint,
    })
  } catch (err: any) {
    console.error('getComplaintDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/principal/complaints/:id/update
// Update complaint status and assignment
// FIX #3: Atomic update with findOneAndUpdate
// ═══════════════════════════════════════════════════════════
export const updateComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      priority,
      department,
      assignToTeacherId,
      principalRemarks,
      principalActionTaken,
      dueDate,
    } = req.body

    // FIX #3: Build atomic $set object
    const updateFields: Record<string, any> = {}

    if (status) updateFields.status = status
    if (priority) updateFields.priority = priority
    if (department) updateFields.department = department
    if (dueDate) updateFields.dueDate = new Date(dueDate)

    // Handle teacher assignment
    if (assignToTeacherId) {
      const teacher = await Teacher.findOne({
        teacherId: assignToTeacherId.toUpperCase(),
        isActive: true,
      }).lean()
      
      if (teacher) {
        updateFields.assignedTo = teacher._id
        updateFields.assignedToRole = 'teacher'
        updateFields.assignedToName = `${teacher.firstName} ${teacher.lastName}`
        updateFields.assignedAt = new Date()
      }
    }

    if (principalRemarks) {
      updateFields.principalRemarks = principalRemarks
      updateFields.escalatedToPrincipal = true
      updateFields.escalatedAt = new Date()
    }

    if (principalActionTaken) {
      updateFields.principalActionTaken = principalActionTaken
    }

    // Check if dueDate passed and status not terminal → mark overdue
    if (updateFields.dueDate && new Date() > updateFields.dueDate) {
      if (!['resolved', 'closed', 'rejected'].includes(status || '')) {
        updateFields.isOverdue = true
      }
    }

    // FIX #3: Atomic update - no race condition
    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('relatedStudent', 'firstName lastName admissionNumber class section')
      .lean()

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Complaint updated.',
      data: complaint,
    })
  } catch (err: any) {
    console.error('updateComplaint error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/principal/complaints/:id/resolve
// Resolve a complaint
// FIX #3: Atomic update with nested resolution object
// ═══════════════════════════════════════════════════════════
export const resolveComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { resolution, status = 'resolved' } = req.body

    const principal = await Principal.findOne({ user: req.user!.userId }).lean()

    // FIX #1 & #3: Build resolution object and use atomic update
    const updateFields: Record<string, any> = {
      status,
      'resolution.summary': resolution || '',
      'resolution.resolvedBy': principal?._id,
      'resolution.resolvedByName': principal
        ? `${principal.firstName} ${principal.lastName}`
        : 'Principal',
      'resolution.resolvedDate': new Date(),
      isOverdue: false,  // Clear overdue flag on resolution
    }

    // FIX #3: Atomic update
    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('relatedStudent', 'firstName lastName admissionNumber class section')
      .lean()

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Complaint resolved.',
      data: complaint,
    })
  } catch (err: any) {
    console.error('resolveComplaint error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/principal/complaints/:id/comment
// Add a comment to complaint
// FIX #3: Atomic $push for comments
// FIX #4: Return full complaint document
// ═══════════════════════════════════════════════════════════
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message } = req.body

    if (!message) {
      res.status(400).json({ success: false, message: 'Comment message is required.' })
      return
    }

    const principal = await Principal.findOne({ user: req.user!.userId }).lean()

    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      author: principal?._id,
      authorRole: 'principal',
      authorName: principal ? `${principal.firstName} ${principal.lastName}` : 'Principal',
      message,
      createdAt: new Date(),
    }

    // FIX #3: Atomic $push - no race condition
    // FIX #4: Return full complaint with { new: true }
    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $push: { comments: newComment } },
      { new: true, runValidators: true }
    )
      .populate('relatedStudent', 'firstName lastName admissionNumber class section')
      .lean()

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' })
      return
    }

    // FIX #4: Return entire complaint document
    res.status(200).json({
      success: true,
      message: 'Comment added.',
      data: complaint,
    })
  } catch (err: any) {
    console.error('addComment error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/principal/complaints
// Create a new complaint (Principal creating on behalf of someone)
// FIX #2: Atomic ticket number generation with Counter
// ═══════════════════════════════════════════════════════════
export const createComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      raisedBy,
      raisedByRole,
      raisedByName,
      raisedByContact,
      relatedStudent,
      category,
      subcategory,
      subject,
      description,
      priority,
      againstType,
      againstPerson,
      againstPersonName,
      department,
      dueDate,
    } = req.body

    // Validate required fields
    if (!raisedBy || !raisedByRole || !raisedByName || !category || !subject || !description) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: raisedBy, raisedByRole, raisedByName, category, subject, description',
      })
      return
    }

    // Validate category
    if (!COMPLAINT_CATEGORIES.includes(category as ComplaintCategory)) {
      res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${COMPLAINT_CATEGORIES.join(', ')}`,
      })
      return
    }

    // FIX #2: Atomic ticket number generation
    const ticketNumber = await Counter.getNextSequence('CMP')

    let studentClassAtTime = ''
    let studentSectionAtTime = ''
    let sessionAtTime = ''

    if (relatedStudent) {
      const student = await Student.findById(relatedStudent)
        .select('currentClass currentSection currentSession')
        .lean()
      studentClassAtTime = student?.currentClass || ''
      studentSectionAtTime = student?.currentSection || ''
      sessionAtTime = student?.currentSession || ''
    }

    const complaint = await Complaint.create({
      ticketNumber,
      raisedBy,
      raisedByRole,
      raisedByName,
      raisedByContact: raisedByContact || '',
      relatedStudent,
      category,
      subcategory: subcategory || '',
      subject,
      description,
      priority: priority || 'medium',
      againstType: againstType || 'none',
      againstPerson,
      againstPersonName: againstPersonName || '',
      department: department || 'general',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      studentClassAtTime,
      studentSectionAtTime,
      sessionAtTime,
      status: 'open',
      resolution: {},
      comments: [],
    })

    res.status(201).json({
      success: true,
      message: 'Complaint created successfully.',
      data: complaint,
    })
  } catch (err: any) {
    console.error('createComplaint error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
