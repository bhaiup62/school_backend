// src/models/Parent.ts

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IParent extends Document {
  user:          mongoose.Types.ObjectId   // ref → User
  parentId:      string                    // e.g. PAR-2024-0001
  firstName:     string
  lastName:      string
  phone:         string
  email:         string
  address:       string
  city:          string
  pincode:       string
  occupation:    string
  relation:      'father' | 'mother' | 'guardian'
  // Array of student admission numbers this parent can access
  children:      string[]
  isActive:      boolean
  createdAt:     Date
  updatedAt:     Date
}

const ParentSchema = new Schema<IParent>(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },
    parentId: {
      type:      String,
      required:  true,
      unique:    true,
      uppercase: true,
      trim:      true,
      // Format: PAR-2024-0001
      match: [/^PAR-\d{4}-\d{4}$/, 'Format must be PAR-YYYY-NNNN'],
    },
    firstName:  { type: String, required: true, trim: true },
    lastName:   { type: String, required: true, trim: true },
    phone:      { type: String, required: true },
    email:      { type: String, default: '' },
    address:    { type: String, default: '' },
    city:       { type: String, default: 'Varanasi' },
    pincode:    { type: String, default: '' },
    occupation: { type: String, default: '' },
    relation: {
      type: String,
      enum: ['father', 'mother', 'guardian'],
      required: true,
    },
    // List of student admissionNumbers this parent can see
    // e.g. ['SPS-2024-0001', 'SPS-2024-0002']
    children: {
      type:    [String],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual: full name
ParentSchema.virtual('fullName').get(function (this: IParent) {
  return `${this.firstName} ${this.lastName}`
})

const Parent: Model<IParent> =
  mongoose.models.Parent || mongoose.model<IParent>('Parent', ParentSchema)

export default Parent