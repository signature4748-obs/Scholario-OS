import { Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Top action bar — print / download / close (hidden on print). */
export function TopActionBar({
  admissionNo,
  onPrint,
  onDownloadPdf,
  onClose,
}: {
  admissionNo: string
  onPrint: () => void
  onDownloadPdf: () => void
  onClose?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white text-slate-900 p-3 rounded-xl print:hidden shadow-2xs border border-gray-200">
      <span className="text-xs font-mono font-semibold text-slate-500">
        {admissionNo}
      </span>

      <div className="flex items-center gap-2">
        <Button onClick={onPrint} size="sm" variant="outline" className="border-gray-200 bg-white text-slate-800 hover:bg-gray-50 gap-1.5 text-xs font-semibold">
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
        <Button onClick={onDownloadPdf} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs font-semibold">
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        {onClose && (
          <Button onClick={onClose} size="sm" variant="ghost" className="text-slate-400 hover:text-slate-700 text-xs">
            Close
          </Button>
        )}
      </div>
    </div>
  )
}

