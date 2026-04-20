  // src/models/principal/MasterCurriculum.ts
  // Master curriculum template owned by Principal
  // This is the SINGLE SOURCE OF TRUTH for chapter definitions

  import mongoose, { Schema, Document, Model } from 'mongoose'

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHAPTER DEFINITION (Embedded in Master Curriculum)
  // ═══════════════════════════════════════════════════════════════════════════════
  export interface IChapterDefinition {
    _id: mongoose.Types.ObjectId
    chapterNumber: number
    chapterName: string
    totalTopics: number
    expectedHours: number          // Target hours to complete this chapter
    expectedWeekNumber: number     // Which week this chapter should be completed by
    learningObjectives: string[]
    resources: string[]
  }

  const ChapterDefinitionSchema = new Schema<IChapterDefinition>(
    {
      chapterNumber: { type: Number, required: true },
      chapterName: { type: String, required: true, trim: true },
      totalTopics: { type: Number, required: true, min: 1 },
      expectedHours: { type: Number, required: true, min: 1 },
      expectedWeekNumber: { type: Number, required: true, min: 1 },
      learningObjectives: [{ type: String, trim: true }],
      resources: [{ type: String, trim: true }],
    },
    { _id: true }  // Each chapter gets its own ObjectId for referencing
  )

  // ═══════════════════════════════════════════════════════════════════════════════
  // MASTER CURRICULUM MODEL
  // ═══════════════════════════════════════════════════════════════════════════════
  export interface IMasterCurriculum extends Document {
    // Identity
    class: string                          // e.g., "10"
    subject: string                        // e.g., "Mathematics"
    academicYear: string                   // e.g., "2025-26"
    term: 'first' | 'second' | 'full_year'
    
    // Curriculum definition
    chapters: IChapterDefinition[]
    totalExpectedHours: number             // Sum of all chapter hours
    totalWeeks: number                     // Total weeks for this curriculum
    
    // Pacing configuration
    sessionStartDate: Date                 // When this academic session starts
    sessionEndDate: Date                   // When this academic session ends
    
    // Metadata
    createdBy: mongoose.Types.ObjectId     // Principal who created this
    lastModifiedBy: mongoose.Types.ObjectId
    version: number                        // For curriculum revisions
    isActive: boolean
    
    createdAt: Date
    updatedAt: Date
  }

  const MasterCurriculumSchema = new Schema<IMasterCurriculum>(
    {
      class: {
        type: String,
        required: [true, 'Class is required'],
        trim: true,
      },
      subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true,
      },
      academicYear: {
        type: String,
        required: [true, 'Academic year is required'],  // NO DEFAULT - must be explicit
        trim: true,
        validate: {
          validator: (v: string) => /^\d{4}-\d{2}$/.test(v),
          message: 'Academic year must be in format YYYY-YY (e.g., 2025-26)',
        },
      },
      term: {
        type: String,
        enum: ['first', 'second', 'full_year'],
        required: true,
      },
      
      chapters: {
        type: [ChapterDefinitionSchema],
        validate: {
          validator: (chapters: IChapterDefinition[]) => chapters.length > 0,
          message: 'Curriculum must have at least one chapter',
        },
      },
      totalExpectedHours: { type: Number, required: true, min: 1 },
      totalWeeks: { type: Number, required: true, min: 1 },
      
      sessionStartDate: { type: Date, required: true },
      sessionEndDate: { type: Date, required: true },
      
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Principal',
        required: true,
      },
      lastModifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Principal',
      },
      version: { type: Number, default: 1 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  )

  // ═══════════════════════════════════════════════════════════════════════════════
  // INDEXES
  // ═══════════════════════════════════════════════════════════════════════════════
  // Unique curriculum per class-subject-year-term combination
  MasterCurriculumSchema.index(
    { class: 1, subject: 1, academicYear: 1, term: 1 },
    { unique: true }
  )
  MasterCurriculumSchema.index({ academicYear: 1, isActive: 1 })
  MasterCurriculumSchema.index({ createdBy: 1 })

  const MasterCurriculum: Model<IMasterCurriculum> =
    mongoose.models.MasterCurriculum || mongoose.model<IMasterCurriculum>('MasterCurriculum', MasterCurriculumSchema)

  export default MasterCurriculum
