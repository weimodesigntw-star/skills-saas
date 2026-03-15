'use client';

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  remaining: number;
  limit: number;
};

export function AiQuotaBadge({ remaining, limit }: Props) {
  const isUnlimited = limit < 0 || remaining < 0;
  const isEmpty = !isUnlimited && remaining === 0;
  const isLow = !isUnlimited && remaining <= 3 && remaining > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1 text-xs ${
              isUnlimited ? 'border-muted text-muted-foreground' :
              isEmpty ? 'border-red-300 text-red-500' :
              isLow ? 'border-yellow-300 text-yellow-600' :
              'border-muted text-muted-foreground'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            {isUnlimited ? '∞' : `${remaining}/${limit}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {isUnlimited ? (
            <p>Pro 方案：AI 生成無限制</p>
          ) : (
            <>
              <p>今日 AI 配額剩餘 {remaining} 次（每日上限 {limit} 次）</p>
              {isEmpty && <p className="text-red-400">配額已用完，明日重置</p>}
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
