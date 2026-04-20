// src/models/User.ts

import mongoose, { Schema, Document, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  admissionNumber: string
  password:        string
  role:            'student' | 'teacher' | 'admin' | 'parent' | 'receptionist' | 'principal'
  isActive:        boolean
  lastLogin:       Date
  createdAt:       Date
  updatedAt:       Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    admissionNumber: {
      type:      String,
      required:  [true, 'Admission number is required'],
      unique:    true,
      uppercase: true,
      trim:      true,
      // Students:     SPS-2024-0001
      // Parents:      PAR-2024-0001
      // Teachers:     TCH-2024-0001
      // Receptionist: RCP-2024-0001
      // Principal:    PRI-2024-0001
      // Admin:         ADM-2024-0001
     match: [
  /^(SPS|PAR|TCH|RCP|PRI|ADM)-\d{4}-\d{4}$/,
  'Format must be SPS, PAR, TCH, RCP, PRI, or ADM followed by -YYYY-NNNN',
],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:    false,
    },
    role: {
      type:    String,
      enum:    ['student', 'teacher', 'admin', 'parent', 'receptionist', 'principal'],
      default: 'student',
    },
    isActive:  { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
)

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt   = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// Compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

export default User