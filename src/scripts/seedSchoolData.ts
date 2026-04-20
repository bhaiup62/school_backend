// src/scripts/seedSchoolData.ts
// Run: npx ts-node src/scripts/seedSchoolData.ts
// Creates a complete school dataset with ~1200 students, 30 teachers, 1 principal, 3 receptionists, and realistic notices

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
import { Counter } from '../models/shared/Counter' // Added Counter to initialize sequences

// ═══════════════════════════════════════════════════════════════════════════════
// DATA POOLS
// ═══════════════════════════════════════════════════════════════════════════════

const FIRST_NAMES_MALE = [
  'Aarav', 'Vihaan', 'Aditya', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna',
  'Ishaan', 'Shaurya', 'Atharva', 'Advait', 'Vivaan', 'Dhruv', 'Kabir', 'Ansh',
  'Ritvik', 'Arnav', 'Yash', 'Rohan', 'Karan', 'Pranav', 'Om', 'Lakshay',
  'Sahil', 'Mohit', 'Harsh', 'Manav', 'Dev', 'Raj', 'Vikram', 'Amit',
  'Rahul', 'Aakash', 'Nikhil', 'Varun', 'Kunal', 'Siddharth', 'Akshay', 'Gaurav',
  'Piyush', 'Tushar', 'Neeraj', 'Himanshu', 'Vishal', 'Sachin', 'Tarun', 'Sumit'
]

const FIRST_NAMES_FEMALE = [
  'Aadhya', 'Diya', 'Pihu', 'Ananya', 'Saanvi', 'Aanya', 'Aarohi', 'Myra',
  'Sara', 'Navya', 'Kiara', 'Avni', 'Anika', 'Pari', 'Tara', 'Riya',
  'Priya', 'Neha', 'Shreya', 'Pooja', 'Anjali', 'Kavya', 'Tanvi', 'Ishita',
  'Meera', 'Nisha', 'Sneha', 'Divya', 'Kritika', 'Mansi', 'Simran', 'Jiya',
  'Komal', 'Swati', 'Ankita', 'Deepika', 'Sonali', 'Pallavi', 'Megha', 'Shikha',
  'Garima', 'Ritika', 'Bhavna', 'Archana', 'Sweta', 'Rashmi', 'Vandana', 'Namrata'
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Yadav', 'Mishra',
  'Pandey', 'Tiwari', 'Dubey', 'Srivastava', 'Jha', 'Shukla', 'Tripathi', 'Chauhan',
  'Rawat', 'Nair', 'Reddy', 'Rao', 'Iyer', 'Menon', 'Pillai', 'Bhat',
  'Joshi', 'Kulkarni', 'Deshmukh', 'Patil', 'Mehta', 'Shah', 'Agarwal', 'Bansal',
  'Saxena', 'Khanna', 'Malhotra', 'Kapoor', 'Bhatia', 'Arora', 'Goel', 'Rastogi'
]

const FATHER_NAMES = [
  'Rajesh', 'Suresh', 'Ramesh', 'Mahesh', 'Naresh', 'Dinesh', 'Ganesh', 'Mukesh',
  'Rakesh', 'Prakash', 'Vikash', 'Ashok', 'Manoj', 'Anil', 'Sunil', 'Vijay',
  'Sanjay', 'Ajay', 'Ravi', 'Deepak', 'Alok', 'Vinod', 'Pramod', 'Santosh',
  'Umesh', 'Lokesh', 'Kamlesh', 'Yogesh', 'Satish', 'Harish', 'Girish', 'Manish'
]

const MOTHER_NAMES = [
  'Sunita', 'Anita', 'Geeta', 'Seema', 'Neeta', 'Meena', 'Reena', 'Sheela',
  'Kamla', 'Sarla', 'Kusum', 'Pushpa', 'Rekha', 'Sudha', 'Kavita', 'Savita',
  'Mamta', 'Poonam', 'Sarita', 'Usha', 'Shanti', 'Lata', 'Asha', 'Nirmala',
  'Kiran', 'Suman', 'Manju', 'Indu', 'Madhu', 'Renu', 'Archana', 'Vandana'
]

const OCCUPATIONS = [
  'Business', 'Government Service', 'Private Job', 'Doctor', 'Engineer',
  'Teacher', 'Lawyer', 'Farmer', 'Shopkeeper', 'Contractor', 'Banker', 'Accountant',
  'Professor', 'IAS Officer', 'Police Officer', 'Architect', 'Manager', 'Consultant'
]

const TEACHER_SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi',
  'Social Science', 'History', 'Geography', 'Economics', 'Computer Science',
  'Physical Education', 'Art', 'Music', 'Sanskrit'
]

const TEACHER_QUALIFICATIONS = [
  'M.Sc., B.Ed.', 'M.A., B.Ed.', 'Ph.D.', 'M.Tech., B.Ed.', 'M.Com., B.Ed.',
  'M.Phil., B.Ed.', 'M.Sc., M.Ed.', 'M.A., M.Ed.'
]

const RECEPTIONIST_QUALIFICATIONS = [
  'B.A.', 'B.Com.', 'B.Sc.', 'BBA', 'Diploma in Office Management'
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist']
const CASTES = ['General', 'OBC', 'SC', 'ST']
const SECTIONS = ['A', 'B', 'C', 'D', 'E']
const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const STREAMS_11_12 = ['Science', 'Commerce', 'Arts']

const LOCALITIES = [
  'Shivpur', 'Lanka', 'Assi', 'Godowlia', 'Sigra', 'Bhelupur', 'Dashashwamedh',
  'Ramnagar', 'Sarnath', 'Cantt', 'Mahmoorganj', 'Nadesar', 'Pahadia', 'Maldahiya'
]

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const randomPhone = () => `98${Math.floor(10000000 + Math.random() * 90000000)}`
const randomAadhar = () => Array(12).fill(0).map(() => Math.floor(Math.random() * 10)).join('')
const randomPincode = () => `22100${Math.floor(Math.random() * 10)}`

const randomDOB = (classNum: number): Date => {
  const age = parseInt(classNum.toString()) + 5
  const year = new Date().getFullYear() - age
  const month = Math.floor(Math.random() * 12)
  const day = Math.floor(Math.random() * 28) + 1
  return new Date(year, month, day)
}

const randomPastDate = (daysAgo: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  return date
}

const formatID = (prefix: string, year: number, num: number): string => {
  return `${prefix}-${year}-${String(num).padStart(4, '0')}`
}

const generateAttendance = (months: number = 6) => {
  const attendance = []
  const now = new Date()

  for (let i = 0; i < months; i++) {
    const month = ((now.getMonth() - i + 12) % 12) + 1
    const year = now.getMonth() - i < 0 ? now.getFullYear() - 1 : now.getFullYear()

    const daysInMonth = new Date(year, month, 0).getDate()
    const workingDays = Math.floor(daysInMonth * 0.85)

    const records = []
    let presentDays = 0
    let absentDays = 0

    for (let d = 1; d <= workingDays; d++) {
      const rand = Math.random()
      let status: string
      if (rand < 0.88) {
        status = 'present'
        presentDays++
      } else if (rand < 0.96) {
        status = 'absent'
        absentDays++
      } else {
        status = 'late'
        presentDays++
      }

      records.push({
        date: new Date(year, month - 1, d),
        status,
        remarks: status === 'absent' ? pick(['Sick', 'Family emergency', 'Medical appointment', '']) : ''
      })
    }

    attendance.push({
      month,
      year,
      records,
      totalDays: workingDays,
      presentDays,
      absentDays,
      percentage: Math.round((presentDays / workingDays) * 100)
    })
  }

  return attendance
}

const generateResults = (classNum: string) => {
  const subjects = parseInt(classNum) >= 11
    ? ['Physics', 'Chemistry', 'Mathematics', 'English', 'Computer Science']
    : parseInt(classNum) >= 6
      ? ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science']
      : ['Hindi', 'English', 'Mathematics', 'Environmental Science', 'General Knowledge']

  const gradeForMarks = (marks: number, max: number) => {
    const pct = (marks / max) * 100
    if (pct >= 90) return 'A+'
    if (pct >= 80) return 'A'
    if (pct >= 70) return 'B+'
    if (pct >= 60) return 'B'
    if (pct >= 50) return 'C'
    if (pct >= 33) return 'D'
    return 'F'
  }

  const exams = [
    { name: 'Unit Test 1', type: 'unit_test', maxMarks: 50 },
    { name: 'Half Yearly', type: 'half_yearly', maxMarks: 100 },
  ]

  return exams.map((exam) => {
    const subjectResults = subjects.map(subject => {
      const baseScore = 0.4 + Math.random() * 0.55 // 40% to 95%
      const marks = Math.round(exam.maxMarks * baseScore)
      return {
        subject,
        maxMarks: exam.maxMarks,
        marksObtained: marks,
        grade: gradeForMarks(marks, exam.maxMarks),
        remarks: marks >= exam.maxMarks * 0.8 ? 'Excellent' : marks >= exam.maxMarks * 0.6 ? 'Good' : ''
      }
    })

    const totalMarks = subjectResults.length * exam.maxMarks
    const totalObtained = subjectResults.reduce((sum, s) => sum + s.marksObtained, 0)
    const percentage = Math.round((totalObtained / totalMarks) * 100)

    return {
      examName: exam.name,
      examType: exam.type,
      session: '2025-26',
      class: classNum,
      section: 'A', // Defaulting for past record history
      subjects: subjectResults,
      totalMarks,
      totalObtained,
      percentage,
      rank: Math.floor(Math.random() * 40) + 1,
      result: percentage >= 33 ? 'pass' : 'fail',
      declaredOn: randomPastDate(30)
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICE CONTENT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const NOTICE_TEMPLATES = {
  principal: {
    all_classes: [
      {
        title: 'Annual Day Celebration 2026',
        content: 'Dear Students and Parents,\n\nWe are pleased to announce that the Annual Day Celebration will be held on March 15, 2026. All students are required to participate. Practice sessions will begin from March 1st.\n\nRegards,\nPrincipal',
        tag: 'event',
        priority: 'high'
      },
      {
        title: 'Summer Vacation Notice',
        content: 'School will remain closed for summer vacation from May 15, 2026 to June 30, 2026. Students are advised to complete their holiday homework during this period.',
        tag: 'holiday',
        priority: 'normal'
      },
      {
        title: 'New Academic Session 2026-27',
        content: 'The new academic session will commence from July 1, 2026. All students must report in complete uniform with required books and stationery.',
        tag: 'academic',
        priority: 'high'
      }
    ],
    specific_class: [
      {
        title: 'Board Exam Preparation - Class 10',
        content: 'Special classes for board exam preparation will start from January 15, 2026. Extra practice sessions will be held on Saturdays.',
        tag: 'exam',
        priority: 'urgent',
        targetClass: '10'
      },
      {
        title: 'Field Trip - Class 6',
        content: 'A field trip to the Science Museum is planned for March 8, 2026. Permission slips must be submitted by March 5, 2026.',
        tag: 'event',
        priority: 'normal',
        targetClass: '6'
      }
    ]
  },
  teacher: {
    own_class: [
      {
        title: 'Unit Test Schedule',
        content: 'Unit Test for Mathematics will be held on Monday. Chapters 1-5 will be covered. Students are advised to prepare well.',
        tag: 'exam',
        priority: 'normal'
      },
      {
        title: 'Project Work Deadline',
        content: 'Science project submissions are due on March 15, 2026. Groups have been assigned. Please coordinate with team members.',
        tag: 'academic',
        priority: 'normal'
      }
    ],
    all_classes: [
      {
        title: 'Inter-School Quiz Competition',
        content: 'Students interested in participating in the Inter-School Quiz Competition should register with their class teachers by March 5, 2026.',
        tag: 'event',
        priority: 'normal'
      }
    ]
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

const seed = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI as string)
    console.log('✅ Connected to MongoDB\n')

    // ═══════════════════════════════════════════════════════════════════════════
    // CLEAN DATABASE FIRST
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('🗑️  Cleaning existing data...\n')
    
    const collections = await mongoose.connection.db!.listCollections().toArray()
    
    for (const collection of collections) {
      await mongoose.connection.db!.dropCollection(collection.name)
      console.log(`   ✓ Dropped: ${collection.name}`)
    }
    
    console.log('\n   ✓ Database cleaned\n')

    console.log('═'.repeat(70))
    console.log('🏫 SARASWATI PUBLIC SCHOOL - COMPREHENSIVE DATA SEEDING')
    console.log('═'.repeat(70))
    console.log('')

    const YEAR = 2026
    let stats = {
      principal: 0,
      teachers: 0,
      students: 0,
      parents: 0,
      receptionists: 0,
      notices: { total: 0, approved: 0, pending: 0, rejected: 0, deleted: 0 }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. CREATE PRINCIPAL
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('👔 Creating Principal...\n')

    const principalUser = await User.create({
      admissionNumber: formatID('PRI', YEAR, 1),
      password: 'principal123',
      role: 'principal',
      isActive: true
    })

    const principal = await Principal.create({
      user: principalUser._id,
      principalId: formatID('PRI', YEAR, 1),
      firstName: 'Ramesh',
      lastName: 'Chandra',
      phone: '9876543210',
      email: 'principal@saraswati.edu.in',
      address: '15, Civil Lines',
      city: 'Varanasi',
      pincode: '221001',
      qualification: 'Ph.D. in Education, M.A., B.Ed.',
      experience: 25,
      specialization: 'Educational Administration',
      joiningDate: new Date('2015-04-01'),
      isActive: true
    })

    stats.principal = 1
    console.log(`   ✓ Principal: ${principal.fullName} (${principal.principalId})\n`)

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. CREATE TEACHERS (30)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('👨‍🏫 Creating 30 Teachers...\n')

    interface TeacherData {
      teacherId: string
      firstName: string
      lastName: string
      gender: 'male' | 'female'
      subjects: string[]
      currentAssignedClasses: string[]
      isClassTeacher: boolean
      currentClassTeacherOf: { class: string; section: string } | null
    }

    const teachersList: TeacherData[] = []

    const teacherConfigs: Array<{
      firstName: string
      lastName: string
      gender: 'male' | 'female'
      subjects: string[]
      classes: string[]
      classTeacher: { class: string; section: string } | null
    }> = [
      { firstName: 'Amit', lastName: 'Kumar', gender: 'male', subjects: ['Computer Science'], classes: ['9', '10', '11', '12'], classTeacher: { class: '10', section: 'A' } },
      { firstName: 'Priya', lastName: 'Srivastava', gender: 'female', subjects: ['Art'], classes: ['1', '2', '3', '4', '5'], classTeacher: { class: '1', section: 'A' } },
      { firstName: 'Raj', lastName: 'Joshi', gender: 'male', subjects: ['Physical Education'], classes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], classTeacher: null },
      { firstName: 'Ananya', lastName: 'Verma', gender: 'female', subjects: ['English'], classes: ['6', '7', '8'], classTeacher: { class: '6', section: 'A' } },
      { firstName: 'Harsh', lastName: 'Pandey', gender: 'male', subjects: ['Hindi'], classes: ['9', '10'], classTeacher: { class: '9', section: 'A' } },
      { firstName: 'Shanti', lastName: 'Devi', gender: 'female', subjects: ['Mathematics'], classes: ['1', '2', '3', '4', '5'], classTeacher: { class: '2', section: 'A' } },
      { firstName: 'Vikram', lastName: 'Singh', gender: 'male', subjects: ['Physics'], classes: ['11', '12'], classTeacher: { class: '11', section: 'A' } },
      { firstName: 'Geeta', lastName: 'Sharma', gender: 'female', subjects: ['Chemistry'], classes: ['11', '12'], classTeacher: { class: '12', section: 'A' } },
      { firstName: 'Suresh', lastName: 'Gupta', gender: 'male', subjects: ['Biology'], classes: ['9', '10', '11', '12'], classTeacher: { class: '11', section: 'B' } },
      { firstName: 'Meera', lastName: 'Tripathi', gender: 'female', subjects: ['History', 'Social Science'], classes: ['6', '7', '8', '9', '10'], classTeacher: { class: '7', section: 'A' } },
      { firstName: 'Anil', lastName: 'Mishra', gender: 'male', subjects: ['Geography', 'Social Science'], classes: ['6', '7', '8', '9', '10'], classTeacher: { class: '8', section: 'A' } },
      { firstName: 'Kavita', lastName: 'Yadav', gender: 'female', subjects: ['Sanskrit'], classes: ['6', '7', '8'], classTeacher: { class: '6', section: 'B' } },
      { firstName: 'Ramesh', lastName: 'Tiwari', gender: 'male', subjects: ['Mathematics'], classes: ['6', '7', '8'], classTeacher: { class: '7', section: 'B' } },
      { firstName: 'Sunita', lastName: 'Dubey', gender: 'female', subjects: ['Science'], classes: ['6', '7', '8'], classTeacher: { class: '8', section: 'B' } },
      { firstName: 'Deepak', lastName: 'Shukla', gender: 'male', subjects: ['English'], classes: ['9', '10'], classTeacher: { class: '9', section: 'B' } },
      { firstName: 'Nisha', lastName: 'Chauhan', gender: 'female', subjects: ['Hindi'], classes: ['6', '7', '8'], classTeacher: { class: '6', section: 'C' } },
      { firstName: 'Alok', lastName: 'Rawat', gender: 'male', subjects: ['Mathematics'], classes: ['9', '10'], classTeacher: { class: '10', section: 'B' } },
      { firstName: 'Pooja', lastName: 'Mehta', gender: 'female', subjects: ['Economics'], classes: ['11', '12'], classTeacher: { class: '12', section: 'B' } },
      { firstName: 'Manoj', lastName: 'Kapoor', gender: 'male', subjects: ['Physics', 'Mathematics'], classes: ['11', '12'], classTeacher: { class: '11', section: 'C' } },
      { firstName: 'Rekha', lastName: 'Arora', gender: 'female', subjects: ['Chemistry'], classes: ['9', '10'], classTeacher: { class: '10', section: 'C' } },
      { firstName: 'Sanjay', lastName: 'Bhatia', gender: 'male', subjects: ['Computer Science'], classes: ['6', '7', '8'], classTeacher: { class: '7', section: 'C' } },
      { firstName: 'Usha', lastName: 'Goel', gender: 'female', subjects: ['English'], classes: ['1', '2', '3', '4', '5'], classTeacher: { class: '3', section: 'A' } },
      { firstName: 'Rakesh', lastName: 'Agarwal', gender: 'male', subjects: ['Hindi'], classes: ['1', '2', '3', '4', '5'], classTeacher: { class: '4', section: 'A' } },
      { firstName: 'Mamta', lastName: 'Bansal', gender: 'female', subjects: ['Environmental Science'], classes: ['1', '2', '3', '4', '5'], classTeacher: { class: '5', section: 'A' } },
      { firstName: 'Vijay', lastName: 'Saxena', gender: 'male', subjects: ['Music'], classes: ['1', '2', '3', '4', '5', '6', '7', '8'], classTeacher: null },
      { firstName: 'Asha', lastName: 'Khanna', gender: 'female', subjects: ['Mathematics'], classes: ['11', '12'], classTeacher: { class: '12', section: 'C' } },
      { firstName: 'Prakash', lastName: 'Malhotra', gender: 'male', subjects: ['Biology'], classes: ['6', '7', '8'], classTeacher: { class: '8', section: 'C' } },
      { firstName: 'Kiran', lastName: 'Shah', gender: 'female', subjects: ['Social Science'], classes: ['1', '2', '3', '4', '5'], classTeacher: { class: '1', section: 'B' } },
      { firstName: 'Satish', lastName: 'Patel', gender: 'male', subjects: ['Science'], classes: ['1', '2', '3', '4', '5'], classTeacher: { class: '2', section: 'B' } },
      { firstName: 'Lata', lastName: 'Kulkarni', gender: 'female', subjects: ['English', 'Hindi'], classes: ['11', '12'], classTeacher: { class: '11', section: 'D' } }
    ]

    for (let i = 0; i < teacherConfigs.length; i++) {
      const config = teacherConfigs[i]
      const teacherId = formatID('TCH', YEAR, i + 1)

      const user = await User.create({
        admissionNumber: teacherId,
        password: 'teacher123',
        role: 'teacher',
        isActive: true
      })

      const teacher = await Teacher.create({
        user: user._id,
        teacherId,
        firstName: config.firstName,
        lastName: config.lastName,
        phone: randomPhone(),
        email: `${config.firstName.toLowerCase()}.${config.lastName.toLowerCase()}@saraswati.edu.in`,
        address: `${Math.floor(Math.random() * 200) + 1}, ${pick(LOCALITIES)}`,
        city: 'Varanasi',
        pincode: randomPincode(),
        qualification: pick(TEACHER_QUALIFICATIONS),
        experience: Math.floor(Math.random() * 15) + 3,
        subjects: config.subjects,
        currentAssignedClasses: config.classes,                 // UPDATED SCHEMA FIELD
        isClassTeacher: config.classTeacher !== null,
        currentClassTeacherOf: config.classTeacher,             // UPDATED SCHEMA FIELD
        joiningDate: randomPastDate(3650),
        isActive: true
      })

      teachersList.push({
        teacherId: teacher.teacherId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        gender: config.gender,
        subjects: config.subjects,
        currentAssignedClasses: config.classes,
        isClassTeacher: config.classTeacher !== null,
        currentClassTeacherOf: config.classTeacher
      })
    }

    stats.teachers = teachersList.length
    console.log(`   ✓ Created ${stats.teachers} teachers\n`)

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. CREATE RECEPTIONISTS (3)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('💼 Creating 3 Receptionists...\n')

    const receptionistConfigs = [
      { firstName: 'Sunita', lastName: 'Sharma', gender: 'female', shift: 'morning' },
      { firstName: 'Ravi', lastName: 'Kumar', gender: 'male', shift: 'afternoon' },
      { firstName: 'Neha', lastName: 'Gupta', gender: 'female', shift: 'full_day' }
    ]

    for (let i = 0; i < receptionistConfigs.length; i++) {
      const config = receptionistConfigs[i]
      const receptionistId = formatID('RCP', YEAR, i + 1)

      const user = await User.create({
        admissionNumber: receptionistId,
        password: 'receptionist123',
        role: 'receptionist',
        isActive: true
      })

      await Receptionist.create({
        user: user._id,
        receptionistId,
        firstName: config.firstName,
        lastName: config.lastName,
        phone: randomPhone(),
        email: `${config.firstName.toLowerCase()}.${config.lastName.toLowerCase()}@saraswati.edu.in`,
        address: `${Math.floor(Math.random() * 200) + 1}, ${pick(LOCALITIES)}`,
        city: 'Varanasi',
        pincode: randomPincode(),
        qualification: pick(RECEPTIONIST_QUALIFICATIONS),
        joiningDate: randomPastDate(1825),
        shift: config.shift as 'morning' | 'afternoon' | 'full_day',
        isActive: true
      })
    }

    stats.receptionists = 3
    console.log(`   ✓ Created ${stats.receptionists} receptionists\n`)

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. CREATE STUDENTS (~1200)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('👨‍🎓 Creating ~1200 Students...\n')

    const studentsPerSection = 20

    interface StudentRecord {
      admissionNumber: string
      firstName: string
      lastName: string
      gender: 'male' | 'female'
      class: string
      section: string
      fatherName: string
      motherName: string
      phone: string
    }

    const allStudents: StudentRecord[] = []
    let studentCounter = 1

    for (const cls of CLASSES) {
      for (const section of SECTIONS) {
        for (let i = 0; i < studentsPerSection; i++) {
          const gender = Math.random() > 0.5 ? 'male' : 'female'
          const firstName = gender === 'male' ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE)
          const lastName = pick(LAST_NAMES)
          const fatherFirstName = pick(FATHER_NAMES)
          const motherFirstName = pick(MOTHER_NAMES)

          const admissionNumber = formatID('SPS', YEAR, studentCounter)

          const user = await User.create({
            admissionNumber,
            password: 'student123',
            role: 'student',
            isActive: true
          })

          const stream = (cls === '11' || cls === '12') ? pick(STREAMS_11_12) : ''

          await Student.create({
            user: user._id,
            admissionNumber,
            firstName,
            lastName,
            dateOfBirth: randomDOB(parseInt(cls)),
            gender,
            bloodGroup: pick(BLOOD_GROUPS),
            religion: pick(RELIGIONS),
            caste: pick(CASTES),
            aadharNumber: randomAadhar(),
            currentClass: cls,             // UPDATED SCHEMA FIELD
            currentSection: section,       // UPDATED SCHEMA FIELD
            currentSession: '2025-26',     // UPDATED SCHEMA FIELD
            rollNumber: String(i + 1),
            admissionDate: new Date('2025-04-01'),
            stream,
            phone: randomPhone(),
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${studentCounter}@student.saraswati.edu.in`,
            address: `${Math.floor(Math.random() * 500) + 1}, ${pick(LOCALITIES)}`,
            city: 'Varanasi',
            pincode: randomPincode(),
            parents: {
              fatherName: `${fatherFirstName} ${lastName}`,
              motherName: `${motherFirstName} ${lastName}`,
              phone: randomPhone(),
              email: `${fatherFirstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
              occupation: pick(OCCUPATIONS),
              address: ''
            },
            results: generateResults(cls),
            attendance: generateAttendance(6),
            isActive: true
          })

          allStudents.push({
            admissionNumber,
            firstName,
            lastName,
            gender,
            class: cls,
            section,
            fatherName: `${fatherFirstName} ${lastName}`,
            motherName: `${motherFirstName} ${lastName}`,
            phone: randomPhone()
          })

          studentCounter++
        }
      }
      process.stdout.write(`   ✓ Class ${cls} completed (${studentCounter - 1} students so far)\r`)
    }

    stats.students = allStudents.length
    console.log(`\n   ✓ Created ${stats.students} students\n`)

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. CREATE PARENTS
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('👨‍👩‍👧‍👦 Creating Parents...\n')

    const familyGroups: Map<string, StudentRecord[]> = new Map()

    for (const student of allStudents) {
      const familyKey = student.fatherName
      if (!familyGroups.has(familyKey)) {
        familyGroups.set(familyKey, [])
      }
      familyGroups.get(familyKey)!.push(student)
    }

    const families = Array.from(familyGroups.values())
    const finalFamilies: StudentRecord[][] = []

    let fi = 0
    while (fi < families.length) {
      const family = families[fi]
      const rand = Math.random()

      if (rand < 0.25 && fi + 1 < families.length && families[fi + 1].length === 1 && family.length === 1) {
        const merged = [...family, ...families[fi + 1]]
        merged[1].fatherName = merged[0].fatherName
        merged[1].motherName = merged[0].motherName
        finalFamilies.push(merged)
        fi += 2
      } else if (rand < 0.35 && fi + 2 < families.length && family.length === 1) {
        const merged = [...family, ...families[fi + 1], ...families[fi + 2]]
        merged[1].fatherName = merged[0].fatherName
        merged[1].motherName = merged[0].motherName
        merged[2].fatherName = merged[0].fatherName
        merged[2].motherName = merged[0].motherName
        finalFamilies.push(merged)
        fi += 3
      } else {
        finalFamilies.push(family)
        fi++
      }
    }

    let parentCounter = 1
    let singleChildCount = 0
    let multiChildCount = 0

    for (const family of finalFamilies) {
      const primaryStudent = family[0]
      const childrenAdmNums = family.map(s => s.admissionNumber)

      const fatherFirstName = primaryStudent.fatherName.split(' ')[0]
      const motherFirstName = primaryStudent.motherName.split(' ')[0]
      const lastName = primaryStudent.lastName

      const fatherParentId = formatID('PAR', YEAR, parentCounter)
      const fatherUser = await User.create({
        admissionNumber: fatherParentId,
        password: 'parent123',
        role: 'parent',
        isActive: true
      })

      await Parent.create({
        user: fatherUser._id,
        parentId: fatherParentId,
        firstName: fatherFirstName,
        lastName,
        phone: randomPhone(),
        email: `${fatherFirstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
        address: `${Math.floor(Math.random() * 500) + 1}, ${pick(LOCALITIES)}`,
        city: 'Varanasi',
        pincode: randomPincode(),
        occupation: pick(OCCUPATIONS),
        relation: 'father',
        children: childrenAdmNums,
        isActive: true
      })

      parentCounter++

      if (Math.random() < 0.6) {
        const motherParentId = formatID('PAR', YEAR, parentCounter)
        const motherUser = await User.create({
          admissionNumber: motherParentId,
          password: 'parent123',
          role: 'parent',
          isActive: true
        })

        await Parent.create({
          user: motherUser._id,
          parentId: motherParentId,
          firstName: motherFirstName,
          lastName,
          phone: randomPhone(),
          email: `${motherFirstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
          address: '',
          city: 'Varanasi',
          pincode: '',
          occupation: pick(['Homemaker', 'Teacher', 'Doctor', 'Nurse', 'Business', 'Private Job']),
          relation: 'mother',
          children: childrenAdmNums,
          isActive: true
        })

        parentCounter++
      }

      if (childrenAdmNums.length === 1) singleChildCount++
      else multiChildCount++
    }

    stats.parents = parentCounter - 1
    console.log(`   ✓ Created ${stats.parents} parents`)
    console.log(`     - Single-child families: ${singleChildCount}`)
    console.log(`     - Multi-child families: ${multiChildCount}\n`)

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. CREATE NOTICES
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('📢 Creating Notices...\n')

    for (const template of NOTICE_TEMPLATES.principal.all_classes) {
      await Notice.create({
        title: template.title,
        content: template.content,
        tag: template.tag,
        priority: template.priority,
        targetClass: 'ALL',
        targetSection: 'ALL',
        targetAudience: 'all',
        academicYear: '2025-26', // UPDATED SCHEMA FIELD
        postedBy: principal.fullName,
        postedById: principal.principalId,
        postedByRole: 'principal',
        date: new Date().toISOString().split('T')[0],
        status: 'approved',
        approvedBy: principal.principalId,
        approvedAt: new Date(),
        isDeleted: false,
        createdAt: randomPastDate(30)
      })
      stats.notices.approved++
      stats.notices.total++
    }

    for (const template of NOTICE_TEMPLATES.principal.specific_class) {
      await Notice.create({
        title: template.title,
        content: template.content,
        tag: template.tag,
        priority: template.priority,
        targetClass: template.targetClass,
        targetSection: 'ALL',
        targetAudience: 'all',
        academicYear: '2025-26', // UPDATED SCHEMA FIELD
        postedBy: principal.fullName,
        postedById: principal.principalId,
        postedByRole: 'principal',
        date: new Date().toISOString().split('T')[0],
        status: 'approved',
        approvedBy: principal.principalId,
        approvedAt: new Date(),
        isDeleted: false,
        createdAt: randomPastDate(30)
      })
      stats.notices.approved++
      stats.notices.total++
    }

    const classTeachers = teachersList.filter(t => t.isClassTeacher && t.currentClassTeacherOf)
    for (const teacher of classTeachers.slice(0, 10)) {
      for (const template of NOTICE_TEMPLATES.teacher.own_class.slice(0, 2)) {
        await Notice.create({
          title: template.title,
          content: template.content,
          tag: template.tag,
          priority: template.priority,
          targetClass: teacher.currentClassTeacherOf!.class,
          targetSection: teacher.currentClassTeacherOf!.section,
          targetAudience: 'all',
          academicYear: '2025-26', // UPDATED SCHEMA FIELD
          postedBy: `${teacher.firstName} ${teacher.lastName}`,
          postedById: teacher.teacherId,
          postedByRole: 'teacher',
          date: new Date().toISOString().split('T')[0],
          status: 'approved',
          approvedBy: null,
          approvedAt: null,
          isDeleted: false,
          createdAt: randomPastDate(20)
        })
        stats.notices.approved++
        stats.notices.total++
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. INITIALIZE COUNTERS (PREVENTS FUTURE ID COLLISIONS)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('🔢 Initializing ID Counters...\n')
    await Counter.findOneAndUpdate({ _id: `PRI-${YEAR}` }, { seq: 1 }, { upsert: true })
    await Counter.findOneAndUpdate({ _id: `TCH-${YEAR}` }, { seq: 30 }, { upsert: true })
    await Counter.findOneAndUpdate({ _id: `RCP-${YEAR}` }, { seq: 3 }, { upsert: true })
    await Counter.findOneAndUpdate({ _id: `SPS-${YEAR}` }, { seq: studentCounter - 1 }, { upsert: true })
    await Counter.findOneAndUpdate({ _id: `PAR-${YEAR}` }, { seq: parentCounter - 1 }, { upsert: true })
    console.log('   ✓ Counters initialized successfully\n')

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('═'.repeat(70))
    console.log('📊 SEED COMPLETE - SUMMARY')
    console.log('═'.repeat(70))

    console.log(`
  USERS CREATED:
  ├─ Principal:     ${stats.principal}
  ├─ Teachers:      ${stats.teachers}
  ├─ Receptionists: ${stats.receptionists}
  ├─ Students:      ${stats.students}
  └─ Parents:       ${stats.parents}

  TOTAL USERS:      ${stats.principal + stats.teachers + stats.receptionists + stats.students + stats.parents}

  NOTICES:
  ├─ Total:         ${stats.notices.total}
  ├─ Approved:      ${stats.notices.approved}

  CLASS DISTRIBUTION:
    Classes 1-12 × Sections A-E × ~20 students = ~${12 * 5 * studentsPerSection} students
    `)

    console.log('═'.repeat(70))
    console.log('📋 SAMPLE LOGINS FOR TESTING')
    console.log('═'.repeat(70))

    console.log('\n  Class Teachers:')
    for (let i = 0; i < 5; i++) {
      const t = teachersList[i]
      if (t.currentClassTeacherOf) {
        console.log(`    ${t.teacherId} │ ${t.firstName} ${t.lastName} │ Class ${t.currentClassTeacherOf.class}-${t.currentClassTeacherOf.section}`)
      }
    }

    console.log('\n  Sample Students:')
    const sampleStudents = await Student.find({}).limit(5)
    for (const s of sampleStudents) {
      console.log(`    ${s.admissionNumber} │ ${s.fullName} │ Class ${s.currentClass}-${s.currentSection}`)
    }

    console.log('\n' + '═'.repeat(70))

    await mongoose.disconnect()
    console.log('\n✅ Disconnected from MongoDB')
    console.log('🎉 Database seeding completed successfully!\n')

  } catch (error: any) {
    console.error('❌ Seed error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

seed()