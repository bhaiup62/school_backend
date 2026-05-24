import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IExamSchedule extends Document {
  examId: mongoose.Types.ObjectId
  classId: mongoose.Types.ObjectId
  subjectId: mongoose.Types.ObjectId
  examDate: Date
  startTime: string
  endTime: string
  maxMarks: number
  passMarks: number
}

const examScheduleSchema = new Schema<IExamSchedule>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'ClassMaster', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'SubjectMaster', required: true },
    examDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    maxMarks: { type: Number, required: true, min: 1 },
    passMarks: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
)

examScheduleSchema.index({ examId: 1, classId: 1, subjectId: 1 }, { unique: true })

const ExamSchedule: Model<IExamSchedule> =
  mongoose.models.ExamSchedule || mongoose.model<IExamSchedule>('ExamSchedule', examScheduleSchema)

export default ExamSchedule
