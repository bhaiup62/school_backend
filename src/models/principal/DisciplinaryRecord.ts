// src/models/DisciplinaryRecord.ts
// Model for tracking student disciplinary actions
// ═══════════════════════════════════════════════════════════════════════════════
// Production-ready with unique recordId for frontend consistency
// Academic Year Rollover Ready - snapshots student's class/section at incident time
// ═══════════════════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document, Model } from 'mongoose'

// Valid categories for strict validation
export const DISCIPLINE_CATEGORIES = [
  'misconduct',
  'bullying',
  'vandalism',
  'cheating',
  'truancy',
  'violence',
  'substance',
  'harassment',
  'other',
] as const

export type DisciplineCategory = (typeof DISCIPLINE_CATEGORIES)[number]

export interface IDisciplinaryRecord extends Document {
  recordId: string  // Unique sequential ID (e.g., DISC-2026-0001)
  student: mongoose.Types.ObjectId
  // Snapshot fields - preserve student's academic position at incident time
  studentClassAtTime: string    // Class when incident occurred (e.g., "10")
  studentSectionAtTime: string  // Section when incident occurred (e.g., "A")
  sessionAtTime: string         // Academic session (e.g., "2025-26")
  
  reportedBy: mongoose.Types.ObjectId  // Teacher who reported
  reportedByRole: 'teacher' | 'principal' | 'receptionist'
  incidentDate: Date
  incidentType: 'minor' | 'moderate' | 'severe' | 'critical'
  category: DisciplineCategory
  description: string
  location: string
  witnesses: string[]
  
  // Principal's action
  status: 'pending' | 'under_review' | 'resolved' | 'escalated'
  principalRemarks: string
  actionTaken: 'warning' | 'detention' | 'suspension' | 'rustication' | 'counseling' | 'parent_meeting' | 'none'
  actionDetails: string
  suspensionDays: number
  suspensionStartDate: Date
  suspensionEndDate: Date
  
  // Notifications
  parentNotified: boolean
  parentNotifiedAt: Date
  parentAcknowledged: boolean
  parentAcknowledgedAt: Date
  
  // Permanent record flag
  addToPermanentRecord: boolean
  
  // Audit
  reviewedBy: mongoose.Types.ObjectId  // Principal
  reviewedAt: Date
  
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const DisciplinaryRecordSchema = new Schema<IDisciplinaryRecord>(
  {
    // Sequential unique record ID
    recordId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true,
    },
    // Snapshot fields - captures student's academic position at incident time
    // These prevent "time travel" when student is promoted to a new class
    studentClassAtTime: {
      type: String,
      required: [true, 'Student class at time of incident is required'],
    },
    studentSectionAtTime: {
      type: String,
      required: [true, 'Student section at time of incident is required'],
    },
    sessionAtTime: {
      type: String,
      required: [true, 'Academic session at time of incident is required'],
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      refPath: 'reportedByRole',
      required: true,
    },
    reportedByRole: {
      type: String,
      enum: ['teacher', 'principal', 'receptionist'],
      default: 'teacher',
    },
    incidentDate: {
      type: Date,
      required: [true, 'Incident date is required'],
      default: Date.now,
      index: true,
    },
    incidentType: {
      type: String,
      enum: ['minor', 'moderate', 'severe', 'critical'],
      default: 'minor',
      index: true,
    },
    category: {
      type: String,
      enum: DISCIPLINE_CATEGORIES,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 2000,
    },
    location: {
      type: String,
      default: '',
    },
    witnesses: [{
      type: String,
    }],
    
    status: {
      type: String,
      enum: ['pending', 'under_review', 'resolved', 'escalated'],
      default: 'pending',
      index: true,
    },
    principalRemarks: {
      type: String,
      default: '',
    },
    actionTaken: {
      type: String,
      enum: ['warning', 'detention', 'suspension', 'rustication', 'counseling', 'parent_meeting', 'none'],
      default: 'none',
    },
    actionDetails: {
      type: String,
      default: '',
    },
    suspensionDays: {
      type: Number,
      default: 0,
    },
    suspensionStartDate: Date,
    suspensionEndDate: Date,
    
    parentNotified: { type: Boolean, default: false },
    parentNotifiedAt: Date,
    parentAcknowledged: { type: Boolean, default: false },
    parentAcknowledgedAt: Date,
    
    addToPermanentRecord: { type: Boolean, default: false },
    
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Principal',
    },
    reviewedAt: Date,
    
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
)

// Compound indexes for common query patterns
DisciplinaryRecordSchema.index({ student: 1, incidentDate: -1 })
DisciplinaryRecordSchema.index({ status: 1, isActive: 1, incidentDate: -1 })
DisciplinaryRecordSchema.index({ incidentType: 1, status: 1, isActive: 1 })
DisciplinaryRecordSchema.index({ isActive: 1, incidentDate: -1 })
// New indexes for academic year queries
DisciplinaryRecordSchema.index({ sessionAtTime: 1, studentClassAtTime: 1 })
DisciplinaryRecordSchema.index({ student: 1, sessionAtTime: 1 })

const DisciplinaryRecord: Model<IDisciplinaryRecord> =
  mongoose.models.DisciplinaryRecord || mongoose.model<IDisciplinaryRecord>('DisciplinaryRecord', DisciplinaryRecordSchema)

export default DisciplinaryRecord
