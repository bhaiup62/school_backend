import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IEnquiry extends Document {
  parentName: string
  phone: string
  email?: string
  classInterestedIn: mongoose.Types.ObjectId
  leadSource: 'Website' | 'Facebook' | 'Walk-in' | 'Phone' | 'Other'
  followUpDate?: Date
  status: 'New' | 'Contacted' | 'Converted' | 'Dead'
  createdAt: Date
  updatedAt: Date
}

const EnquirySchema = new Schema<IEnquiry>(
  {
    parentName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    classInterestedIn: { type: Schema.Types.ObjectId, ref: 'ClassMaster', required: true },
    leadSource: {
      type: String,
      enum: ['Website', 'Facebook', 'Walk-in', 'Phone', 'Other'],
      default: 'Other',
    },
    followUpDate: { type: Date },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Converted', 'Dead'],
      default: 'New',
    },
  },
  { timestamps: true }
)

export const Enquiry: Model<IEnquiry> =
  mongoose.models.Enquiry || mongoose.model<IEnquiry>('Enquiry', EnquirySchema)

export default Enquiry
