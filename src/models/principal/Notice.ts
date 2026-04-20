// src/models/Notice.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Academic Year Rollover Ready - notices are now bound to a specific academic year
// This ensures historical notices remain queryable even after student promotions
// ═══════════════════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface INotice extends Document {
  title:           string
  content:         string
  tag:             string          // 'general' | 'academic' | 'event' | 'exam' | 'holiday' | 'sports' | 'urgent' | 'fee' | 'meeting'
  priority:        string          // 'general' | 'academic' | 'event' | 'holiday' | 'exam' | 'sports' | 'high' | 'normal' | 'urgent'
  targetClass:     string          // 'ALL' or specific class like '9', '10'
  targetSection:   string          // 'ALL' or 'A', 'B', etc.
  targetAudience:  string          // 'all' | 'students' | 'teachers' | 'parents' | 'staff'
  academicYear:    string          // e.g., "2025-26" - binds notice to specific academic session
  
  // Creator info
  postedBy:        string          // Creator's full name
  postedById:      string          // Creator's ID (teacherId/principalId)
  postedByRole:    string          // 'teacher' | 'principal' | 'admin'
  
  // Dates
  date:            string          // Date string YYYY-MM-DD
  publishDate:     Date | null     // When to publish (for scheduled notices)
  expiresAt:       Date | null     // Expiry date
  
  // Status flags
  isActive:        boolean         // Still active/visible
  
  // Approval workflow
  status:          string          // 'pending' | 'approved' | 'rejected'
  approvedBy:      string | null   // Principal who approved
  approvedAt:      Date | null
  rejectionReason: string | null
  
  // Soft delete
  isDeleted:       boolean
  deletedBy:       string | null   // Who deleted
  deletedByRole:   string | null   // 'principal' | 'teacher'
  deletedAt:       Date | null
  
  createdAt:       Date
  updatedAt:       Date
}

const getISTDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

const NoticeSchema = new Schema<INotice>(
  {
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    content: {
      type:     String,
      required: true,
    },
    tag: {
      type:    String,
      enum:    ['general', 'academic', 'event', 'exam', 'holiday', 'sports', 'urgent', 'fee', 'meeting'],
      default: 'general',
    },
    priority: {
      type:    String,
      enum:    ['general', 'academic', 'event', 'holiday', 'exam', 'sports', 'high', 'normal', 'urgent'],
      default: 'normal',
    },
    targetClass: {
      type:    String,
      default: 'ALL',
    },
    targetSection: {
      type:    String,
      default: 'ALL',
    },
    targetAudience: {
      type:    String,
      enum:    ['all', 'students', 'teachers', 'parents', 'staff'],
      default: 'all',
    },
    // Academic year binding - ensures notices don't "disappear" when students are promoted
    academicYear: {
      type:     String,
      required: [true, 'Academic year is required'],
      default: () => {
        // Academic year logic: if month >= April (3), use current year
        // e.g., April 2025 → "2025-26", February 2025 → "2024-25"
        const now = getISTDate()
        const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
        return `${year}-${(year + 1).toString().slice(2)}`
      },
    },
    // Creator info
    postedBy: {
      type:     String,
      required: true,
    },
    postedById: {
      type:     String,
      required: true,
      index:    true,
    },
    postedByRole: {
      type:     String,
      enum:     ['teacher', 'principal', 'admin'],
      required: true,
    },
    // Dates
    date: {
      type:    String,
      default: () => getISTDate().toISOString().split('T')[0],
    },
    publishDate: {
      type:    Date,
      default: null,
    },
    expiresAt: {
      type:    Date,
      default: null,
    },
    // Status
    isActive: {
      type:    Boolean,
      default: true,
    },
    // Approval workflow
    status: {
      type:    String,
      enum:    ['pending', 'approved', 'rejected'],
      default: 'pending',
      index:   true,
    },
    approvedBy: {
      type:    String,
      default: null,
    },
    approvedAt: {
      type:    Date,
      default: null,
    },
    rejectionReason: {
      type:    String,
      default: null,
    },
    // Soft delete
    isDeleted: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    deletedBy: {
      type:    String,
      default: null,
    },
    deletedByRole: {
      type:    String,
      enum:    ['teacher', 'principal', null],
      default: null,
    },
    deletedAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual for backward compatibility
NoticeSchema.virtual('teacherId').get(function() {
  return this.postedById
})

// Virtual for target display
NoticeSchema.virtual('targetDisplay').get(function() {
  if (this.targetClass === 'ALL') {
    return 'All Classes'
  }
  if (this.targetSection === 'ALL') {
    return `Class ${this.targetClass} (All Sections)`
  }
  return `Class ${this.targetClass}-${this.targetSection}`
})

// Indexes for efficient queries
// Updated to include academicYear for historical querying after student promotions
NoticeSchema.index({ postedById: 1, status: 1 })
NoticeSchema.index({ targetClass: 1, targetSection: 1, academicYear: 1 })  // Updated: added academicYear
NoticeSchema.index({ status: 1, isDeleted: 1, createdAt: -1 })
NoticeSchema.index({ postedByRole: 1, status: 1 })
NoticeSchema.index({ academicYear: 1, targetClass: 1, isDeleted: 1 })      // New: for academic year filtering
NoticeSchema.index({ academicYear: 1, targetAudience: 1, status: 1 })      // New: for audience + year queries

const Notice: Model<INotice> =
  mongoose.models.Notice || mongoose.model<INotice>('Notice', NoticeSchema)

export default Notice
