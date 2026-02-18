'use client';

/**
 * Pure CSS Horizontal Bar Chart Component
 *
 * 使用 Tailwind CSS 和 HTML 呈現水平柱狀圖，無外部圖表庫
 * Props:
 *   - data: 圖表資料陣列 { label, value, color? }
 */

import React from 'react';

export interface HorizontalBarDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface HorizontalBarProps {
  data: HorizontalBarDataPoint[];
}

const HorizontalBar = React.forwardRef<HTMLDivElement, HorizontalBarProps>(
  ({ data }, ref) => {
    // 計算最大值用於縮放
    const maxValue = Math.max(...data.map(d => d.value), 1);

    // 格式化金額顯示
    const formatValue = (value: number): string => {
      if (value === 0) return '0';
      if (value >= 1000000) return `NT$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `NT$${(value / 1000).toFixed(0)}K`;
      return `NT$${value.toFixed(0)}`;
    };

    return (
      <div
        ref={ref}
        className="w-full space-y-6 p-4"
      >
        {data.map((item, idx) => {
          const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const barColor = item.color || 'hsl(217, 91%, 60%)';

          return (
            <div
              key={`${item.label}-${idx}`}
              className="flex items-center gap-4 group"
            >
              {/* Label on left */}
              <div className="min-w-24 text-sm font-medium text-foreground text-right">
                {item.label}
              </div>

              {/* Bar container */}
              <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden relative">
                {/* Bar */}
                <div
                  className="h-full rounded-full transition-all duration-300 hover:opacity-80 flex items-center justify-end pr-3 relative group/bar"
                  style={{
                    width: `${Math.max(widthPercent, 5)}%`,
                    backgroundColor: barColor,
                  }}
                >
                  {/* Value label inside bar if space, or on right */}
                  {widthPercent > 25 && (
                    <span className="text-xs font-semibold text-white text-right">
                      {formatValue(item.value)}
                    </span>
                  )}

                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-muted text-xs rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {formatValue(item.value)}
                  </div>
                </div>
              </div>

              {/* Value on right (if not shown in bar) */}
              {widthPercent <= 25 && (
                <div className="min-w-24 text-sm font-semibold text-foreground text-left">
                  {formatValue(item.value)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

HorizontalBar.displayName = 'HorizontalBar';

export default HorizontalBar;
