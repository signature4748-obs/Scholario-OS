import { formatDate } from '@/lib/format'
import type { AdmissionLetterData } from './types'

/**
 * Verification footer — small-print institutional reference block.
 * No QR code, no "Digitally Verified" claims: just the document's
 * identification (Document ID / Admission No. / Session) and the real
 * generation date, as the verification reference for this document.
 */
export function DigitalVerification({ data }: { data: AdmissionLetterData }) {
  const generatedAt = new Date()
  return (
    <div className="mt-8 pt-3 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[9px] text-slate-500 font-mono">
      <div>
        Document ID: DOC-ADM-{data.admissionNo}
      </div>
      <div className="sm:text-center">
        Admission No: {data.admissionNo} · Session {data.academicSession}
      </div>
      <div className="sm:text-right">
        Generated: {formatDate(generatedAt.toISOString().split('T')[0])} · For verification, contact the school office
      </div>
    </div>
  )
}

/** Statutory declaration paragraph. */
export function StatutoryDeclaration({ data }: { data: AdmissionLetterData }) {
  return (
    <p className="text-[10px] text-slate-500 leading-relaxed mt-8 italic text-center">
      &quot;I hereby confirm that the above student has been formally admitted for the Academic Session {data.academicSession}. This letter is issued on the basis of the application and documents submitted, which have been verified against the originals produced.&quot;
    </p>
  )
}

/** Signatures area — parent / guardian and principal. */
export function Signatures({ data, principalName }: { data: AdmissionLetterData; principalName: string }) {
  return (
    <div className="grid grid-cols-2 gap-8 text-center border-t border-slate-300 pt-6 mt-6">
      <div>
        <div className="h-12 flex items-end justify-center">
          <span className="font-serif italic font-bold text-slate-800 text-sm border-b border-slate-400 px-4">
            {data.parents.fatherName || 'Parent / Guardian'}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-600 block mt-1">Parent / Guardian Signature</span>
      </div>

      <div>
        <div className="h-12 flex items-end justify-center">
          <span className="font-serif italic font-bold text-slate-800 text-sm border-b border-slate-400 px-4">
            {principalName}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-600 block mt-1">Principal Signature</span>
      </div>
    </div>
  )
}
