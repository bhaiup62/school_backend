// src/controllers/principal/financeController.ts
// Read-Only Finance & Defaulter Actions for Principal

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import FeeRecord from '../../models/student/FeeRecord'
import Student from '../../models/student/Student'
import Principal from '../../models/principal/Principal'

const getISTDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

// ═══════════════════════════════════════════════════════════
// GET /api/principal/finance/summary
// Get financial overview
// ═══════════════════════════════════════════════════════════
export const getFinanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getISTDate()
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const thisYear = new Date(today.getFullYear(), 0, 1)

    const currentAcademicYear = (() => {
      const now = new Date()
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      return `${year}-${(year + 1).toString().slice(2)}`
    })()

    const [
      totalCollectedThisMonth,
      totalCollectedThisYear,
      totalPending,
      totalDefaulters,
      defaulterAmount,
      restrictedCount,
      byFeeType,
    ] = await Promise.all([
      // This month's collection
      FeeRecord.aggregate([
        {
          $match: {
            isActive: true,
            'payments.paidDate': { $gte: thisMonth },
          },
        },
        { $unwind: '$payments' },
        { $match: { 'payments.paidDate': { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),
      // This year's collection
      FeeRecord.aggregate([
        {
          $match: {
            isActive: true,
            academicYear: currentAcademicYear,
          },
        },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } },
      ]),
      // Total pending amount
      FeeRecord.aggregate([
        {
          $match: {
            isActive: true,
            academicYear: currentAcademicYear,
            status: { $in: ['pending', 'partial', 'overdue'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$dueAmount' } } },
      ]),
      // Total defaulters count
      FeeRecord.countDocuments({
        isActive: true,
        dueAmount: { $gt: 0 },
        dueDate: { $lt: today },
        status: { $ne: 'waived' },
      }),
      // Total defaulter amount
      FeeRecord.aggregate([
        {
          $match: {
            isActive: true,
            dueAmount: { $gt: 0 },
            dueDate: { $lt: today },
            status: { $ne: 'waived' },
          },
        },
        { $group: { _id: null, total: { $sum: '$dueAmount' } } },
      ]),
      // Restricted report cards
      FeeRecord.countDocuments({ isActive: true, restrictReportCard: true }),
      // By fee type
      FeeRecord.aggregate([
        { $match: { isActive: true, academicYear: currentAcademicYear } },
        {
          $group: {
            _id: '$feeType',
            totalAmount: { $sum: '$netAmount' },
            collected: { $sum: '$paidAmount' },
            pending: { $sum: '$dueAmount' },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
    ])

    res.status(200).json({
      success: true,
      data: {
        academicYear: currentAcademicYear,
        summary: {
          totalCollection: totalCollectedThisYear[0]?.total || 0,
          pendingAmount: totalPending[0]?.total || 0,
          defaultersCount: totalDefaulters,
          restrictedCount: restrictedCount,
          collectedThisMonth: totalCollectedThisMonth[0]?.total || 0,
          defaulterAmount: defaulterAmount[0]?.total || 0,
        },
        byFeeType: byFeeType.map(f => ({
          feeType: f._id,
          totalAmount: f.totalAmount,
          collected: f.collected,
          pending: f.pending,
          collectionPercentage: f.totalAmount > 0 ? Math.round((f.collected / f.totalAmount) * 100) : 0,
        })),
      },
    })
  } catch (err: any) {
    console.error('getFinanceSummary error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/finance/defaulters
// Get list of fee defaulters
// ═══════════════════════════════════════════════════════════
export const getDefaulters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      class: cls,
      section,
      minDaysOverdue,
      minAmount,
      page = '1',
      limit = '50',
    } = req.query as any

    const today = getISTDate()
    const filter: Record<string, any> = {
      isActive: true,
      dueAmount: { $gt: 0 },
      dueDate: { $lt: today },
      status: { $ne: 'waived' },
    }

    if (minDaysOverdue) {
      const thresholdDate = new Date(today.getTime() - parseInt(minDaysOverdue) * 24 * 60 * 60 * 1000)
      filter.dueDate = { $lt: thresholdDate }
    }
    if (minAmount) filter.dueAmount = { $gte: parseInt(minAmount) }

    // If class/section filter, need to find students first
    let studentFilter: Record<string, any> = {}
    if (cls) studentFilter.currentClass = cls
    if (section) studentFilter.currentSection = section.toUpperCase()

    if (Object.keys(studentFilter).length > 0) {
      const students = await Student.find({ ...studentFilter, isActive: true }).select('_id')
      filter.student = { $in: students.map(s => s._id) }
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const [records, total] = await Promise.all([
      FeeRecord.find(filter)
        .populate('student', 'firstName lastName admissionNumber currentClass currentSection phone parents')
        .sort({ dueAmount: -1 })
        .skip(skip)
        .limit(limitNum),
      FeeRecord.countDocuments(filter),
    ])

    const formattedRecords = records.map(r => {
      const daysOverdue = Math.floor((today.getTime() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return {
        _id: r._id,
        student: {
          admissionNumber: (r.student as any)?.admissionNumber,
          name: `${(r.student as any)?.firstName} ${(r.student as any)?.lastName}`,
          class: (r.student as any)?.currentClass,
          section: (r.student as any)?.currentSection,
          phone: (r.student as any)?.phone,
          parentPhone: (r.student as any)?.parents?.phone,
        },
        feeType: r.feeType,
        totalDue: r.dueAmount,
        overdueBy: daysOverdue,
        dueDate: r.dueDate,
        defaulterSince: r.defaulterSince,
        lateFeeApplied: r.lateFeeApplied,
        finalAmount: r.finalAmount,
        restrictReportCard: r.restrictReportCard,
        remindersSent: r.remindersSent,
      }
    })

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
    console.error('getDefaulters error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/finance/student/:admissionNumber
// Get fee records for a specific student
// ═══════════════════════════════════════════════════════════
export const getStudentFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getISTDate()
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber.toUpperCase(),
      isActive: true,
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    const records = await FeeRecord.find({ student: student._id, isActive: true })
      .sort({ dueDate: -1 })

    const summary = {
      totalAmount: records.reduce((sum, r) => sum + r.netAmount, 0),
      totalPaid: records.reduce((sum, r) => sum + r.paidAmount, 0),
      totalDue: records.reduce((sum, r) => sum + r.dueAmount, 0),
      isDefaulter: records.some(r => r.isDefaulter),
      hasRestriction: records.some(r => r.restrictReportCard),
    }

    res.status(200).json({
      success: true,
      data: {
        student: {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          class: student.currentClass,
          section: student.currentSection,
        },
        summary,
        records: records.map(r => {
          const isOverdue = r.dueAmount > 0 && r.dueDate < today && r.status !== 'waived'
          return {
            _id: r._id,
            feeType: r.feeType,
            feeDescription: r.feeDescription,
            netAmount: r.netAmount,
            paidAmount: r.paidAmount,
            dueAmount: r.dueAmount,
            dueDate: r.dueDate,
            status: isOverdue ? 'overdue' : r.status,
            isDefaulter: isOverdue,
            daysOverdue: isOverdue
              ? Math.floor((today.getTime() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24))
              : 0,
            restrictReportCard: r.restrictReportCard,
            payments: r.payments,
          }
        }),
      },
    })
  } catch (err: any) {
    console.error('getStudentFees error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/principal/finance/:id/restrict
// Toggle report card restriction for a fee record
// ═══════════════════════════════════════════════════════════
export const toggleRestriction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { restrict, reason } = req.body

    const record = await FeeRecord.findById(req.params.id).populate('student', 'firstName lastName admissionNumber')
    if (!record) {
      res.status(404).json({ success: false, message: 'Fee record not found.' })
      return
    }

    const principal = await Principal.findOne({ user: req.user!.userId })

    record.restrictReportCard = restrict
    record.restrictedBy = restrict ? (principal?._id as any) : (null as any)
    record.restrictedAt = restrict ? new Date() : (null as any)
    record.restrictionReason = restrict ? (reason || 'Fee dues pending') : ''

    await record.save()

    const studentName = `${(record.student as any)?.firstName} ${(record.student as any)?.lastName}`

    res.status(200).json({
      success: true,
      message: restrict
        ? `Report card restricted for ${studentName}`
        : `Report card restriction removed for ${studentName}`,
      data: {
        studentName,
        admissionNumber: (record.student as any)?.admissionNumber,
        restrictReportCard: record.restrictReportCard,
      },
    })
  } catch (err: any) {
    console.error('toggleRestriction error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/principal/finance/bulk-restrict
// Bulk toggle restriction for multiple defaulters
// ═══════════════════════════════════════════════════════════
export const bulkRestrict = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { feeRecordIds, restrict, reason } = req.body

    if (!feeRecordIds || !Array.isArray(feeRecordIds) || feeRecordIds.length === 0) {
      res.status(400).json({ success: false, message: 'Fee record IDs are required.' })
      return
    }

    const principal = await Principal.findOne({ user: req.user!.userId })

    const updateData: Record<string, any> = {
      restrictReportCard: restrict,
    }

    if (restrict) {
      updateData.restrictedBy = principal?._id
      updateData.restrictedAt = new Date()
      updateData.restrictionReason = reason || 'Fee dues pending'
    } else {
      updateData.$unset = { restrictedBy: 1, restrictedAt: 1 }
      updateData.restrictionReason = ''
    }

    const result = await FeeRecord.updateMany(
      { _id: { $in: feeRecordIds }, isActive: true },
      restrict ? { $set: updateData } : updateData
    )

    res.status(200).json({
      success: true,
      message: restrict
        ? `Report cards restricted for ${result.modifiedCount} students`
        : `Report card restrictions removed for ${result.modifiedCount} students`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    })
  } catch (err: any) {
    console.error('bulkRestrict error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/finance/collection-report
// Get daily/monthly collection report
// ═══════════════════════════════════════════════════════════
export const getCollectionReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query as any

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1))
    const end = endDate ? new Date(endDate) : new Date()

    const groupFormat = groupBy === 'month'
      ? { $dateToString: { format: '%Y-%m', date: '$payments.paidDate' } }
      : { $dateToString: { format: '%Y-%m-%d', date: '$payments.paidDate' } }

    const collections = await FeeRecord.aggregate([
      {
        $match: {
          isActive: true,
          'payments.paidDate': { $gte: start, $lte: end },
        },
      },
      { $unwind: '$payments' },
      { $match: { 'payments.paidDate': { $gte: start, $lte: end } } },
      {
        $group: {
          _id: groupFormat,
          totalAmount: { $sum: '$payments.amount' },
          transactionCount: { $sum: 1 },
          byMode: {
            $push: {
              mode: '$payments.paymentMode',
              amount: '$payments.amount',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Process byMode to aggregate by payment mode
    const formattedCollections = collections.map(c => {
      const byMode: Record<string, number> = {}
      c.byMode.forEach((m: any) => {
        byMode[m.mode] = (byMode[m.mode] || 0) + m.amount
      })
      return {
        date: c._id,
        totalAmount: c.totalAmount,
        transactionCount: c.transactionCount,
        byPaymentMode: byMode,
      }
    })

    const grandTotal = formattedCollections.reduce((sum, c) => sum + c.totalAmount, 0)
    const totalTransactions = formattedCollections.reduce((sum, c) => sum + c.transactionCount, 0)

    res.status(200).json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        summary: {
          grandTotal,
          totalTransactions,
          avgPerDay: formattedCollections.length > 0 ? Math.round(grandTotal / formattedCollections.length) : 0,
        },
        collections: formattedCollections,
      },
    })
  } catch (err: any) {
    console.error('getCollectionReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/finance/class-wise
// Get class-wise fee collection summary
// ═══════════════════════════════════════════════════════════
export const getClassWiseSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getISTDate()
    // Get all students grouped by class
    const studentsByClass = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$currentClass', studentIds: { $push: '$_id' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])

    const classWiseData = await Promise.all(
      studentsByClass.map(async (c) => {
        const [feeData] = await FeeRecord.aggregate([
          { $match: { student: { $in: c.studentIds }, isActive: true } },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$netAmount' },
              collected: { $sum: '$paidAmount' },
              pending: { $sum: '$dueAmount' },
              defaultersCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ['$dueAmount', 0] },
                        { $lt: ['$dueDate', today] },
                        { $ne: ['$status', 'waived'] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              restrictedCount: { $sum: { $cond: ['$restrictReportCard', 1, 0] } },
            },
          },
        ])

        return {
          class: c._id,
          studentCount: c.count,
          totalAmount: feeData?.totalAmount || 0,
          collected: feeData?.collected || 0,
          pending: feeData?.pending || 0,
          collectionPercentage: feeData?.totalAmount > 0
            ? Math.round((feeData.collected / feeData.totalAmount) * 100)
            : 0,
          defaultersCount: feeData?.defaultersCount || 0,
          restrictedCount: feeData?.restrictedCount || 0,
        }
      })
    )

    classWiseData.sort((a, b) => parseInt(a.class) - parseInt(b.class))

    res.status(200).json({
      success: true,
      data: classWiseData,
    })
  } catch (err: any) {
    console.error('getClassWiseSummary error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
