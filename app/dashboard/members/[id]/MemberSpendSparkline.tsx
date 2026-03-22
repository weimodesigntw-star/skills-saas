'use client';

import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
  XAxis,
} from 'recharts';
import { formatNTD } from '@/lib/constants';

export type SparkPoint = { label: string; amount: number };

/** V-005：最近訂單消費趨勢（至少 2 筆才顯示） */
export function MemberSpendSparkline({ data }: { data: SparkPoint[] }) {
  if (data.length < 2) return null;

  return (
    <div className="sm:col-span-3 pt-2 border-t">
      <p className="text-sm text-muted-foreground mb-2">近 {data.length} 筆消費趨勢</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [formatNTD(Number(value ?? 0)), '金額']}
            labelFormatter={(label) => String(label)}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
