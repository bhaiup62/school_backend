// src/controllers/principal/disciplineController.ts
// Discipline & Behavior Management for Principal
// ═══════════════════════════════════════════════════════════════════════════════
// Production-ready with atomic operations, strict validation, optimized queries
// ═══════════════════════════════════════════════════════════════════════════════

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import DisciplinaryRecord, { DISCIPLINE_CATEGORIES, DisciplineCategory } from '../../models/principal/DisciplinaryRecord'
import Student from '../../models/student/Student'
import Principal from '../../models/principal/Principal'
import { Counter } from '../../models/shared/Counter'

const getISTDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

// ═══════════════════════════════════════════════════════════
// GET /api/principal/discipline
// Get all disciplinary records with filters
// ═══════════════════════════════════════════════════════════
export const getAllRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      incidentType,
      category,
      class: cls,
      section,
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = req.query as any

    const filter: Record<string, any> = { isActive: true }

    if (status) filter.status = status
    if (incidentType) filter.incidentType = incidentType
    if (category) filter.category = category

    if (startDate || endDate) {
      filter.incidentDate = {}
      if (startDate) filter.incidentDate.$gte = new Date(startDate)
      if (endDate) filter.incidentDate.$lte = new Date(endDate)
    }

    // If class/section filter, we need to filter by student
    let studentFilter: Record<string, any> = {}
    if (cls) studentFilter.currentClass = cls
    if (section) studentFilter.currentSection = section.toUpperCase()

    let studentIds: any[] = []
    if (Object.keys(studentFilter).length > 0) {
      const students = await Student.find({ ...studentFilter, isActive: true }).select('_id')
      studentIds = students.map(s => s._id)
      filter.student = { $in: studentIds }
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const [records, total] = await Promise.all([
      DisciplinaryRecord.find(filter)
        .populate('student', 'firstName lastName admissionNumber class section')
        .populate('reportedBy', 'firstName lastName teacherId')
        .sort({ incidentDate: -1 })
        .skip(skip)
        .limit(limitNum),
      DisciplinaryRecord.countDocuments(filter),
    ])

    const formattedRecords = records.map(r => ({
      _id: r._id,
      recordId: r.recordId,  // FIX #1: Include recordId
      studentName: `${(r.student as any)?.firstName} ${(r.student as any)?.lastName}`,
      studentAdmissionNumber: (r.student as any)?.admissionNumber,
      studentClass: (r.student as any)?.class,
      studentSection: (r.student as any)?.section,
      reportedBy: `${(r.reportedBy as any)?.firstName || ''} ${(r.reportedBy as any)?.lastName || ''}`.trim() || 'Unknown',
      incidentDate: r.incidentDate,
      incidentType: r.incidentType,
      category: r.category,
      description: r.description,
      status: r.status,
      actionTaken: r.actionTaken,
      parentNotified: r.parentNotified,
      addToPermanentRecord: r.addToPermanentRecord,
      createdAt: r.createdAt,
    }))

    res.status(200).json({
      success: true,
      data: formattedRecords,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err: any) {
    console.error('getAllRecords error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/principal/discipline/summary
// FIX #4: Optimized single $facet aggregation instead of 7 parallel queries
// ═══════════════════════════════════════════════════════════════════════════════
export const getDisciplineSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getISTDate()
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const thisYear = new Date(today.getFullYear(), 0, 1)

    // Single optimized aggregation with $facet
    const [result] = await DisciplinaryRecord.aggregate([
      { $match: { isActive: true } },
      {
        $facet: {
          // Status counts
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          // This month count
          thisMonthCount: [
            { $match: { incidentDate: { $gte: thisMonth } } },
            { $count: 'count' },
          ],
          // By incident type (this year)
          byType: [
            { $match: { incidentDate: { $gte: thisYear } } },
            { $group: { _id: '$incidentType', count: { $sum: 1 } } },
          ],
          // By category (this year)
          byCategory: [
            { $match: { incidentDate: { $gte: thisYear } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
          ],
          // Recent severe incidents (unresolved)
          recentSevere: [
            {
              $match: {
                incidentType: { $in: ['severe', 'critical'] },
                status: { $ne: 'resolved' },
              },
            },
            { $sort: { incidentDate: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'students',
                localField: 'student',
                foreignField: '_id',
                as: 'studentData',
              },
            },
            { $unwind: { path: '$studentData', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                recordId: 1,
                incidentDate: 1,
                incidentType: 1,
                category: 1,
                status: 1,
                studentName: {
                  $concat: [
                    { $ifNull: ['$studentData.firstName', ''] },
                    ' ',
                    { $ifNull: ['$studentData.lastName', ''] },
                  ],
                },
                studentClass: {
                  $concat: [
                    { $ifNull: ['$studentData.class', ''] },
                    '-',
                    { $ifNull: ['$studentData.section', ''] },
                  ],
                },
              },
            },
          ],
        },
      },
    ])

    // Extract status counts
    const statusMap: Record<string, number> = {}
    for (const s of result.statusCounts) {
      statusMap[s._id] = s.count
    }

    res.status(200).json({
      success: true,
      data: {
        summary: {
          pending: statusMap['pending'] || 0,
          underReview: statusMap['under_review'] || 0,
          resolved: statusMap['resolved'] || 0,
          escalated: statusMap['escalated'] || 0,
          thisMonth: result.thisMonthCount[0]?.count || 0,
        },
        byIncidentType: result.byType.map((t: any) => ({ type: t._id, count: t.count })),
        byCategory: result.byCategory.map((c: any) => ({ category: c._id, count: c.count })),
        recentSevereIncidents: result.recentSevere,
      },
    })
  } catch (err: any) {
    console.error('getDisciplineSummary error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/discipline/:id
// Get single disciplinary record detail
// ═══════════════════════════════════════════════════════════
export const getRecordDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const record = await DisciplinaryRecord.findById(req.params.id)
      .populate('student', 'firstName lastName admissionNumber class section phone parents')
      .populate('reportedBy', 'firstName lastName teacherId email phone')
      .populate('reviewedBy', 'firstName lastName')

    if (!record) {
      res.status(404).json({ success: false, message: 'Record not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        ...record.toObject(),
        studentName: `${(record.student as any)?.firstName} ${(record.student as any)?.lastName}`,
        reportedByName: `${(record.reportedBy as any)?.firstName || ''} ${(record.reportedBy as any)?.lastName || ''}`.trim(),
        reviewedByName: record.reviewedBy ? `${(record.reviewedBy as any)?.firstName} ${(record.reviewedBy as any)?.lastName}` : null,
      },
    })
  } catch (err: any) {
    console.error('getRecordDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/principal/discipline/:id/review
// FIX #3: Atomic update instead of findById + save
// ═══════════════════════════════════════════════════════════════════════════════
export const reviewRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      principalRemarks,
      actionTaken,
      actionDetails,
      suspensionDays,
      suspensionStartDate,
      addToPermanentRecord,
      notifyParent,
    } = req.body

    const { id } = req.params

    // Get principal for audit
    const principal = await Principal.findOne({ user: req.user!.userId })
    const now = getISTDate()

    // Build atomic update object
    const updateFields: Record<string, any> = {
      reviewedBy: principal?._id,
      reviewedAt: now,
    }

    if (status) updateFields.status = status
    if (principalRemarks !== undefined) updateFields.principalRemarks = principalRemarks
    if (actionTaken) updateFields.actionTaken = actionTaken
    if (actionDetails !== undefined) updateFields.actionDetails = actionDetails
    if (typeof addToPermanentRecord === 'boolean') updateFields.addToPermanentRecord = addToPermanentRecord

    // Handle suspension
    if (suspensionDays && suspensionDays > 0) {
      updateFields.suspensionDays = suspensionDays
      if (suspensionStartDate) {
        const startDate = new Date(suspensionStartDate)
        updateFields.suspensionStartDate = startDate
        updateFields.suspensionEndDate = new Date(startDate.getTime() + suspensionDays * 24 * 60 * 60 * 1000)
      }
    }

    // Handle parent notification
    if (notifyParent) {
      updateFields.parentNotified = true
      updateFields.parentNotifiedAt = now
      // TODO: Send actual notification (SMS/email)
    }

    // FIX #3: Atomic update
    const record = await DisciplinaryRecord.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: updateFields },
      { new: true }
    )
      .populate('student', 'firstName lastName admissionNumber class section')
      .populate('reviewedBy', 'firstName lastName')

    if (!record) {
      res.status(404).json({ success: false, message: 'Record not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Record reviewed successfully.',
      data: record,
    })
  } catch (err: any) {
    console.error('reviewRecord error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/principal/discipline
// FIX #1: Atomic sequential recordId generation
// FIX #2: Strict category validation before save
// ═══════════════════════════════════════════════════════════════════════════════
export const createRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      studentAdmissionNumber,
      incidentDate,
      incidentType,
      category,
      description,
      location,
      witnesses,
      actionTaken,
      actionDetails,
      principalRemarks,
      addToPermanentRecord,
    } = req.body

    // ═══════════════════════════════════════════════════════════════════════════
    // FIX #2: Strict validation before Mongoose save
    // ═══════════════════════════════════════════════════════════════════════════
    if (!category) {
      res.status(400).json({ success: false, message: 'Category is required.' })
      return
    }

    if (!DISCIPLINE_CATEGORIES.includes(category as DisciplineCategory)) {
      res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${DISCIPLINE_CATEGORIES.join(', ')}`,
      })
      return
    }

    if (!description || description.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Description is required.' })
      return
    }

    if (!studentAdmissionNumber) {
      res.status(400).json({ success: false, message: 'Student admission number is required.' })
      return
    }

    // Find student
    const student = await Student.findOne({ admissionNumber: studentAdmissionNumber.toUpperCase(), isActive: true })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // Get principal
    const principal = await Principal.findOne({ user: req.user!.userId })

    // ═══════════════════════════════════════════════════════════════════════════
    // FIX #1: Atomic recordId generation using Counter
    // ═══════════════════════════════════════════════════════════════════════════
    const recordId = await Counter.getNextSequence('DISC')

    const record = await DisciplinaryRecord.create({
      recordId,
      student: student._id,
      studentClassAtTime: student.currentClass,
      studentSectionAtTime: student.currentSection,
      sessionAtTime: student.currentSession,
      reportedBy: principal?._id,
      reportedByRole: 'principal',
      incidentDate: incidentDate || new Date(),
      incidentType: incidentType || 'minor',
      category,
      description: description.trim(),
      location: location || '',
      witnesses: witnesses || [],
      status: 'resolved',  // Principal-created records are auto-resolved
      actionTaken: actionTaken || 'none',
      actionDetails: actionDetails || '',
      principalRemarks: principalRemarks || '',
      addToPermanentRecord: addToPermanentRecord || false,
      reviewedBy: principal?._id,
      reviewedAt: new Date(),
    })

    res.status(201).json({
      success: true,
      message: 'Disciplinary record created.',
      data: {
        _id: record._id,
        recordId: record.recordId,
        studentName: `${student.firstName} ${student.lastName}`,
        incidentType: record.incidentType,
        category: record.category,
        status: record.status,
      },
    })
  } catch (err: any) {
    console.error('createRecord error:', err)
    // Handle duplicate recordId (extremely rare with atomic counter)
    if (err.code === 11000 && err.keyPattern?.recordId) {
      res.status(500).json({ success: false, message: 'Failed to generate unique record ID. Please try again.' })
      return
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/discipline/student/:admissionNumber
// Get all disciplinary records for a specific student
// ═══════════════════════════════════════════════════════════
export const getStudentRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber.toUpperCase(),
      isActive: true,
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    const records = await DisciplinaryRecord.find({ student: student._id, isActive: true })
      .populate('reportedBy', 'firstName lastName')
      .sort({ incidentDate: -1 })

    res.status(200).json({
      success: true,
      data: {
        student: {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          class: student.currentClass,
          section: student.currentSection,
        },
        totalRecords: records.length,
        records: records.map(r => ({
          _id: r._id,
          recordId: r.recordId,
          incidentDate: r.incidentDate,
          incidentType: r.incidentType,
          category: r.category,
          description: r.description,
          status: r.status,
          actionTaken: r.actionTaken,
          addToPermanentRecord: r.addToPermanentRecord,
        })),
      },
    })
  } catch (err: any) {
    console.error('getStudentRecords error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
