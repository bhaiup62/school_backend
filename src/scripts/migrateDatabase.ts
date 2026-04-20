// src/scripts/migrateDatabase.ts
// Run: npx ts-node src/scripts/migrateDatabase.ts
// Purpose: Unifies all database migrations to match the new rollover-ready schemas.

import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'

const migrateAll = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI as string)
    console.log('✅ Connected to MongoDB\n')

    const db = mongoose.connection.db!

    // ════════════════════════════════════════════════════════════════
    // 1. MIGRATE STUDENTS
    // ════════════════════════════════════════════════════════════════
    console.log('🔄 Migrating Students...')
    const studentCollection = db.collection('students')
    const studentResult = await studentCollection.updateMany(
      {}, // Match all students
      { 
        $rename: { 
          "class": "currentClass", 
          "section": "currentSection", 
          "session": "currentSession" 
        } 
      }
    )
    console.log(`   ↳ Matched: ${studentResult.matchedCount} | Updated: ${studentResult.modifiedCount}`)

    // ════════════════════════════════════════════════════════════════
    // 2. MIGRATE TEACHERS
    // ════════════════════════════════════════════════════════════════
    console.log('\n🔄 Migrating Teachers...')
    const teacherCollection = db.collection('teachers')
    const teacherResult = await teacherCollection.updateMany(
      {}, // Match all teachers
      { 
        $rename: { 
          "assignedClasses": "currentAssignedClasses", 
          "classTeacherOf": "currentClassTeacherOf" 
        } 
      }
    )
    console.log(`   ↳ Matched: ${teacherResult.matchedCount} | Updated: ${teacherResult.modifiedCount}`)

    console.log('\n✅ All database migrations completed successfully!\n')

  } catch (error: any) {
    console.error('\n❌ Migration error:', error.message)
    console.error(error.stack)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
    process.exit(0)
  }
}

migrateAll()