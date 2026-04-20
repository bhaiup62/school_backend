// src/models/Teacher.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Academic Year Rollover Ready - tracks current assignments + full history
// ═══════════════════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document, Model } from 'mongoose'

// Assignment history entry for tracking teacher assignments across academic years
export interface IAssignmentHistory {
  academicYear: string           // e.g., "2024-25"
  assignedClasses: string[]      // Classes taught that year
  classTeacherOf: {
    class: string
    section: string
  } | null                       // Class teacher assignment for that year (if any)
}

export interface ITeacher extends Document {
  user:            mongoose.Types.ObjectId   // ref → User
  teacherId:       string                    // e.g. TCH-2024-0001
  firstName:       string
  lastName:        string
  phone:           string
  email:           string
  address:         string
  city:            string
  pincode:         string
  qualification:   string
  experience:      number                    // years
  subjects:        string[]                  // subjects they teach e.g. ['Mathematics', 'Physics']
  // Current academic year assignments (updated on rollover)
  currentAssignedClasses: string[]           // classes they currently teach e.g. ['9', '10', '11']
  isClassTeacher:  boolean
  currentClassTeacherOf: {
    class:   string
    section: string
  } | null
  // Assignment history - preserves all previous years
  assignmentHistory: IAssignmentHistory[]
  joiningDate:     Date
  isActive:        boolean
  createdAt:       Date
  updatedAt:       Date
  // Virtual
  fullName:        string
}

// Sub-schema for class teacher assignment
const ClassTeacherOfSchema = new Schema(
  {
    class:   { type: String, required: true },
    section: { type: String, required: true },
  },
  { _id: false }
)

// Sub-schema for assignment history
const AssignmentHistorySchema = new Schema<IAssignmentHistory>(
  {
    academicYear: {
      type: String,
      required: [true, 'Academic year is required for history entry'],
    },
    assignedClasses: {
      type: [String],
      default: [],
    },
    classTeacherOf: {
      type: ClassTeacherOfSchema,
      default: null,
    },
  },
  { _id: true }
)

const TeacherSchema = new Schema<ITeacher>(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },
    teacherId: {
      type:      String,
      required:  true,
      unique:    true,
      uppercase: true,
      trim:      true,
      match:     [/^TCH-\d{4}-\d{4}$/, 'Format must be TCH-YYYY-NNNN'],
    },
    firstName:       { type: String, required: true, trim: true },
    lastName:        { type: String, required: true, trim: true },
    phone:           { type: String, required: true },
    email:           { type: String, default: '' },
    address:         { type: String, default: '' },
    city:            { type: String, default: 'Varanasi' },
    pincode:         { type: String, default: '' },
    qualification:   { type: String, default: '' },
    experience:      { type: Number, default: 0 },
    subjects:        { type: [String], default: [] },
    // Renamed: assignedClasses → currentAssignedClasses
    currentAssignedClasses: { type: [String], default: [] },
    isClassTeacher:  { type: Boolean, default: false },
    // Renamed: classTeacherOf → currentClassTeacherOf
    currentClassTeacherOf: {
      type: ClassTeacherOfSchema,
      default: null,
    },
    // Assignment history - tracks all previous academic year assignments
    assignmentHistory: [AssignmentHistorySchema],
    joiningDate: { type: Date, default: Date.now },
    isActive:    { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
)

// Indexes
TeacherSchema.index({ 'assignmentHistory.academicYear': 1 })
TeacherSchema.index({ currentAssignedClasses: 1 })
TeacherSchema.index({ 'currentClassTeacherOf.class': 1, 'currentClassTeacherOf.section': 1 })

// Virtuals
TeacherSchema.virtual('fullName').get(function (this: ITeacher) {
  return `${this.firstName} ${this.lastName}`
})

const Teacher: Model<ITeacher> =
  mongoose.models.Teacher || mongoose.model<ITeacher>('Teacher', TeacherSchema)

export default Teacher
export { AssignmentHistorySchema }