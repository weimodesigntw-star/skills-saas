'use client';

/**
 * Numeric Keypad Component
 *
 * Touch-friendly numeric input interface with:
 * - 3x4 grid (1-9, 0, 00, backspace)
 * - Display of current value
 * - Clear and confirm buttons
 * - Large buttons for easy touch interaction
 */

import { Button } from '@/components/ui/button';
import { Delete, RotateCcw } from 'lucide-react';

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
}

export function NumPad({ value, onChange, onConfirm }: NumPadProps) {
  const handleNumber = (num: string) => {
    onChange(value + num);
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const buttons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '0', '00', 'BACK',
  ];

  return (
    <div className="space-y-4">
      {/* Display Value */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
        <div className="text-right text-3xl font-bold text-foreground min-h-[3rem] flex items-center justify-end">
          {value || '0'}
        </div>
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-3 gap-2">
        {buttons.map((btn) => {
          if (btn === 'BACK') {
            return (
              <Button
                key={btn}
                onClick={handleDelete}
                variant="outline"
                className="h-14 text-lg font-semibold bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
              >
                <Delete className="h-5 w-5" />
              </Button>
            );
          }

          return (
            <Button
              key={btn}
              onClick={() => handleNumber(btn)}
              variant="outline"
              className="h-14 text-xl font-semibold hover:bg-primary/10"
            >
              {btn}
            </Button>
          );
        })}
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button
          onClick={handleClear}
          variant="outline"
          className="h-12 text-base font-semibold"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          清除
        </Button>
        <Button
          onClick={onConfirm}
          className="h-12 text-base font-semibold"
        >
          確認
        </Button>
      </div>
    </div>
  );
}
