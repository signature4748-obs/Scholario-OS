import type { AdmissionLetterData } from './types'

/**
 * AUTHORIZATION + FOOTER (spec §20/§24).
 * No QR, no verification theatrics — a subtle document reference in the
 * footer: admission number, student ID, deterministic document ID.
 */
export function Signatures({ data, principalName }: { data: AdmissionLetterData; principalName: string }) {
  return (
    <div className="grid grid-cols-2 gap-8 text-center border-t border-slate-300 pt-6 mt-6">
      <div>
        <div className="h-12 flex items-end justify-center">
          <span className="font-serif italic font-bold text-slate-800 text-sm border-b border-slate-400 px-4">
            {data.parents.fatherName || data.parents.motherName || 'Parent / Guardian'}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-600 block mt-1">Parent / Guardian</span>
      </div>

      <div>
        <div className="h-12 flex items-end justify-center">
          <span className="font-serif italic font-bold text-slate-800 text-sm border-b border-slate-400 px-4">
            {principalName}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-600 block mt-1">Principal</span>
      </div>
    </div>
  )
}

/** Subtle footer reference (spec §20) — verification without a code square. */
export function DocumentFooter({ data }: { data: AdmissionLetterData }) {
  const docId = `DOC-${data.admissionNo.replace(/[^A-Z0-9]/gi, '')}`
  const generated = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className="border-t border-slate-200 mt-6 pt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[9px] font-mono text-slate-400">
      <span>Admission No: {data.admissionNo}{data.studentId ? ` · Student ID: ${data.studentId}` : ''}</span>
      <span>Document ID: {docId} · Generated {generated}</span>
    </div>
  )
}
