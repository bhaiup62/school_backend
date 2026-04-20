// src/models/principal/SyllabusProgress.ts
// Per-section progress tracking that REFERENCES MasterCurriculum
// NO embedded chapter data - only progress state against master curriculum

import mongoose, { Schema, Document, Model } from 'mongoose'

// ═══════════════════════════════════════════════════════════════════════════════
// CHAPTER PROGRESS (References chapter ObjectId from MasterCurriculum)
// ═══════════════════════════════════════════════════════════════════════════════
export interface IChapterProgress {
  chapterId: mongoose.Types.ObjectId   // References MasterCurriculum.chapters._id
  completedTopics: number
  hoursSpent: number
  status: 'not_started' | 'in_progress' | 'completed'
  startedAt?: Date
  completedAt?: Date
  teacherRemarks: string
}

const ChapterProgressSchema = new Schema<IChapterProgress>(
  {
    chapterId: {
      type: Schema.Types.ObjectId,
      required: true,
      // Note: This references MasterCurriculum.chapters._id (subdocument)
    },
    completedTopics: { type: Number, default: 0, min: 0 },
    hoursSpent: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started',
    },
    startedAt: Date,
    completedAt: Date,
    teacherRemarks: { type: String, default: '', trim: true },
  },
  { _id: false }
)

// ═══════════════════════════════════════════════════════════════════════════════
// SYLLABUS PROGRESS MODEL
// Tracks a specific teacher's progress for a class-section against MasterCurriculum
// ═══════════════════════════════════════════════════════════════════════════════
export interface ISyllabusProgress extends Document {
  // Foreign key to master curriculum
  masterCurriculum: mongoose.Types.ObjectId
  
  // Section-specific identity (class/subject/year come from masterCurriculum)
  section: string
  teacher: mongoose.Types.ObjectId
  
  // Progress tracking (references master curriculum chapters)
  chapterProgress: IChapterProgress[]
  
  // Lesson plan tracking
  lessonPlansSubmitted: number
  lessonPlansApproved: number
  pendingApprovals: number
  
  // Principal oversight
  lastReviewedBy?: mongoose.Types.ObjectId
  lastReviewedAt?: Date
  principalRemarks: string
  flaggedForAttention: boolean
  
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const SyllabusProgressSchema = new Schema<ISyllabusProgress>(
  {
    masterCurriculum: {
      type: Schema.Types.ObjectId,
      ref: 'MasterCurriculum',
      required: [true, 'Master curriculum reference is required'],
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      uppercase: true,
      trim: true,
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher is required'],
    },
    
    // NO completionPercentage - calculated dynamically in controller
    // NO isOnTrack / behindByPercentage - calculated dynamically
    // NO totalChapters / completedChapters - derived from chapterProgress
    // NO academicYear / class / subject - comes from masterCurriculum ref
    
    chapterProgress: [ChapterProgressSchema],
    
    lessonPlansSubmitted: { type: Number, default: 0, min: 0 },
    lessonPlansApproved: { type: Number, default: 0, min: 0 },
    pendingApprovals: { type: Number, default: 0, min: 0 },
    
    lastReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Principal',
    },
    lastReviewedAt: Date,
    principalRemarks: { type: String, default: '', trim: true },
    flaggedForAttention: { type: Boolean, default: false },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// ═══════════════════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════════════════
// Unique progress per curriculum-section combination
SyllabusProgressSchema.index(
  { masterCurriculum: 1, section: 1 },
  { unique: true }
)
SyllabusProgressSchema.index({ teacher: 1 })
SyllabusProgressSchema.index({ flaggedForAttention: 1 })
SyllabusProgressSchema.index({ masterCurriculum: 1, isActive: 1 })

// NO pre('save') hook - completionPercentage is calculated in controllers

const SyllabusProgress: Model<ISyllabusProgress> =
  mongoose.models.SyllabusProgress || mongoose.model<ISyllabusProgress>('SyllabusProgress', SyllabusProgressSchema)

export default SyllabusProgress
