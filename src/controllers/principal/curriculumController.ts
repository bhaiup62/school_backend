// src/controllers/principal/curriculumController.ts
// Academic & Syllabus Tracking for Principal
// Production-ready with atomic operations and dynamic calculations

import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../../middleware/authMiddleware'
import SyllabusProgress, { ISyllabusProgress } from '../../models/principal/SyllabusProgress'
import MasterCurriculum, { IMasterCurriculum } from '../../models/principal/MasterCurriculum'
import Teacher from '../../models/teacher/Teacher'
import Principal from '../../models/principal/Principal'

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Dynamic Progress Calculator
// Calculates completionPercentage, isOnTrack, behindByPercentage on-the-fly
// ═══════════════════════════════════════════════════════════════════════════════
interface CalculatedMetrics {
  totalChapters: number
  completedChapters: number
  completionPercentage: number
  isOnTrack: boolean
  behindByPercentage: number
  expectedPercentage: number
}

const calculateProgressMetrics = (
  progress: ISyllabusProgress,
  curriculum: IMasterCurriculum
): CalculatedMetrics => {
  const totalChapters = curriculum.chapters.length
  const completedChapters = progress.chapterProgress.filter(
    cp => cp.status === 'completed'
  ).length
  
  const completionPercentage = totalChapters > 0
    ? Math.round((completedChapters / totalChapters) * 100)
    : 0

  // Calculate expected progress based on current date vs session dates
  const now = new Date()
  const sessionStart = new Date(curriculum.sessionStartDate)
  const sessionEnd = new Date(curriculum.sessionEndDate)
  
  const totalDuration = sessionEnd.getTime() - sessionStart.getTime()
  const elapsed = Math.max(0, now.getTime() - sessionStart.getTime())
  const expectedPercentage = Math.min(100, Math.round((elapsed / totalDuration) * 100))
  
  const behindByPercentage = Math.max(0, expectedPercentage - completionPercentage)
  const isOnTrack = behindByPercentage < 10 // Within 10% tolerance

  return {
    totalChapters,
    completedChapters,
    completionPercentage,
    isOnTrack,
    behindByPercentage,
    expectedPercentage,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/principal/curriculum
// Get all syllabus progress with DYNAMIC calculation
// ═══════════════════════════════════════════════════════════════════════════════
export const getAllProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      class: cls,
      section,
      subject,
      academicYear,
      teacher,
      flaggedOnly,
      belowPercentage,
      page = '1',
      limit = '50',
    } = req.query as any

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build aggregation pipeline for dynamic calculation
    const pipeline: mongoose.PipelineStage[] = [
      // Join with MasterCurriculum
      {
        $lookup: {
          from: 'mastercurriculums',
          localField: 'masterCurriculum',
          foreignField: '_id',
          as: 'curriculum',
        },
      },
      { $unwind: '$curriculum' },
      
      // Join with Teacher
      {
        $lookup: {
          from: 'teachers',
          localField: 'teacher',
          foreignField: '_id',
          as: 'teacherDoc',
        },
      },
      { $unwind: { path: '$teacherDoc', preserveNullAndEmptyArrays: true } },
      
      // Calculate dynamic fields
      {
        $addFields: {
          totalChapters: { $size: '$curriculum.chapters' },
          completedChapters: {
            $size: {
              $filter: {
                input: '$chapterProgress',
                cond: { $eq: ['$$this.status', 'completed'] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          completionPercentage: {
            $cond: {
              if: { $gt: ['$totalChapters', 0] },
              then: {
                $round: [
                  { $multiply: [{ $divide: ['$completedChapters', '$totalChapters'] }, 100] },
                  0,
                ],
              },
              else: 0,
            },
          },
          // Dynamic pacing calculation
          expectedPercentage: {
            $let: {
              vars: {
                totalMs: { $subtract: ['$curriculum.sessionEndDate', '$curriculum.sessionStartDate'] },
                elapsedMs: { $max: [0, { $subtract: [new Date(), '$curriculum.sessionStartDate'] }] },
              },
              in: {
                $min: [100, { $round: [{ $multiply: [{ $divide: ['$$elapsedMs', '$$totalMs'] }, 100] }, 0] }],
              },
            },
          },
        },
      },
      {
        $addFields: {
          behindByPercentage: { $max: [0, { $subtract: ['$expectedPercentage', '$completionPercentage'] }] },
          isOnTrack: { $lt: [{ $subtract: ['$expectedPercentage', '$completionPercentage'] }, 10] },
        },
      },
      
      // Filter stage
      { $match: { isActive: true } },
    ]

    // Apply optional filters
    if (cls) pipeline.push({ $match: { 'curriculum.class': cls } })
    if (section) pipeline.push({ $match: { section: section.toUpperCase() } })
    if (subject) pipeline.push({ $match: { 'curriculum.subject': { $regex: subject, $options: 'i' } } })
    if (academicYear) pipeline.push({ $match: { 'curriculum.academicYear': academicYear } })
    if (teacher) pipeline.push({ $match: { teacher: new mongoose.Types.ObjectId(teacher) } })
    if (flaggedOnly === 'true') pipeline.push({ $match: { flaggedForAttention: true } })
    if (belowPercentage) pipeline.push({ $match: { completionPercentage: { $lt: parseInt(belowPercentage) } } })

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: 'total' }]
    const [countResult] = await SyllabusProgress.aggregate(countPipeline)
    const total = countResult?.total || 0

    // Add sorting and pagination
    pipeline.push(
      { $sort: { 'curriculum.class': 1, section: 1, 'curriculum.subject': 1 } },
      { $skip: skip },
      { $limit: limitNum },
      // Project final shape
      {
        $project: {
          _id: 1,
          class: '$curriculum.class',
          section: 1,
          subject: '$curriculum.subject',
          academicYear: '$curriculum.academicYear',
          teacher: {
            _id: '$teacherDoc._id',
            teacherId: '$teacherDoc.teacherId',
            firstName: '$teacherDoc.firstName',
            lastName: '$teacherDoc.lastName',
          },
          totalChapters: 1,
          completedChapters: 1,
          completionPercentage: 1,
          isOnTrack: 1,
          behindByPercentage: 1,
          flaggedForAttention: 1,
          lessonPlansSubmitted: 1,
          lessonPlansApproved: 1,
          pendingApprovals: 1,
          lastReviewedAt: 1,
        },
      }
    )

    const records = await SyllabusProgress.aggregate(pipeline)

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err: any) {
    console.error('getAllProgress error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/principal/curriculum/summary
// OPTIMIZED: Single aggregation pipeline instead of 6 parallel queries
// ═══════════════════════════════════════════════════════════════════════════════
export const getCurriculumSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYear } = req.query as { academicYear?: string }

    // Single optimized aggregation pipeline
    const [summary] = await SyllabusProgress.aggregate([
      // Join with MasterCurriculum
      {
        $lookup: {
          from: 'mastercurriculums',
          localField: 'masterCurriculum',
          foreignField: '_id',
          as: 'curriculum',
        },
      },
      { $unwind: '$curriculum' },
      
      // Filter by academicYear if provided
      ...(academicYear ? [{ $match: { 'curriculum.academicYear': academicYear } }] : []),
      { $match: { isActive: true } },
      
      // Calculate dynamic metrics per document
      {
        $addFields: {
          totalChapters: { $size: '$curriculum.chapters' },
          completedChapters: {
            $size: {
              $filter: {
                input: '$chapterProgress',
                cond: { $eq: ['$$this.status', 'completed'] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          completionPercentage: {
            $cond: {
              if: { $gt: ['$totalChapters', 0] },
              then: { $multiply: [{ $divide: ['$completedChapters', '$totalChapters'] }, 100] },
              else: 0,
            },
          },
          expectedPercentage: {
            $let: {
              vars: {
                totalMs: { $subtract: ['$curriculum.sessionEndDate', '$curriculum.sessionStartDate'] },
                elapsedMs: { $max: [0, { $subtract: [new Date(), '$curriculum.sessionStartDate'] }] },
              },
              in: { $min: [100, { $multiply: [{ $divide: ['$$elapsedMs', '$$totalMs'] }, 100] }] },
            },
          },
        },
      },
      {
        $addFields: {
          behindByPercentage: { $max: [0, { $subtract: ['$expectedPercentage', '$completionPercentage'] }] },
          isOnTrack: { $lt: [{ $subtract: ['$expectedPercentage', '$completionPercentage'] }, 10] },
        },
      },
      
      // Single $facet to compute all metrics in one pass
      {
        $facet: {
          // Overview metrics
          overview: [
            {
              $group: {
                _id: null,
                totalSubjects: { $sum: 1 },
                avgCompletionPercentage: { $avg: '$completionPercentage' },
                flaggedForAttention: { $sum: { $cond: ['$flaggedForAttention', 1, 0] } },
                pendingLessonPlanApprovals: { $sum: '$pendingApprovals' },
                onTrackCount: { $sum: { $cond: ['$isOnTrack', 1, 0] } },
              },
            },
          ],
          
          // Lagging classes (behind by >= 15%)
          laggingClasses: [
            { $match: { behindByPercentage: { $gte: 15 } } },
            { $sort: { behindByPercentage: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'teachers',
                localField: 'teacher',
                foreignField: '_id',
                as: 'teacherDoc',
              },
            },
            { $unwind: { path: '$teacherDoc', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                class: '$curriculum.class',
                section: 1,
                subject: '$curriculum.subject',
                teacherName: { $concat: ['$teacherDoc.firstName', ' ', '$teacherDoc.lastName'] },
                completionPercentage: { $round: ['$completionPercentage', 0] },
                behindBy: { $round: ['$behindByPercentage', 0] },
              },
            },
          ],
          
          // By class breakdown
          byClass: [
            {
              $group: {
                _id: '$curriculum.class',
                avgCompletion: { $avg: '$completionPercentage' },
                totalSubjects: { $sum: 1 },
                flaggedCount: { $sum: { $cond: ['$flaggedForAttention', 1, 0] } },
                onTrackCount: { $sum: { $cond: ['$isOnTrack', 1, 0] } },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                class: '$_id',
                avgCompletion: { $round: ['$avgCompletion', 0] },
                totalSubjects: 1,
                flaggedCount: 1,
                onTrackCount: 1,
                _id: 0,
              },
            },
          ],
        },
      },
    ])

    const overview = summary?.overview[0] || {
      totalSubjects: 0,
      avgCompletionPercentage: 0,
      flaggedForAttention: 0,
      pendingLessonPlanApprovals: 0,
      onTrackCount: 0,
    }

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalSubjects: overview.totalSubjects,
          avgCompletionPercentage: Math.round(overview.avgCompletionPercentage || 0),
          flaggedForAttention: overview.flaggedForAttention,
          pendingLessonPlanApprovals: overview.pendingLessonPlanApprovals,
          onTrackCount: overview.onTrackCount,
        },
        laggingClasses: summary?.laggingClasses || [],
        byClass: summary?.byClass || [],
      },
    })
  } catch (err: any) {
    console.error('getCurriculumSummary error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/principal/curriculum/:id
// Get detailed syllabus progress with dynamic calculation
// ═══════════════════════════════════════════════════════════════════════════════
export const getProgressDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const progress = await SyllabusProgress.findById(req.params.id)
      .populate('teacher', 'firstName lastName teacherId email phone')
      .populate('lastReviewedBy', 'firstName lastName')
      .populate('masterCurriculum')

    if (!progress) {
      res.status(404).json({ success: false, message: 'Progress record not found.' })
      return
    }

    const curriculum = progress.masterCurriculum as unknown as IMasterCurriculum
    if (!curriculum) {
      res.status(404).json({ success: false, message: 'Master curriculum not found.' })
      return
    }

    const metrics = calculateProgressMetrics(progress, curriculum)

    // Merge chapter definitions with progress
    const chaptersWithProgress = curriculum.chapters.map(chapterDef => {
      const chapterProgress = progress.chapterProgress.find(
        cp => cp.chapterId.toString() === chapterDef._id.toString()
      )
      return {
        chapterId: chapterDef._id,
        chapterNumber: chapterDef.chapterNumber,
        chapterName: chapterDef.chapterName,
        totalTopics: chapterDef.totalTopics,
        expectedHours: chapterDef.expectedHours,
        expectedWeekNumber: chapterDef.expectedWeekNumber,
        // Progress data
        completedTopics: chapterProgress?.completedTopics || 0,
        hoursSpent: chapterProgress?.hoursSpent || 0,
        status: chapterProgress?.status || 'not_started',
        startedAt: chapterProgress?.startedAt,
        completedAt: chapterProgress?.completedAt,
        teacherRemarks: chapterProgress?.teacherRemarks || '',
      }
    })

    res.status(200).json({
      success: true,
      data: {
        _id: progress._id,
        class: curriculum.class,
        section: progress.section,
        subject: curriculum.subject,
        academicYear: curriculum.academicYear,
        term: curriculum.term,
        
        // Dynamic metrics
        ...metrics,
        
        // Teacher info
        teacherName: `${(progress.teacher as any)?.firstName} ${(progress.teacher as any)?.lastName}`,
        teacherId: (progress.teacher as any)?.teacherId,
        teacherEmail: (progress.teacher as any)?.email,
        teacherPhone: (progress.teacher as any)?.phone,
        
        // Chapters with merged data
        chapters: chaptersWithProgress,
        
        // Lesson plans
        lessonPlansSubmitted: progress.lessonPlansSubmitted,
        lessonPlansApproved: progress.lessonPlansApproved,
        pendingApprovals: progress.pendingApprovals,
        
        // Review info
        lastReviewedBy: progress.lastReviewedBy,
        lastReviewedAt: progress.lastReviewedAt,
        principalRemarks: progress.principalRemarks,
        flaggedForAttention: progress.flaggedForAttention,
        reviewedByName: progress.lastReviewedBy
          ? `${(progress.lastReviewedBy as any)?.firstName} ${(progress.lastReviewedBy as any)?.lastName}`
          : null,
        
        // Session dates for UI
        sessionStartDate: curriculum.sessionStartDate,
        sessionEndDate: curriculum.sessionEndDate,
      },
    })
  } catch (err: any) {
    console.error('getProgressDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/principal/curriculum/:id/review
// ATOMIC: Uses findOneAndUpdate with $set/$inc to prevent lost updates
// ═══════════════════════════════════════════════════════════════════════════════
export const reviewProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { principalRemarks, flaggedForAttention, approveLessonPlans } = req.body
    const progressId = req.params.id

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(progressId)) {
      res.status(400).json({ success: false, message: 'Invalid progress ID.' })
      return
    }

    const principal = await Principal.findOne({ user: req.user!.userId })
    if (!principal) {
      res.status(403).json({ success: false, message: 'Principal not found.' })
      return
    }

    // Build atomic update operations
    const updateOps: Record<string, any> = {
      $set: {
        lastReviewedBy: principal._id,
        lastReviewedAt: new Date(),
      },
    }

    if (principalRemarks !== undefined) {
      updateOps.$set.principalRemarks = principalRemarks
    }

    if (typeof flaggedForAttention === 'boolean') {
      updateOps.$set.flaggedForAttention = flaggedForAttention
    }

    // ATOMIC lesson plan approval - prevents race condition
    // This atomically moves pendingApprovals to lessonPlansApproved
    if (approveLessonPlans) {
      // Use aggregation pipeline update for atomic transfer
      const result = await SyllabusProgress.findOneAndUpdate(
        { 
          _id: progressId,
          pendingApprovals: { $gt: 0 },  // Only if there are pending approvals
        },
        [
          {
            $set: {
              lessonPlansApproved: { $add: ['$lessonPlansApproved', '$pendingApprovals'] },
              pendingApprovals: 0,
              lastReviewedBy: principal._id,
              lastReviewedAt: new Date(),
              ...(principalRemarks !== undefined && { principalRemarks }),
              ...(typeof flaggedForAttention === 'boolean' && { flaggedForAttention }),
            },
          },
        ],
        { new: true }
      ).populate('masterCurriculum')

      if (!result) {
        // Either not found or no pending approvals - try regular update
        const fallbackResult = await SyllabusProgress.findByIdAndUpdate(
          progressId,
          updateOps,
          { new: true }
        ).populate('masterCurriculum')

        if (!fallbackResult) {
          res.status(404).json({ success: false, message: 'Progress record not found.' })
          return
        }

        res.status(200).json({
          success: true,
          message: 'Progress reviewed (no pending approvals to process).',
          data: fallbackResult,
        })
        return
      }

      res.status(200).json({
        success: true,
        message: 'Progress reviewed and lesson plans approved.',
        data: result,
      })
      return
    }

    // Standard update without lesson plan approval
    const result = await SyllabusProgress.findByIdAndUpdate(
      progressId,
      updateOps,
      { new: true }
    ).populate('masterCurriculum')

    if (!result) {
      res.status(404).json({ success: false, message: 'Progress record not found.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Progress reviewed successfully.',
      data: result,
    })
  } catch (err: any) {
    console.error('reviewProgress error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/principal/curriculum/teacher/:teacherId
// Get all syllabus progress for a specific teacher with DYNAMIC calculation
// ═══════════════════════════════════════════════════════════════════════════════
export const getTeacherProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await Teacher.findOne({
      teacherId: req.params.teacherId.toUpperCase(),
      isActive: true,
    })

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    // Aggregation with dynamic calculation
    const progressData = await SyllabusProgress.aggregate([
      { $match: { teacher: teacher._id, isActive: true } },
      
      // Join with MasterCurriculum
      {
        $lookup: {
          from: 'mastercurriculums',
          localField: 'masterCurriculum',
          foreignField: '_id',
          as: 'curriculum',
        },
      },
      { $unwind: '$curriculum' },
      
      // Calculate dynamic metrics
      {
        $addFields: {
          totalChapters: { $size: '$curriculum.chapters' },
          completedChapters: {
            $size: {
              $filter: {
                input: '$chapterProgress',
                cond: { $eq: ['$$this.status', 'completed'] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          completionPercentage: {
            $cond: {
              if: { $gt: ['$totalChapters', 0] },
              then: { $round: [{ $multiply: [{ $divide: ['$completedChapters', '$totalChapters'] }, 100] }, 0] },
              else: 0,
            },
          },
          expectedPercentage: {
            $let: {
              vars: {
                totalMs: { $subtract: ['$curriculum.sessionEndDate', '$curriculum.sessionStartDate'] },
                elapsedMs: { $max: [0, { $subtract: [new Date(), '$curriculum.sessionStartDate'] }] },
              },
              in: { $min: [100, { $round: [{ $multiply: [{ $divide: ['$$elapsedMs', '$$totalMs'] }, 100] }, 0] }] },
            },
          },
        },
      },
      {
        $addFields: {
          behindByPercentage: { $max: [0, { $subtract: ['$expectedPercentage', '$completionPercentage'] }] },
          isOnTrack: { $lt: [{ $subtract: ['$expectedPercentage', '$completionPercentage'] }, 10] },
        },
      },
      
      { $sort: { 'curriculum.class': 1, section: 1, 'curriculum.subject': 1 } },
      
      // Use $facet to get both summary and detailed progress in one query
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalAssignments: { $sum: 1 },
                avgCompletion: { $avg: '$completionPercentage' },
                flaggedCount: { $sum: { $cond: ['$flaggedForAttention', 1, 0] } },
                onTrackCount: { $sum: { $cond: ['$isOnTrack', 1, 0] } },
              },
            },
          ],
          progress: [
            {
              $project: {
                _id: 1,
                class: '$curriculum.class',
                section: 1,
                subject: '$curriculum.subject',
                academicYear: '$curriculum.academicYear',
                completionPercentage: 1,
                isOnTrack: 1,
                behindByPercentage: 1,
                flaggedForAttention: 1,
                pendingApprovals: 1,
              },
            },
          ],
        },
      },
    ])

    const result = progressData[0] || { summary: [], progress: [] }
    const summary = result.summary[0] || {
      totalAssignments: 0,
      avgCompletion: 0,
      flaggedCount: 0,
      onTrackCount: 0,
    }

    res.status(200).json({
      success: true,
      data: {
        teacher: {
          teacherId: teacher.teacherId,
          name: `${teacher.firstName} ${teacher.lastName}`,
          subjects: teacher.subjects,
        },
        summary: {
          totalAssignments: summary.totalAssignments,
          avgCompletion: Math.round(summary.avgCompletion || 0),
          flaggedCount: summary.flaggedCount,
          onTrackCount: summary.onTrackCount,
        },
        progress: result.progress,
      },
    })
  } catch (err: any) {
    console.error('getTeacherProgress error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/principal/curriculum
// Create a new syllabus progress record linked to MasterCurriculum
// NO new Date() - academicYear comes from MasterCurriculum
// ═══════════════════════════════════════════════════════════════════════════════
export const createProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      masterCurriculumId,  // Required: links to the master curriculum
      section,
      teacherId,
    } = req.body

    // Validate required fields
    if (!masterCurriculumId || !section || !teacherId) {
      res.status(400).json({
        success: false,
        message: 'masterCurriculumId, section, and teacherId are required.',
      })
      return
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(masterCurriculumId)) {
      res.status(400).json({ success: false, message: 'Invalid masterCurriculumId.' })
      return
    }

    // Find and validate master curriculum
    const curriculum = await MasterCurriculum.findById(masterCurriculumId)
    if (!curriculum) {
      res.status(404).json({ success: false, message: 'Master curriculum not found.' })
      return
    }

    if (!curriculum.isActive) {
      res.status(400).json({ success: false, message: 'Master curriculum is not active.' })
      return
    }

    // Find teacher
    const teacher = await Teacher.findOne({ teacherId: teacherId.toUpperCase(), isActive: true })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    // Check if progress already exists for this curriculum-section
    const existing = await SyllabusProgress.findOne({
      masterCurriculum: masterCurriculumId,
      section: section.toUpperCase(),
    })

    if (existing) {
      res.status(400).json({
        success: false,
        message: `Syllabus progress already exists for ${curriculum.class}-${section.toUpperCase()} ${curriculum.subject} (${curriculum.academicYear}).`,
      })
      return
    }

    // Initialize chapter progress array from master curriculum
    const initialChapterProgress = curriculum.chapters.map(chapter => ({
      chapterId: chapter._id,
      completedTopics: 0,
      hoursSpent: 0,
      status: 'not_started' as const,
      teacherRemarks: '',
    }))

    const progress = await SyllabusProgress.create({
      masterCurriculum: masterCurriculumId,
      section: section.toUpperCase(),
      teacher: teacher._id,
      chapterProgress: initialChapterProgress,
    })

    res.status(201).json({
      success: true,
      message: `Syllabus progress created for ${curriculum.class}-${section.toUpperCase()} ${curriculum.subject}.`,
      data: {
        _id: progress._id,
        class: curriculum.class,
        section: progress.section,
        subject: curriculum.subject,
        academicYear: curriculum.academicYear,
        teacherId: teacher.teacherId,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        totalChapters: curriculum.chapters.length,
      },
    })
  } catch (err: any) {
    console.error('createProgress error:', err)
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Duplicate progress record.' })
      return
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/principal/curriculum/master
// Create a new master curriculum (Principal only)
// ═══════════════════════════════════════════════════════════════════════════════
export const createMasterCurriculum = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      class: cls,
      subject,
      academicYear,  // Required from frontend - NO server-side default
      term,
      chapters,
      sessionStartDate,
      sessionEndDate,
    } = req.body

    // Validate required fields
    if (!cls || !subject || !academicYear || !term || !chapters || !sessionStartDate || !sessionEndDate) {
      res.status(400).json({
        success: false,
        message: 'class, subject, academicYear, term, chapters, sessionStartDate, and sessionEndDate are required.',
      })
      return
    }

    // Validate academicYear format
    if (!/^\d{4}-\d{2}$/.test(academicYear)) {
      res.status(400).json({
        success: false,
        message: 'academicYear must be in format YYYY-YY (e.g., 2025-26).',
      })
      return
    }

    // Validate chapters array
    if (!Array.isArray(chapters) || chapters.length === 0) {
      res.status(400).json({
        success: false,
        message: 'chapters must be a non-empty array.',
      })
      return
    }

    const principal = await Principal.findOne({ user: req.user!.userId })
    if (!principal) {
      res.status(403).json({ success: false, message: 'Principal not found.' })
      return
    }

    // Calculate total expected hours
    const totalExpectedHours = chapters.reduce((sum: number, ch: any) => sum + (ch.expectedHours || 0), 0)
    const totalWeeks = Math.max(...chapters.map((ch: any) => ch.expectedWeekNumber || 0))

    const curriculum = await MasterCurriculum.create({
      class: cls,
      subject,
      academicYear,
      term,
      chapters,
      totalExpectedHours,
      totalWeeks,
      sessionStartDate: new Date(sessionStartDate),
      sessionEndDate: new Date(sessionEndDate),
      createdBy: principal._id,
    })

    res.status(201).json({
      success: true,
      message: `Master curriculum created for Class ${cls} ${subject} (${academicYear}).`,
      data: curriculum,
    })
  } catch (err: any) {
    console.error('createMasterCurriculum error:', err)
    if (err.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Master curriculum already exists for this class-subject-year-term combination.',
      })
      return
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/principal/curriculum/master
// List all master curriculums
// ═══════════════════════════════════════════════════════════════════════════════
export const getMasterCurriculums = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicYear, class: cls, subject } = req.query as any

    const filter: Record<string, any> = { isActive: true }
    if (academicYear) filter.academicYear = academicYear
    if (cls) filter.class = cls
    if (subject) filter.subject = { $regex: subject, $options: 'i' }

    const curriculums = await MasterCurriculum.find(filter)
      .select('class subject academicYear term totalExpectedHours totalWeeks sessionStartDate sessionEndDate createdAt')
      .sort({ class: 1, subject: 1 })

    res.status(200).json({
      success: true,
      data: curriculums,
    })
  } catch (err: any) {
    console.error('getMasterCurriculums error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
