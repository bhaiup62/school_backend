// src/index.ts

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

import connectDB from './config/db'
import authRoutes         from './routes/authRoutes'
import studentRoutes      from './routes/studentRoutes'
import parentRoutes       from './routes/parentRoutes'
import teacherRoutes      from './routes/teacherRoutes'
import receptionistRoutes from './routes/receptionistRoutes'
import principalRoutes    from './routes/principalRoutes'
import sseRoutes          from './routes/sseRoutes'
import adminRoutes from './routes/adminRoutes'
import admissionRoutes from './routes/admin/admissionRoutes'
import academicRoutes from './routes/admin/academicRoutes'
import classSubjectRoutes from './routes/admin/classSubjectRoutes'
import staffRoutes from './routes/admin/staffRoutes'
import examRoutes from './routes/admin/examRoutes'
import { errorHandler, notFound } from './middleware/errorMiddleware'


dotenv.config()

const app  = express()
const PORT = process.env.PORT || 5000

connectDB()

app.use(helmet())

app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}))

// Rate limiters
const limiter = rateLimit({
  windowMs: 150 * 60 * 1000,
  max: 1000000,
  message: { success: false, message: 'Too many requests.' },
})
app.use('/api', limiter)

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try after 15 minutes.' },
})
app.use('/api/auth/login', loginLimiter)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'))

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success:     true,
    message:     'Saraswati School API is running.',
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
  })
})

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth',         authRoutes)
app.use('/api/student',      studentRoutes)
app.use('/api/parent',       parentRoutes)
app.use('/api/teacher',      teacherRoutes)
app.use('/api/receptionist', receptionistRoutes)
app.use('/api/principal',    principalRoutes)
app.use('/api/admin', adminRoutes)                // This handles /api/admin/dashboard
app.use('/api/admin/admissions', admissionRoutes)
app.use('/api/admin/academics', academicRoutes)
app.use('/api/admin/academics', classSubjectRoutes)
app.use('/api/admin/staff', staffRoutes)
app.use('/api/admin/exams', examRoutes)
 // This handles /api/admin/admissions/setup/...
app.use('/api/events',       sseRoutes)     // ← SSE real-time stream

// Error handling
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(``)
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`)
  console.log(`📡 API Base:    http://localhost:${PORT}/api`)
  console.log(`📡 SSE Stream: http://localhost:${PORT}/api/events`)
  console.log(``)
})

export default app
