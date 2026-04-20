// src/models/Event.ts
// Model for school events and calendar management
// ═══════════════════════════════════════════════════════════════════════════════
// Production-ready with atomic eventId generation and optimized participant schema
// ═══════════════════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document, Model } from 'mongoose'

// Valid event types for strict validation
export const EVENT_TYPES = [
  'academic',
  'cultural',
  'sports',
  'ptm',
  'holiday',
  'exam',
  'meeting',
  'field_trip',
  'competition',
  'workshop',
  'assembly',
  'other',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

// FIX #4: Removed studentIds and teacherIds - rely on criteria-based targeting
export interface IEventParticipant {
  type: 'class' | 'section' | 'individual' | 'teacher' | 'all'
  classes: string[]  // FIX #1: Changed from single string to array
  sections: string[] // Optional: specific sections within classes
}

export interface IEvent extends Document {
  eventId: string  // Auto-generated via Counter: EVT-2026-0001
  
  // Basic info
  title: string
  description: string
  eventType: EventType
  category: 'internal' | 'external' | 'mandatory' | 'optional'
  
  // Schedule
  startDate: Date
  endDate: Date
  startTime: string  // "09:00"
  endTime: string    // "14:00"
  isAllDay: boolean
  isRecurring: boolean
  recurringPattern: string  // 'daily', 'weekly', 'monthly', 'yearly'
  
  // Location
  venue: string
  venueType: 'school_premises' | 'external' | 'online' | 'hybrid'
  onlineLink: string
  
  // Participants
  targetAudience: 'all' | 'students' | 'teachers' | 'parents' | 'staff' | 'specific'
  participants: IEventParticipant
  expectedAttendance: number
  
  // Organizer
  organizer: mongoose.Types.ObjectId
  organizerRole: 'teacher' | 'principal' | 'admin'
  organizerName: string
  contactPerson: string
  contactPhone: string
  
  // Approval workflow
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | 'completed'
  requestedBy: mongoose.Types.ObjectId
  requestedByName: string
  requestedAt: Date
  
  approvedBy: mongoose.Types.ObjectId
  approvedByName: string
  approvedAt: Date
  approvalRemarks: string
  
  rejectedBy: mongoose.Types.ObjectId
  rejectedReason: string
  rejectedAt: Date
  
  // Budget (if applicable)
  estimatedBudget: number
  budgetApproved: boolean
  actualExpense: number
  
  // PTM specific fields
  isPTM: boolean
  ptmAgenda: string[]
  ptmSlotDuration: number  // minutes per parent
  
  // Notifications
  notifyParents: boolean
  notifyTeachers: boolean
  notifyStudents: boolean
  notificationSentAt: Date
  
  // Attachments (paths/links)
  attachments: string[]
  
  // Post-event
  attendanceMarked: boolean
  actualAttendance: number
  eventReport: string
  
  // Priority for calendar
  priority: 'low' | 'normal' | 'high' | 'critical'
  showOnPublicCalendar: boolean
  
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// FIX #4: Removed unbounded studentIds/teacherIds arrays
const ParticipantSchema = new Schema<IEventParticipant>(
  {
    type: {
      type: String,
      enum: ['class', 'section', 'individual', 'teacher', 'all'],
      default: 'all',
    },
    // FIX #1: Changed from single string to array of strings
    classes: [{ type: String }],
    sections: [{ type: String }],
    // REMOVED: studentIds and teacherIds - these would bloat documents
  },
  { _id: false }
)

const EventSchema = new Schema<IEvent>(
  {
    // FIX #3: eventId is now generated atomically via Counter (no pre-save hook)
    eventId: {
      type: String,
      unique: true,
      required: true,  // Now required - set at creation time
    },
    
    title: {
      type: String,
      required: [true, 'Event title is required'],
      maxlength: 200,
    },
    description: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
    },
    category: {
      type: String,
      enum: ['internal', 'external', 'mandatory', 'optional'],
      default: 'internal',
    },
    
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    // FIX #2: endDate is still required in schema, but controller handles defaults
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '17:00' },
    isAllDay: { type: Boolean, default: false },
    isRecurring: { type: Boolean, default: false },
    recurringPattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly', 'none'],
      default: 'none',
    },
    
    venue: { type: String, default: 'School Campus' },
    venueType: {
      type: String,
      enum: ['school_premises', 'external', 'online', 'hybrid'],
      default: 'school_premises',
    },
    onlineLink: { type: String, default: '' },
    
    targetAudience: {
      type: String,
      enum: ['all', 'students', 'teachers', 'parents', 'staff', 'specific'],
      default: 'all',
    },
    participants: { type: ParticipantSchema, default: {} },
    expectedAttendance: { type: Number, default: 0 },
    
    organizer: { type: Schema.Types.ObjectId },
    organizerRole: {
      type: String,
      enum: ['teacher', 'principal', 'admin'],
      default: 'teacher',
    },
    organizerName: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'completed'],
      default: 'draft',
    },
    requestedBy: { type: Schema.Types.ObjectId },
    requestedByName: { type: String, default: '' },
    requestedAt: Date,
    
    approvedBy: { type: Schema.Types.ObjectId },
    approvedByName: { type: String, default: '' },
    approvedAt: Date,
    approvalRemarks: { type: String, default: '' },
    
    rejectedBy: { type: Schema.Types.ObjectId },
    rejectedReason: { type: String, default: '' },
    rejectedAt: Date,
    
    estimatedBudget: { type: Number, default: 0 },
    budgetApproved: { type: Boolean, default: false },
    actualExpense: { type: Number, default: 0 },
    
    isPTM: { type: Boolean, default: false },
    ptmAgenda: [{ type: String }],
    ptmSlotDuration: { type: Number, default: 10 },
    
    notifyParents: { type: Boolean, default: true },
    notifyTeachers: { type: Boolean, default: true },
    notifyStudents: { type: Boolean, default: true },
    notificationSentAt: Date,
    
    attachments: [{ type: String }],
    
    attendanceMarked: { type: Boolean, default: false },
    actualAttendance: { type: Number, default: 0 },
    eventReport: { type: String, default: '' },
    
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
    },
    showOnPublicCalendar: { type: Boolean, default: true },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// FIX #3: REMOVED pre('save') hook for eventId generation
// Event IDs are now generated atomically in the controller using Counter model

// Optimized compound indexes for common queries
EventSchema.index({ startDate: 1, status: 1 })  // Calendar queries
EventSchema.index({ status: 1, isActive: 1 })   // Pending approval queries
EventSchema.index({ eventType: 1, startDate: 1 })
EventSchema.index({ targetAudience: 1, startDate: 1 })
EventSchema.index({ 'participants.classes': 1 })  // Class-based filtering
EventSchema.index({ isPTM: 1, startDate: 1 })  // PTM queries

const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema)

export default Event
