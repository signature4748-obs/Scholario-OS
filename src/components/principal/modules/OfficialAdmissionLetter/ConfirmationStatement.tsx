import type { AdmissionLetterData } from './types'

/**
 * CONFIRMATION — the formal admission statement (spec §21/§24).
 * Reads like an actual school-issued document; no ERP vocabulary.
 */
export function ConfirmationStatement({ data, schoolName, fullName }: {
  data: AdmissionLetterData
  schoolName: string
  fullName: string
}) {
  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-slate-300 pb-1.5 mb-3">
        Confirmation of Admission
      </h3>
      <p className="text-[13px] text-slate-800 leading-relaxed">
        This is to certify that <strong className="font-bold">{fullName}</strong>
        {' '}has been granted admission to <strong className="font-bold">{schoolName}</strong>{' '}
        for the academic session <strong className="font-bold">{data.academicSession}</strong>, to{' '}
        <strong className="font-bold">
          {[data.academic.className, data.academic.section ? `Section ${data.academic.section}` : '']
            .filter(Boolean).join(', ') || 'the school'}
        </strong>
        {data.academic.rollNo ? `, Roll Number ${data.academic.rollNo}` : ''}.
      </p>
      <p className="text-[13px] text-slate-800 leading-relaxed mt-2.5">
        The student&rsquo;s application and supporting documents have been examined and found in order.
        This admission is subject to the school&rsquo;s rules and code of conduct in force, and to the
        regular payment of applicable fees.
      </p>
    </div>
  )
}
