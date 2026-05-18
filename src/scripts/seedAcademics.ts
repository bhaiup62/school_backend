import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ClassMaster from '../models/admin/ClassMaster';
import SubjectMaster from '../models/admin/SubjectMaster';
import AcademicSession from '../models/admin/AcademicSession';
import ClassSubjectMapping from '../models/admin/ClassSubjectMapping';
import Teacher from '../models/teacher/Teacher';

// Load environment variables
dotenv.config();

const seedAcademics = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Database connected successfully.');

    // 1. Ensure an Active Academic Session Exists
    let activeSession = await AcademicSession.findOne({ isCurrentSession: true });
    if (!activeSession) {
      console.log('No active session found. Creating "2024-2025" session...');
      activeSession = await AcademicSession.create({
        sessionName: '2024-2025',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2025-03-31'),
        isCurrentSession: true,
        admissionStatus: 'open',
      });
    }

    // 2. Fetch or Create Test Subjects (FIXED: Added academicSession)
    console.log('Fetching or Creating Subjects...');
    let mathSubject = await SubjectMaster.findOne({ subjectName: 'Mathematics', academicSession: activeSession._id });
    if (!mathSubject) {
        mathSubject = await SubjectMaster.create({ 
            subjectName: 'Mathematics', 
            subjectCode: 'MATH101', 
            type: 'Core', 
            isActive: true,
            academicSession: activeSession._id // <-- THE FIX
        });
    }

    let phySubject = await SubjectMaster.findOne({ subjectName: 'Physics', academicSession: activeSession._id });
    if (!phySubject) {
        phySubject = await SubjectMaster.create({ 
            subjectName: 'Physics', 
            subjectCode: 'PHY101', 
            type: 'Core', 
            isActive: true,
            academicSession: activeSession._id // <-- THE FIX
        });
    }

    // 3. Fetch or Create Test Classes
    console.log('Fetching or Creating Classes...');
    let classToMap = await ClassMaster.findOne({ isActive: true, academicSession: activeSession._id });
    if (!classToMap) {
        classToMap = await ClassMaster.create({
            className: 'Class 10',
            sections: [{ sectionName: 'A', capacity: 40 }], 
            academicSession: activeSession._id,
            isActive: true
        });
    }

    // 4. Create a Class-Subject Mapping for Timetable Testing
    console.log('Setting up Class-Subject Mapping for Timetable testing...');
    
    // Find at least one active teacher to assign
    const teacher = await Teacher.findOne({ isActive: true });
    
    if (teacher && classToMap && mathSubject && phySubject) {
      await ClassSubjectMapping.findOneAndUpdate(
        { classId: classToMap._id, academicSession: activeSession._id },
        {
          classId: classToMap._id,
          academicSession: activeSession._id,
          subjects: [
            {
              subjectId: mathSubject._id, // Math
              teachers: [teacher._id]
            },
            {
              subjectId: phySubject._id, // Physics
              teachers: [teacher._id]
            }
          ],
          isActive: true
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Successfully mapped Math & Physics to ${teacher.firstName} for ${classToMap.className}`);
    } else {
      console.log('⚠️ Could not create mapping: No active teachers found in DB. Please create a teacher in your UI first.');
    }

    console.log('\n🎉 Academic Data Seeding Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding academic data:', error);
    process.exit(1);
  }
};

seedAcademics();