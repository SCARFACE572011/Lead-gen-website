'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ChartData {
  name: string
  value: number
}

interface LeadChartProps {
  data: ChartData[]
}

interface TooltipPayload {
  value: number
  name: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="rounded-xl border border-sand bg-card px-3 py-2 shadow-lg">
      <p className="readout text-stone">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-bold text-signal tabular-nums">
        {payload[0].value} leads
      </p>
    </div>
  )
}

export function LeadChart({ data }: LeadChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-stone">
        No chart data available
      </div>
    )
  }

  return (
    <div className="h-52 w-full" aria-label="Lead quality distribution bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E1D4" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#79705F', fontWeight: 500, fontFamily: 'var(--font-mono), "Space Mono", ui-monospace, monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#79705F', fontFamily: 'var(--font-mono), "Space Mono", ui-monospace, monospace' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#FFEDE6' }} />
          <Bar
            dataKey="value"
            fill="#FF4D23"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
