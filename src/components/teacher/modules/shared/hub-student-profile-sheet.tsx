'use client'

/**
 * hub-student-profile-sheet — the ONE canonical Student Profile rendered
 * inside My Class (and any other teacher surface that opens a student
 * from class context).
 *
 * There is NO teacher-specific profile implementation here (master task
 * §2/§25): the SAME canonical `StudentProfilePage` the Principal's
 * Students & Classes module renders is reused, fed with server-authorized
 * data from GET /api/teacher/students/[studentId] — the route re-validates
 * the teacher's scope on EVERY request:
 *
 *   · Class teacher  → overview · academics · attendance · fees · parents
 *   · Subject teacher → overview · academics · attendance
 *
 * Presentation follows the hub's drawer language: a side sheet on desktop,
 * a bottom drawer on mobile — the same pattern as the Growth / Report
 * drawers. Nothing is invented: unknown fields render "Not recorded".
 */

import { useEffect, useState } from 'react'
import { PageTransition } from '@/components/shared/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import type { StudentRecord, FeeStatus } from '@/lib/store/students-store'
import type { StudentProfileRealData, RealStudentFees } from '@/components/principal/modules/students/profile-real-data'
import type { TabName } from '@/components/principal/modules/students/student-profile-page'
import { StudentProfilePage } from '@/components/principal/modules/students/student-profile-page'

/** GET /api/teacher/students/[studentId] response (server truth only). */
interface HubStudentPayload {
  student: {
    id: string
    name: string
    email: string | null
    rollNo: string | null
    admissionNo: string | null
    classId: string | null
    classLabel: string
    stream: string | null
    guardianName: string | null
    guardianPhone: string | null
    gender: string | null
    dob: string | null
    bloodGroup: string | null
    address: string | null
  }
  isClassTeacher: boolean
  attendance: StudentProfileRealData['attendance']
  academics: { latestExam: StudentProfileRealData['latestExam'] }
  fees: RealStudentFees | null
}

function splitClassLabel(label: string): { className: string; section: string } {
  const idx = label.lastIndexOf(' - ')
  if (idx === -1) return { className: label, section: '' }
  return { className: label.slice(0, idx), section: label.slice(idx + 3) }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
}

function mapGender(g: string | null): StudentRecord['gender'] {
  if (g === 'MALE') return 'Male'
  if (g === 'FEMALE') return 'Female'
  return '—' as StudentRecord['gender']
}

function mapFeeStatus(fees: RealStudentFees | null): FeeStatus {
  if (!fees) return 'Paid'
  switch (fees.status) {
    case 'PAID': return 'Paid'
    case 'PARTIAL': return 'Partial'
    default: return 'Pending'
  }
}

/** Map the server payload onto the canonical profile's props. */
function toCanonicalProfile(p: HubStudentPayload): {
  student: StudentRecord
  real: StudentProfileRealData
  visibleTabs: readonly TabName[]
} {
  const s = p.student
  const { className, section } = splitClassLabel(s.classLabel)
  const student: StudentRecord = {
    id: s.id,
    admissionNo: s.admissionNo ?? '—',
    rollNo: s.rollNo ?? '—',
    name: s.name,
    avatar: initialsOf(s.name),
    gender: mapGender(s.gender),
    classId: s.classId ?? '',
    className,
    section,
    dob: s.dob ?? '',
    bloodGroup: s.bloodGroup ?? '—',
    category: '—',
    fatherName: '—',
    motherName: '—',
    guardianPhone: s.guardianPhone ?? '',
    guardianEmail: '',
    guardianName: s.guardianName ?? '',
    city: '—',
    state: '—',
    hostel: false,
    disciplinePoints: 0,
    address: s.address ?? '',
    admissionDate: '',
    previousSchool: '—',
    status: 'Active',
    attendance: p.attendance?.pct ?? 0,
    feeStatus: mapFeeStatus(p.fees),
    feePaid: p.fees?.totalPaid ?? 0,
    feeTotal: p.fees?.totalBilled ?? 0,
    transport: false,
    scholarship: 0,
    medical: '—',
    academics: {
      overallGrade: '—',
      overallPercent: p.academics.latestExam?.averagePct ?? 0,
      rankInClass: 0,
      subjects: [],
    },
    attendanceTrend: [],
    achievements: [],
    disciplineRecords: [],
    documents: [],
    timeline: [],
  }
  const real: StudentProfileRealData = {
    email: s.email,
    dob: s.dob,
    gender: s.gender,
    bloodGroup: s.bloodGroup,
    address: s.address,
    guardianPhone: s.guardianPhone,
    attendance: p.attendance,
    latestExam: p.academics.latestExam,
    fees: p.fees,
  }
  const visibleTabs: readonly TabName[] = p.isClassTeacher
    ? ['overview', 'academics', 'attendance', 'fees', 'parents']
    : ['overview', 'academics', 'attendance']
  return { student, real, visibleTabs }
}

export function HubStudentProfileSheet({
  studentId,
  onOpenChange,
  initialTab,
}: {
  studentId: string | null
  onOpenChange: (open: boolean) => void
  /** Workflow entry point (e.g. fee collection opens the Fees tab). */
  initialTab?: TabName
}) {
  const isMobile = useIsMobile()
  const [payload, setPayload] = useState<HubStudentPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    setPayload(null)
    setError(null)
    ;(async () => {
      try {
        const r = await fetch(`/api/teacher/students/${studentId}`, { cache: 'no-store' })
        if (!r.ok) throw new Error('Could not load this student.')
        const j = await r.json()
        if (cancelled) return
        const data = j && typeof j === 'object' && 'data' in j ? (j as { data?: HubStudentPayload }).data : (j as HubStudentPayload)
        if (!data?.student) throw new Error('Could not load this student.')
        setPayload(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this student.')
      }
    })()
    return () => { cancelled = true }
  }, [studentId])

  const body = (
    <div className="px-1">
      {error ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{error}</div>
      ) : !payload ? (
        <div className="space-y-4 px-1 py-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <PageTransition>
          {(() => {
            const { student, real, visibleTabs } = toCanonicalProfile(payload)
            return (
              <StudentProfilePage
                student={student}
                visibleTabs={visibleTabs}
                detail={real}
                initialTab={initialTab}
                backLabel="My Class"
                onBack={() => onOpenChange(false)}
              />
            )
          })()}
        </PageTransition>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={!!studentId} onOpenChange={(o) => onOpenChange(o)}>
        <DrawerContent className="max-h-[92vh] px-0">
          <DrawerTitle className="sr-only">Student profile</DrawerTitle>
          <DrawerDescription className="sr-only">Canonical student record — teacher-authorized view</DrawerDescription>
          <div className="overflow-y-auto custom-scrollbar overscroll-contain">{body}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={!!studentId} onOpenChange={(o) => onOpenChange(o)}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto custom-scrollbar p-4 sm:p-6">
        <SheetHeader className="px-0 pt-0">
          <SheetTitle className="sr-only">Student profile</SheetTitle>
          <SheetDescription className="sr-only">Canonical student record — teacher-authorized view</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}
