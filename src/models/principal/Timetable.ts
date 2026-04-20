import mongoose, { Document, Schema } from 'mongoose'

export interface IPeriod {
  periodNumber: number
  startTime: string // "08:00"
  endTime: string   // "08:45"
  subject: string
  teacherId: string // TCH-2024-0001
  teacherName: string
  room?: string
  isBreak?: boolean
}

export interface IDaySchedule {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  periods: IPeriod[]
}

export interface ITimetable extends Document {
  class: string
  section: string
  academicYear: string // "2024-2025"
  effectiveFrom: Date
  effectiveTo?: Date
  schedule: IDaySchedule[]
  isActive: boolean
  createdBy: string // Principal ID
  createdByName: string
  updatedBy?: string
  updatedByName?: string
  createdAt: Date
  updatedAt: Date
}

const PeriodSchema = new Schema<IPeriod>(
  {
    periodNumber: { type: Number, required: true, min: 1, max: 10 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    subject: { type: String, required: true },
    teacherId: { type: String, required: true },
    teacherName: { type: String, required: true },
    room: { type: String },
    isBreak: { type: Boolean, default: false },
  },
  { _id: false }
)

const DayScheduleSchema = new Schema<IDaySchedule>(
  {
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    periods: [PeriodSchema],
  },
  { _id: false }
)

const TimetableSchema = new Schema<ITimetable>(
  {
    class: {
      type: String,
      required: [true, 'Class is required'],
      enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      uppercase: true,
      enum: ['A', 'B', 'C', 'D'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      match: [/^\d{4}-\d{4}$/, 'Format must be YYYY-YYYY'],
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required'],
    },
    effectiveTo: {
      type: Date,
    },
    schedule: {
      type: [DayScheduleSchema],
      required: true,
      validate: {
        validator: (v: IDaySchedule[]) => v.length > 0 && v.length <= 6,
        message: 'Schedule must have 1-6 days',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: String,
    },
    updatedByName: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for unique class/section/academic year
TimetableSchema.index({ class: 1, section: 1, academicYear: 1 }, { unique: true })

// Index for quick lookups
TimetableSchema.index({ class: 1, section: 1, isActive: 1 })

export const Timetable = mongoose.model<ITimetable>('Timetable', TimetableSchema)
