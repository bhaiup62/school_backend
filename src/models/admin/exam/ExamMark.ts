import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IExamMark extends Document {
  examId: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  classId: mongoose.Types.ObjectId
  subjectId: mongoose.Types.ObjectId
  theoryMarksObtained: number | null
  practicalMarksObtained: number | null
  isAbsent: boolean
  remarks: string
  enteredBy: mongoose.Types.ObjectId
}

const examMarkSchema = new Schema<IExamMark>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'ClassMaster', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'SubjectMaster', required: true },
    theoryMarksObtained: { type: Number, default: null },
    practicalMarksObtained: { type: Number, default: null },
    isAbsent: { type: Boolean, default: false },
    remarks: { type: String, default: '' },
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

examMarkSchema.index({ examId: 1, studentId: 1, subjectId: 1 }, { unique: true })

const ExamMark: Model<IExamMark> =
  mongoose.models.ExamMark || mongoose.model<IExamMark>('ExamMark', examMarkSchema)

export default ExamMark
