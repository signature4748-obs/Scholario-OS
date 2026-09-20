/**
 * fee-collection/types — the client DTO contract of
 * GET/POST /api/teacher/fee-collection. Client-safe, mirrors the server
 * payload exactly (src/app/api/teacher/fee-collection/route.ts).
 */

export interface FeeLedgerItem {
  id: string
  title: string
  amount: number
  paid: number
  outstanding: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | string
  dueDate: string | null
}

export interface OfficePayment {
  id: string
  feeTitle: string
  amount: number
  method: string | null
  createdAt: string
}

export interface StudentLedger {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'NONE'
  totalBilled: number
  totalPaid: number
  outstanding: number
  awaitingVerification: number
  items: FeeLedgerItem[]
  officePayments: OfficePayment[]
}

export interface CollectionStudent {
  id: string
  name: string
  rollNo: string | null
  guardianName: string | null
  guardianPhone: string | null
  ledger: StudentLedger | null
}

export interface FeeTxn {
  id: string
  studentId: string | null
  studentName: string | null
  className: string | null
  feeId: string | null
  feeHeadName: string | null
  amount: number
  method: string
  status: string
  source: string | null
  referenceNumber: string | null
  note: string | null
  receiptNo: string | null
  collectedBy: string | null
  collectedAt: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  rejectedBy: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  createdAt: string
}

export interface ClassFeeSummary {
  totalBilled: number
  collected: number
  outstanding: number
  fullyPaid: number
  overdueStudents: number
  awaitingVerificationCount: number
  awaitingVerificationAmount: number
}

export interface ClassMonthSheet {
  label: string
  verifiedAmount: number
  verifiedCount: number
  pendingAmount: number
  pendingCount: number
}

export interface FeeClassPayload {
  classId: string
  label: string
  room: string | null
  studentCount: number
  summary: ClassFeeSummary
  month: ClassMonthSheet
  students: CollectionStudent[]
  transactions: FeeTxn[]
}

export interface FeeCollectionPayload {
  month: string
  classes: FeeClassPayload[]
}

export interface CollectResult {
  txn: FeeTxn
  acknowledgement: { headline: string; body: string }
}
