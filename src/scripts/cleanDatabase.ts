// src/scripts/cleanDatabase.ts
// Run: npx ts-node src/scripts/cleanDatabase.ts
// Deletes ALL data from the database

import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import User from '../models/shared/User'
import Student from '../models/student/Student'
import Teacher from '../models/teacher/Teacher'
import Parent from '../models/parent/Parent'
import Principal from '../models/principal/Principal'
import Receptionist from '../models/receptionist/Receptionist'
import Notice from '../models/principal/Notice'
import { Counter } from '../models/shared/Counter'
import Event from '../models/principal/Event'
import Complaint from '../models/parent/Complaint'
import { LeaveRequest } from '../models/teacher/LeaveRequest'
import FeeRecord from '../models/student/FeeRecord'
import DisciplinaryRecord from '../models/principal/DisciplinaryRecord'
import { Timetable } from '../models/principal/Timetable'
import SyllabusProgress from '../models/principal/SyllabusProgress'
import { AuditLog } from '../models/shared/AuditLog'

const cleanDatabase = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI as string)
    console.log('✅ Connected to MongoDB\n')

    console.log('═'.repeat(60))
    console.log('🗑️  CLEANING DATABASE')
    console.log('═'.repeat(60))
    console.log('')

    // Delete in proper order (dependencies first)
    console.log('Deleting data from all collections...\n')

    // Delete profile collections first
    const studentCount = await Student.countDocuments()
    await Student.deleteMany({})
    console.log(`  ✓ Students:           ${studentCount} deleted`)

    const parentCount = await Parent.countDocuments()
    await Parent.deleteMany({})
    console.log(`  ✓ Parents:            ${parentCount} deleted`)

    const teacherCount = await Teacher.countDocuments()
    await Teacher.deleteMany({})
    console.log(`  ✓ Teachers:           ${teacherCount} deleted`)

    const principalCount = await Principal.countDocuments()
    await Principal.deleteMany({})
    console.log(`  ✓ Principals:         ${principalCount} deleted`)

    const receptionistCount = await Receptionist.countDocuments()
    await Receptionist.deleteMany({})
    console.log(`  ✓ Receptionists:      ${receptionistCount} deleted`)

    // Delete related data
    const noticeCount = await Notice.countDocuments()
    await Notice.deleteMany({})
    console.log(`  ✓ Notices:            ${noticeCount} deleted`)

    const eventCount = await Event.countDocuments()
    await Event.deleteMany({})
    console.log(`  ✓ Events:             ${eventCount} deleted`)

    const complaintCount = await Complaint.countDocuments()
    await Complaint.deleteMany({})
    console.log(`  ✓ Complaints:         ${complaintCount} deleted`)

    const leaveCount = await LeaveRequest.countDocuments()
    await LeaveRequest.deleteMany({})
    console.log(`  ✓ Leave Requests:     ${leaveCount} deleted`)

    const feeCount = await FeeRecord.countDocuments()
    await FeeRecord.deleteMany({})
    console.log(`  ✓ Fee Records:        ${feeCount} deleted`)

    const disciplineCount = await DisciplinaryRecord.countDocuments()
    await DisciplinaryRecord.deleteMany({})
    console.log(`  ✓ Disciplinary:       ${disciplineCount} deleted`)

    const timetableCount = await Timetable.countDocuments()
    await Timetable.deleteMany({})
    console.log(`  ✓ Timetables:         ${timetableCount} deleted`)

    const syllabusCount = await SyllabusProgress.countDocuments()
    await SyllabusProgress.deleteMany({})
    console.log(`  ✓ Syllabus Progress:  ${syllabusCount} deleted`)

    const auditCount = await AuditLog.countDocuments()
    await AuditLog.deleteMany({})
    console.log(`  ✓ Audit Logs:         ${auditCount} deleted`)

    // Delete users last
    const userCount = await User.countDocuments()
    await User.deleteMany({})
    console.log(`  ✓ Users:              ${userCount} deleted`)

    // Reset counters
    const counterCount = await Counter.countDocuments()
    await Counter.deleteMany({})
    console.log(`  ✓ Counters:           ${counterCount} deleted (reset)`)

    console.log('')
    console.log('═'.repeat(60))
    console.log('✅ DATABASE CLEANED SUCCESSFULLY')
    console.log('═'.repeat(60))
    console.log('')
    console.log('  All collections have been emptied.')
    console.log('  Counters have been reset.')
    console.log('  Database is ready for fresh seed.')
    console.log('')

    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error cleaning database:', error.message)
    process.exit(1)
  }
}

// Confirmation prompt
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('')
console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!')
console.log('')

rl.question('Type "DELETE ALL" to confirm: ', (answer: string) => {
  rl.close()
  if (answer === 'DELETE ALL') {
    cleanDatabase()
  } else {
    console.log('❌ Cancelled. No data was deleted.')
    process.exit(0)
  }
})
