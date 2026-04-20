import Teacher from '../../models/teacher/Teacher'

export const getTeacher = async (admissionNumber: string) => {
  return Teacher.findOne({ teacherId: admissionNumber, isActive: true })
}

export const canAccessClass = (teacher: any, cls: string, section?: string): boolean => {
  if (!teacher) return false

  const targetClass = String(cls).trim().toLowerCase()
  const targetSection = section ? String(section).trim().toLowerCase() : ''
  const assigned = teacher.currentAssignedClasses || teacher.assignedClasses || []

  // 1. Does the teacher have FULL access to the entire class? (e.g., assigned "10" without a section)
  const hasFullClassAccess = assigned.some((c: any) => String(c).trim().toLowerCase() === targetClass)

  if (hasFullClassAccess) return true

  // 2. If they ask for the whole class (no section) but DON'T have full access, DENY IMMEDIATELY.
  if (!targetSection) return false

  // 3. Otherwise, they asked for a specific section (e.g., "10-a"). Let's see if they teach it.
  const targetSpecific = `${targetClass}-${targetSection}`

  if (assigned.some((c: any) => String(c).trim().toLowerCase() === targetSpecific)) return true

  // 4. Finally, check if they are the Class Teacher for this specific section.
  if (teacher.isClassTeacher) {
    const ctInfo = teacher.currentClassTeacherOf || teacher.classTeacherOf
    if (ctInfo) {
      const ctClass = String(ctInfo.class).trim().toLowerCase()
      const ctSection = String(ctInfo.section).trim().toLowerCase()
      if (ctClass === targetClass && ctSection === targetSection) return true
    }
  }

  return false
}