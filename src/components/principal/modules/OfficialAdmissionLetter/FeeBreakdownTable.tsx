import { FileText } from 'lucide-react'
import { formatINR } from '@/lib/format'
import type { AdmissionLetterData } from './types'

/**
 * FEE SUMMARY — the annual fee schedule for the admitted student (spec §21).
 * Clean institutional language: states what is payable, never claims a
 * payment status (receipts are separate documents).
 * Printed only when the school's document privacy policy allows it (§17).
 */
export function FeeBreakdownTable({ data }: { data: AdmissionLetterData }) {
  const privacy = data.documentPrivacy
  if (privacy && !privacy.letterShowsFeeSummary) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-slate-500" /> Annual Fee Summary
        </h3>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase">
              <tr>
                <th className="p-2.5">Fee Head</th>
                <th className="p-2.5 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="p-2">Registration Fee</td>
                <td className="p-2 text-right font-mono">{formatINR(data.fees.registrationFee || 0)}</td>
              </tr>
              <tr>
                <td className="p-2">Admission Fee (One-Time)</td>
                <td className="p-2 text-right font-mono">{formatINR(data.fees.admissionFee)}</td>
              </tr>
              <tr>
                <td className="p-2">Annual Tuition Fee</td>
                <td className="p-2 text-right font-mono">{formatINR(data.fees.tuitionFee)}</td>
              </tr>
              {(data.fees.annualCharges || 0) > 0 && (
                <tr>
                  <td className="p-2">Development & Activity Charges</td>
                  <td className="p-2 text-right font-mono">{formatINR(data.fees.annualCharges || 0)}</td>
                </tr>
              )}
              {(data.fees.booksTotal || 0) > 0 && (
                <tr>
                  <td className="p-2">Books & Course Material</td>
                  <td className="p-2 text-right font-mono">{formatINR(data.fees.booksTotal || 0)}</td>
                </tr>
              )}
              {(data.fees.examFee || 0) > 0 && (
                <tr>
                  <td className="p-2">Examination Charges</td>
                  <td className="p-2 text-right font-mono">{formatINR(data.fees.examFee || 0)}</td>
                </tr>
              )}
              {(data.fees.transportFee || 0) > 0 && (
                <tr>
                  <td className="p-2">Transport Charges</td>
                  <td className="p-2 text-right font-mono">{formatINR(data.fees.transportFee || 0)}</td>
                </tr>
              )}
              <tr className="bg-slate-50 font-bold text-slate-800">
                <td className="p-2">Subtotal</td>
                <td className="p-2 text-right font-mono">{formatINR(data.fees.subtotal || data.fees.totalAnnualFee || 0)}</td>
              </tr>
              {((data.fees.discountAmount || 0) > 0 || (data.fees.discountApplied || 0) > 0) && (
                <tr className="bg-slate-50/70 text-slate-800 font-semibold">
                  <td className="p-2">Concession ({data.fees.discountName || 'Approved Concession'})</td>
                  <td className="p-2 text-right font-mono">&minus; {formatINR(data.fees.discountAmount || data.fees.discountApplied || 0)}</td>
                </tr>
              )}
              <tr className="bg-slate-900 text-white font-extrabold text-sm">
                <td className="p-2.5 uppercase tracking-wider">Net Annual Payable</td>
                <td className="p-2.5 text-right font-mono">{formatINR(data.fees.finalPayable)}</td>
              </tr>
            </tbody>
          </table>
      </div>
      <p className="text-[10px] text-slate-500 mt-1.5">
        Fee payments are acknowledged separately by official receipts issued by the school office.
      </p>
    </div>
  )
}
