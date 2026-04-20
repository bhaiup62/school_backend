// src/models/student/Student.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Student Model - Enterprise Grade
// Supports Academic Rollover, Medical Records, Transport, and Document Checklists
// ═══════════════════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document, Model } from 'mongoose'

// ── Legacy Sub-Schemas (Kept exactly as they were) ────────────────────────
const SubjectResultSchema = new Schema({
  subject:       { type: String, required: true },
  maxMarks:      { type: Number, required: true },
  marksObtained: { type: Number, required: true },
  grade:         { type: String, default: '' },
  remarks:       { type: String, default: '' },
}, { _id: false })

const ExamResultSchema = new Schema({
  examName: { type: String, required: true },
  examType: { type: String, enum: ['unit_test', 'half_yearly', 'annual', 'pre_board'], required: true },
  session:  { type: String, required: true },
  class:    { type: String, required: true },
  section:  { type: String, required: true },
  subjects: [SubjectResultSchema],
  totalMarks: { type: Number, default: 0 },
  totalObtained: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  rank:       { type: Number },
  result:     { type: String, enum: ['pass', 'fail', 'absent'], default: 'pass' },
  declaredOn: { type: Date },
}, { _id: true })

const AttendanceRecordSchema = new Schema({
  date:    { type: Date, required: true },
  status:  { type: String, enum: ['present', 'absent', 'late', 'holiday'], required: true },
  remarks: { type: String, default: '' },
}, { _id: false })

const MonthlyAttendanceSchema = new Schema({
  month:       { type: Number, required: true },
  year:        { type: Number, required: true },
  records:     [AttendanceRecordSchema],
  totalDays:   { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  absentDays:  { type: Number, default: 0 },
  percentage:  { type: Number, default: 0 },
}, { _id: true })

const ClassTeacherRemarkSchema = new Schema({
  remark:    { type: String, required: true },
  addedBy:   { type: String, required: true },
  teacherId: { type: String, required: true },
  session:   { type: String, required: true },
  date:      { type: Date, default: Date.now },
}, { _id: true })

const AcademicHistorySchema = new Schema({
  session:    { type: String, required: true },
  class:      { type: String, required: true },
  section:    { type: String, required: true },
  rollNumber: { type: String, required: true },
  isPassed:   { type: Boolean, default: true },
}, { _id: true })

// ── NEW: Enterprise Sub-Schemas ──────────────────────────────────────────

const PreviousAcademicHistorySchema = new Schema({
  schoolName:    { type: String, default: '' },
  schoolAddress: { type: String, default: '' },
  board:         { type: String, default: '' }, // CBSE, ICSE, State Board
  lastClass:     { type: String, default: '' },
  percentage:    { type: String, default: '' },
  tcNumber:      { type: String, default: '' },
  tcDate:        { type: Date },
}, { _id: false })

const MedicalRecordSchema = new Schema({
  allergies:            { type: String, default: '' },
  chronicIllnesses:     { type: String, default: '' },
  physicalDisabilities: { type: String, default: '' },
  emergencyContactName:     { type: String, default: '' },
  emergencyContactRelation: { type: String, default: '' },
  emergencyContactPhone:    { type: String, default: '' },
  familyDoctorName:         { type: String, default: '' },
  familyDoctorPhone:        { type: String, default: '' },
}, { _id: false })

const TransportSchema = new Schema({
  mode: { 
    type: String, 
    enum: ['self', 'parents', 'private_van', 'school_bus'], 
    default: 'parents' 
  },
  route:          { type: String, default: '' },
  stop:           { type: String, default: '' },
  hostelRequired: { type: Boolean, default: false },
}, { _id: false })

const DocumentChecklistSchema = new Schema({
  birthCertificate:    { type: Boolean, default: false },
  aadharCard:          { type: Boolean, default: false },
  previousMarksheet:   { type: Boolean, default: false },
  transferCertificate: { type: Boolean, default: false },
  casteCertificate:    { type: Boolean, default: false },
  medicalFitness:      { type: Boolean, default: false },
  photographs:         { type: Boolean, default: false },
}, { _id: false })

const SiblingSchema = new Schema({
  name: { type: String, default: '' },
  admissionNumber: { type: String, default: '' },
  schoolName: { type: String, default: 'Same School' },
}, { _id: false })

// Expanded Parent Schema
const ParentSchema = new Schema({
  fatherName:          { type: String, default: '' },
  fatherPhone:         { type: String, default: '' },
  fatherOccupation:    { type: String, default: '' },
  fatherQualification: { type: String, default: '' },
  fatherOfficeAddress: { type: String, default: '' },
  
  motherName:          { type: String, default: '' },
  motherPhone:         { type: String, default: '' },
  motherOccupation:    { type: String, default: '' },
  motherQualification: { type: String, default: '' },
  motherOfficeAddress: { type: String, default: '' },
  
  guardianName:        { type: String, default: '' },
  guardianPhone:       { type: String, default: '' },
  guardianRelation:    { type: String, default: '' },
  
  annualFamilyIncome:  { type: String, default: '' },
  siblings:            [SiblingSchema],

  // Fallbacks for legacy code compatibility
  phone:      { type: String, default: '' },
  email:      { type: String, default: '' },
  address:    { type: String, default: '' },
}, { _id: false })

// ── Interface ────────────────────────────────────────────────────────────

export interface IStudent extends Document {
  user:            mongoose.Types.ObjectId
  admissionNumber: string
  applicationId?:  mongoose.Types.ObjectId
  admissionBatch?: mongoose.Types.ObjectId
  firstName:       string
  lastName:        string
  dateOfBirth:     Date
  gender:          'male' | 'female' | 'other'
  photo:           string
  
  // Advanced Personal
  nationality:         string
  motherTongue:        string
  identificationMarks: string
  bloodGroup:          string
  religion:            string
  caste:               string
  aadharNumber:        string
  
  // Current Academic Placement
  currentClass:    string
  currentSection:  string
  currentSession:  string
  rollNumber:      string
  admissionDate:   Date
  stream:          string
  
  // Contact
  phone:           string
  email:           string
  address:         string
  city:            string
  pincode:         string
  
  // Nested Documents
  parents:                 any
  previousAcademicHistory: any
  medicalRecord:           any
  transport:               any
  documentChecklist:       any
  
  // Arrays
  academicHistory:     mongoose.Types.DocumentArray<any>
  results:             mongoose.Types.DocumentArray<any>
  attendance:          mongoose.Types.DocumentArray<any>
  classTeacherRemarks: mongoose.Types.DocumentArray<any>
  
  isActive:  boolean
  createdAt: Date
  updatedAt: Date
  fullName?: string // virtual
}

// ── Main Schema ──────────────────────────────────────────────────────────

const StudentSchema = new Schema<IStudent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    admissionNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    admissionBatch: { type: Schema.Types.ObjectId, ref: 'AcademicSession' },
    
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    dateOfBirth: { type: Date,   required: true },
    gender:      { type: String, enum: ['male', 'female', 'other'], required: true },
    photo:       { type: String, default: '' },
    
    nationality:         { type: String, default: 'Indian' },
    motherTongue:        { type: String, default: 'Hindi' },
    identificationMarks: { type: String, default: '' },
    bloodGroup:          { type: String, default: '' },
    religion:            { type: String, default: '' },
    caste:               { type: String, default: 'General' },
    aadharNumber:        { type: String, default: '' },
    
    currentClass:   { type: String, required: true },
    currentSection: { type: String, required: true, uppercase: true },
    currentSession: { type: String, required: true },
    rollNumber:     { type: String, required: true },
    admissionDate:  { type: Date,   required: true },
    stream:         { type: String, default: '' },
    
    phone:   { type: String, default: '' },
    email:   { type: String, default: '' },
    address: { type: String, default: '' },
    city:    { type: String, default: 'Varanasi' },
    pincode: { type: String, default: '' },
    
    parents:                 { type: ParentSchema, default: () => ({}) },
    previousAcademicHistory: { type: PreviousAcademicHistorySchema, default: () => ({}) },
    medicalRecord:           { type: MedicalRecordSchema, default: () => ({}) },
    transport:               { type: TransportSchema, default: () => ({}) },
    documentChecklist:       { type: DocumentChecklistSchema, default: () => ({}) },
    
    academicHistory:     [AcademicHistorySchema],
    results:             [ExamResultSchema],
    attendance:          [MonthlyAttendanceSchema],
    classTeacherRemarks: [ClassTeacherRemarkSchema],
    
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
)

// ── Indexes ──────────────────────────────────────────────

StudentSchema.index({ currentClass: 1, currentSection: 1, currentSession: 1 })
StudentSchema.index({ 'academicHistory.session': 1 })
StudentSchema.index({ 'results.session': 1, 'results.class': 1 })

// ── Virtuals ─────────────────────────────────────────────

StudentSchema.virtual('fullName').get(function (this: IStudent) {
  return `${this.firstName} ${this.lastName}`
})

StudentSchema.virtual('overallAttendance').get(function (this: IStudent) {
  const att = this.attendance
  if (!att || att.length === 0) return 0
  const total   = att.reduce((sum: number, m: any) => sum + (m.totalDays   || 0), 0)
  const present = att.reduce((sum: number, m: any) => sum + (m.presentDays || 0), 0)
  return total > 0 ? Math.round((present / total) * 100) : 0
})

// ── Export ───────────────────────────────────────────────

const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema)

export default Student
export { 
  ExamResultSchema, 
  MonthlyAttendanceSchema, 
  AttendanceRecordSchema, 
  ClassTeacherRemarkSchema,
  AcademicHistorySchema 
}