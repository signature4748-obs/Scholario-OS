'use client'

/**
 * ChartsRow1 — the dashboard's primary visualization row.
 *
 * Redesigned (DASH-1 + FC-1):
 *   - Revenue vs Expenses uses `AreaTrendChart` from premium-charts (smooth
 *     Catmull-Rom bezier, thin 1.5px line, NO area fill via `showArea={false}`).
 *     Wrapped in `OpenChartSection` — the chart sits DIRECTLY on the page
 *     with just a heading + subtle divider. No card border, no boxed Panel.
 *     Height 200px. The "View Finance →" link still navigates to Finance.
 *   - Fee Collection uses `DonutChart` from premium-charts (composition chart,
 *     size 180). Stays in a compact `Panel` — donuts benefit from the card.
 *
 * Removed: `ChartsRow2` (was dead code — Attendance Trend bar chart + Today's
 * Attendance radial gauge, both duplicated the Attendance module's analytics).
 */

import { ArrowRight } from 'lucide-react'
import {
  AreaTrendChart,
  DonutChart,
} from '@/components/shared/premium-charts'
import { Panel } from '../shared/panel'
import { OpenChartSection } from '../shared/open-chart-section'
import { useSchoolStats } from '@/hooks/use-school-stats'

export interface ChartsRowProps {
  onNavigate?: (module: string) => void
}

const formatINRCr = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

export function ChartsRow1({ onNavigate }: ChartsRowProps) {
  // SERVER TRUTH — real fee-collection trend (verified Payment rows by
  // month) + real collected-vs-outstanding composition from the Fee
  // ledger (GET /api/dashboard; spec §8/§18 — no mock finance series).
  const { data: schoolStats, loading } = useSchoolStats()
  const trend = schoolStats?.trend ?? []
  const feesTotal = schoolStats?.stats.feesTotal ?? 0
  const feesPaid = schoolStats?.stats.feesPaid ?? 0
  const outstanding = Math.max(0, feesTotal - feesPaid)
  const collectionRate = feesTotal > 0 ? Math.round((feesPaid / feesTotal) * 100) : 0
  const overdueCount = schoolStats?.stats.overdue ?? 0

  const monthLabel = (key: string) => {
    const d = new Date(`${key}-01T00:00:00`)
    return d.toLocaleDateString('en-IN', { month: 'short' })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Collections trend — 2/3 width, OPEN smooth line chart (no card border) */}
      <OpenChartSection
        className="lg:col-span-2"
        title="Fee Collections"
        subtitle={loading ? 'Loading…' : 'Last 6 months · verified payments'}
        action={
          <button
            onClick={() => onNavigate?.('finance')}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            title="Open Finance Dashboard"
          >
            View Finance
            <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        {trend.length === 0 && !loading ? (
          <p className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
            No verified payments recorded yet.
          </p>
        ) : (
          <AreaTrendChart
            data={trend.map((t) => ({ month: monthLabel(t.month), revenue: t.amount }))}
            height={200}
            formatValue={formatINRCr}
            labelKey="month"
            primaryKey="revenue"
            primaryLabel="Collected"
            primaryColor="oklch(0.55 0.14 162)"
            showArea={false}
          />
        )}
      </OpenChartSection>

      {/* Fee Collection — 1/3 width, DonutChart (real ledger composition) */}
      <Panel
        title="Fee Collection"
        subtitle="Collected vs outstanding"
        action={
          <button
            onClick={() => onNavigate?.('fees')}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            title="Open Fee Management"
          >
            View Fees
            <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="flex items-center justify-center py-2">
          <DonutChart
            data={[
              { name: 'Collected', value: feesPaid, color: 'oklch(0.55 0.14 162)' },
              { name: 'Outstanding', value: outstanding, color: 'oklch(0.7 0.15 25)' },
            ]}
            centerValue={loading ? '…' : `${collectionRate}%`}
            centerLabel="Collected"
            centerSub={overdueCount > 0 ? `${overdueCount} overdue` : 'current'}
            formatValue={formatINRCr}
            size={160}
            thickness={18}
          />
        </div>
      </Panel>
    </div>
  )
}
