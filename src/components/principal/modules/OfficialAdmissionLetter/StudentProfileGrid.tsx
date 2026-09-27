import { formatDate } from '@/lib/format'
import type { AdmissionLetterData } from './types'

/**
 * STUDENT INFORMATION — compact structured block (spec §21/§24).
 * Photo prints only when the school's document policy allows it (§16/§17);
 * sensitive demographics never appear here (they are collected, not printed).
 */
export function StudentProfileGrid({ data, fullName }: { data: AdmissionLetterData; fullName: string }) {
  const privacy = data.documentPrivacy
  const showPhoto = privacy ? privacy.letterShowsPhoto && !!data.student.photoUrl : !!data.student.photoUrl
  const showParentPhone = privacy ? privacy.letterShowsParentPhone : true
  const showAddress = privacy ? privacy.letterShowsAddress : false
  const showPreviousSchool = privacy ? privacy.letterShowsPreviousSchool : true

  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-slate-300 pb-1.5 mb-4">
        Student Information
      </h3>
      <div className="flex flex-col sm:flex-row gap-5">
        {showPhoto && (
          <div className="shrink-0 self-start">
            <div className="h-28 w-24 rounded-md border border-slate-300 overflow-hidden bg-slate-50">
              { }
              <img
                src={data.student.photoUrl}
                alt={`${fullName} photograph`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 flex-1 min-w-0 text-xs">
          <div>
            <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Name of Student</dt>
            <dd className="font-bold text-slate-900 text-sm">{fullName}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Admission Number</dt>
            <dd className="font-mono font-bold text-slate-900">{data.admissionNo}</dd>
          </div>
          {data.studentId && (
            <div>
              <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Student ID</dt>
              <dd className="font-mono font-bold text-slate-900">{data.studentId}</dd>
            </div>
          )}
          <div>
            <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Class & Section</dt>
            <dd className="font-bold text-slate-900">
              {data.academic.className || '—'}{data.academic.section ? ` — ${data.academic.section}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Roll Number</dt>
            <dd className="font-mono font-bold text-slate-900">{data.academic.rollNo || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Date of Birth</dt>
            <dd className="font-semibold text-slate-800">{data.student.dob ? formatDate(data.student.dob) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Date of Admission</dt>
            <dd className="font-semibold text-slate-800">{formatDate(data.admissionDate)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Parent / Guardian</dt>
            <dd className="font-semibold text-slate-800">
              {data.parents.fatherName || data.parents.motherName || '—'}
              {showParentPhone && data.parents.fatherPhone ? ` · ${data.parents.fatherPhone}` : ''}
            </dd>
          </div>
          {showPreviousSchool && data.academic.previousSchool && (
            <div>
              <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Previous School</dt>
              <dd className="font-semibold text-slate-800">{data.academic.previousSchool}</dd>
            </div>
          )}
          {showAddress && data.address?.currentAddress && (
            <div className="col-span-2">
              <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Residence</dt>
              <dd className="font-semibold text-slate-800">
                {[data.address.currentAddress, data.address.district, data.address.state, data.address.pincode].filter(Boolean).join(', ')}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
