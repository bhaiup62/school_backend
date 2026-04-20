// src/models/parent/Complaint.ts
// Model for grievance/complaint management
// ═══════════════════════════════════════════════════════════════════════════════
// Production-ready with atomic ticketNumber generation and nested resolution
// Academic Year Rollover Ready - snapshots student's class/section if complaint
// is related to a specific student (optional fields for non-student complaints)
// ═══════════════════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document, Model } from 'mongoose'

// Valid complaint categories for strict validation
export const COMPLAINT_CATEGORIES = [
  'academic',
  'behavioral',
  'infrastructure',
  'staff',
  'fees',
  'transport',
  'safety',
  'bullying',
  'other',
] as const

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]

export interface IComplaintComment {
  author: mongoose.Types.ObjectId
  authorRole: string
  authorName: string
  message: string
  createdAt: Date
}

// Resolution as a nested object structure for frontend compatibility
export interface IResolution {
  summary: string
  resolvedBy: mongoose.Types.ObjectId
  resolvedByName: string
  resolvedDate: Date
}

export interface IComplaint extends Document {
  ticketNumber: string  // Auto-generated via Counter: CMP-2026-0001
  
  // Complainant
  raisedBy: mongoose.Types.ObjectId
  raisedByRole: 'parent' | 'teacher' | 'student'
  raisedByName: string
  raisedByContact: string
  
  // Related student (if applicable)
  relatedStudent: mongoose.Types.ObjectId
  // Snapshot fields - only populated if relatedStudent is provided
  studentClassAtTime: string    // Class when complaint was filed (e.g., "10")
  studentSectionAtTime: string  // Section when complaint was filed (e.g., "A")
  sessionAtTime: string         // Academic session (e.g., "2025-26")
  
  // Complaint details
  category: ComplaintCategory
  subcategory: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  
  // Against (optional)
  againstType: 'teacher' | 'student' | 'staff' | 'infrastructure' | 'policy' | 'none'
  againstPerson: mongoose.Types.ObjectId
  againstPersonName: string
  
  // Status workflow
  status: 'open' | 'in_progress' | 'pending_info' | 'escalated' | 'resolved' | 'closed' | 'rejected'
  
  // Assignment
  assignedTo: mongoose.Types.ObjectId
  assignedToRole: string
  assignedToName: string
  assignedAt: Date
  
  // Department routing
  department: string  // 'administration', 'academics', 'discipline', 'accounts', 'transport', 'infrastructure'
  
  // Resolution as nested object
  resolution: IResolution
  
  // Principal action
  escalatedToPrincipal: boolean
  escalatedAt: Date
  principalRemarks: string
  principalActionTaken: string
  
  // Communication
  comments: IComplaintComment[]
  
  // Satisfaction
  feedbackRating: number  // 1-5
  feedbackComment: string
  
  // Timestamps
  dueDate: Date
  isOverdue: boolean
  
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const CommentSchema = new Schema<IComplaintComment>(
  {
    author: { type: Schema.Types.ObjectId, required: true },
    authorRole: { type: String, required: true },
    authorName: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

// Resolution as nested object schema
const ResolutionSchema = new Schema<IResolution>(
  {
    summary: { type: String, default: '' },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'Principal' },
    resolvedByName: { type: String, default: '' },
    resolvedDate: { type: Date },
  },
  { _id: false }
)

const ComplaintSchema = new Schema<IComplaint>(
  {
    // ticketNumber is generated atomically via Counter
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
    },
    
    raisedBy: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    raisedByRole: {
      type: String,
      enum: ['parent', 'teacher', 'student'],
      required: true,
    },
    raisedByName: { type: String, required: true },
    raisedByContact: { type: String, default: '' },
    
    relatedStudent: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
    },
    studentClassAtTime: {
      type: String,
      default: '',
    },
    studentSectionAtTime: {
      type: String,
      default: '',
    },
    sessionAtTime: {
      type: String,
      default: '',
    },
    
    category: {
      type: String,
      enum: COMPLAINT_CATEGORIES,
      required: true,
    },
    subcategory: { type: String, default: '' },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 5000,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    
    againstType: {
      type: String,
      enum: ['teacher', 'student', 'staff', 'infrastructure', 'policy', 'none'],
      default: 'none',
    },
    againstPerson: { type: Schema.Types.ObjectId },
    againstPersonName: { type: String, default: '' },
    
    status: {
      type: String,
      enum: ['open', 'in_progress', 'pending_info', 'escalated', 'resolved', 'closed', 'rejected'],
      default: 'open',
    },
    
    assignedTo: { type: Schema.Types.ObjectId },
    assignedToRole: { type: String, default: '' },
    assignedToName: { type: String, default: '' },
    assignedAt: Date,
    
    department: {
      type: String,
      enum: ['administration', 'academics', 'discipline', 'accounts', 'transport', 'infrastructure', 'general'],
      default: 'general',
    },
    
    resolution: { type: ResolutionSchema, default: {} },
    
    escalatedToPrincipal: { type: Boolean, default: false },
    escalatedAt: Date,
    principalRemarks: { type: String, default: '' },
    principalActionTaken: { type: String, default: '' },
    
    comments: [CommentSchema],
    
    feedbackRating: { type: Number, min: 1, max: 5 },
    feedbackComment: { type: String, default: '' },
    
    dueDate: Date,
    isOverdue: { type: Boolean, default: false },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

ComplaintSchema.index({ status: 1, isActive: 1 })
ComplaintSchema.index({ raisedBy: 1 })
ComplaintSchema.index({ priority: -1, createdAt: -1 })
ComplaintSchema.index({ escalatedToPrincipal: 1, status: 1 })
ComplaintSchema.index({ department: 1 })
ComplaintSchema.index({ isOverdue: 1, status: 1 })
ComplaintSchema.index({ createdAt: -1 })
ComplaintSchema.index({ relatedStudent: 1, sessionAtTime: 1 })
ComplaintSchema.index({ sessionAtTime: 1, studentClassAtTime: 1 })

const Complaint: Model<IComplaint> =
  mongoose.models.Complaint || mongoose.model<IComplaint>('Complaint', ComplaintSchema)

export default Complaint