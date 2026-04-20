import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISubjectMaster extends Document {
  academicSession: mongoose.Types.ObjectId
  subjectCode: string
  subjectName: string
  type: 'Core' | 'Elective' | 'Optional' | 'Co-Scholastic'
  forClasses: string[]
  maxMarks: number
  passMarks: number
  hasPractical: boolean
  isActive: boolean
}

const subjectMasterSchema = new Schema<ISubjectMaster>(
  {
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    type: {
      type: String,
      enum: ['Core', 'Elective', 'Optional', 'Co-Scholastic'],
      required: true,
    },
    forClasses: [{ type: String }],
    maxMarks: { type: Number, default: 100 },
    passMarks: { type: Number, default: 33 },
    hasPractical: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

subjectMasterSchema.index({ academicSession: 1, subjectCode: 1 }, { unique: true })

const SubjectMaster: Model<ISubjectMaster> =
  mongoose.models.SubjectMaster || mongoose.model<ISubjectMaster>('SubjectMaster', subjectMasterSchema)

export default SubjectMaster
