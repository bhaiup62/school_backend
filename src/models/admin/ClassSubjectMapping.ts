import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IClassSubjectMapping extends Document {
  academicSession: mongoose.Types.ObjectId
  classId: mongoose.Types.ObjectId
  subjectId: mongoose.Types.ObjectId
  isMandatory: boolean
  periodsPerWeek: number
  teachers?: mongoose.Types.ObjectId[]
  isDeleted: boolean
  deletedAt: Date | null
}

const classSubjectMappingSchema = new Schema<IClassSubjectMapping>(
  {
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'ClassMaster', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'SubjectMaster', required: true },
    isMandatory: { type: Boolean, default: true },
    periodsPerWeek: { type: Number, required: true, min: 1, max: 60 },
    teachers: [{ type: Schema.Types.ObjectId, ref: 'Teacher' }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

classSubjectMappingSchema.index({ classId: 1, subjectId: 1 }, { unique: true })

const ClassSubjectMapping: Model<IClassSubjectMapping> =
  mongoose.models.ClassSubjectMapping || mongoose.model<IClassSubjectMapping>('ClassSubjectMapping', classSubjectMappingSchema)

export default ClassSubjectMapping
