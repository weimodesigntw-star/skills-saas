'use client';

/**
 * Pure CSS Bar Chart Component
 *
 * 使用 Tailwind CSS 和 HTML 呈現柱狀圖，無外部圖表庫
 * Props:
 *   - data: 圖表資料陣列 { label, value, color? }
 *   - height: 圖表高度 (px)
 *   - showLabels: 是否顯示標籤
 */

import React from 'react';

export interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  height?: number;
  showLabels?: boolean;
}

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  ({ data, height = 300, showLabels = true }, ref) => {
    // 計算最大值用於縮放
    const maxValue = Math.max(...data.map(d => d.value), 1);

    // 格式化金額顯示
    const formatValue = (value: number): string => {
      if (value === 0) return '0';
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toFixed(0);
    };

    return (
      <div
        ref={ref}
        className="w-full overflow-x-auto"
      >
        <div
          className="flex items-flex-end justify-around gap-2 px-4 pb-4"
          style={{ minHeight: `${height}px` }}
        >
          {data.map((item, idx) => {
            const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            const barColor = item.color || 'hsl(217, 91%, 60%)';

            return (
              <div
                key={`${item.label}-${idx}`}
                className="flex-1 flex flex-col items-center justify-end min-w-12"
              >
                {/* Value label on top */}
                {item.value > 0 && (
                  <div className="text-xs font-semibold mb-2 text-foreground">
                    {formatValue(item.value)}
                  </div>
                )}

                {/* Bar */}
                <div
                  className="w-full rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer relative group"
                  style={{
                    height: `${Math.max(heightPercent, 5)}%`,
                    backgroundColor: barColor,
                    minHeight: '8px',
                  }}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-muted text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {formatValue(item.value)}
                  </div>
                </div>

                {/* Label below */}
                {showLabels && (
                  <div className="text-xs text-muted-foreground mt-2 text-center break-words w-full px-1">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

BarChart.displayName = 'BarChart';

export default BarChart;
