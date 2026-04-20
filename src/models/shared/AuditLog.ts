import mongoose, { Document, Schema } from 'mongoose'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'APPROVE'
  | 'REJECT'
  | 'MARK_ATTENDANCE'
  | 'ENTER_RESULT'
  | 'ADD_REMARK'
  | 'POST_NOTICE'
  | 'DISCIPLINE_ACTION'
  | 'FEE_RESTRICTION'
  | 'GENERATE_CERTIFICATE'
  | 'REGISTER_STUDENT'
  | 'REGISTER_PARENT'
  | 'LINK_CHILD'

export interface IAuditLog extends Document {
  action: AuditAction
  entityType: string // 'Student', 'Teacher', 'Attendance', 'Result', etc.
  entityId: string // The ID of the affected entity
  performedBy: string // User admission number
  performedByName: string
  performedByRole: string
  description: string
  previousData?: Record<string, unknown>
  newData?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'APPROVE',
        'REJECT',
        'MARK_ATTENDANCE',
        'ENTER_RESULT',
        'ADD_REMARK',
        'POST_NOTICE',
        'DISCIPLINE_ACTION',
        'FEE_RESTRICTION',
        'GENERATE_CERTIFICATE',
        'REGISTER_STUDENT',
        'REGISTER_PARENT',
        'LINK_CHILD',
      ],
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: {
      type: String,
      required: true,
      index: true,
    },
    performedByName: {
      type: String,
      required: true,
    },
    performedByRole: {
      type: String,
      required: true,
      enum: ['student', 'teacher', 'parent', 'receptionist', 'principal', 'admin'],
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    previousData: {
      type: Schema.Types.Mixed,
    },
    newData: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Compound indexes for common queries
AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ performedByRole: 1, createdAt: -1 })
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })

// TTL index to auto-delete logs older than 1 year (optional, can be removed if permanent storage needed)
// AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 })

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)

/**
 * Helper function to create audit log entries
 */
export const logAudit = async (data: {
  action: AuditAction
  entityType: string
  entityId: string
  performedBy: string
  performedByName: string
  performedByRole: string
  description: string
  previousData?: Record<string, unknown>
  newData?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}): Promise<void> => {
  try {
    await AuditLog.create(data)
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to create audit log:', error)
  }
}
