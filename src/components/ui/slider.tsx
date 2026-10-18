import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (values: number[]) => void;
  onValueCommit?: (values: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value,
      defaultValue,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      onValueChange,
      onValueCommit,
      ...props
    },
    ref,
  ) => {
    // Support controlled or uncontrolled value
    const [localValue, setLocalValue] = React.useState<number>(() => {
      if (defaultValue && defaultValue.length > 0) return defaultValue[0];
      if (value && value.length > 0) return value[0];
      return min;
    });

    const isControlled = value !== undefined && value.length > 0;
    const currentVal = isControlled ? value[0] : localValue;

    // Track keyboard / mouse focus for accessible indicator ring
    const [isFocused, setIsFocused] = React.useState(false);

    // Calculate percentage for filled range and thumb positioning
    const range = max > min ? max - min : 1;
    const clampedVal = Math.min(Math.max(currentVal, min), max);
    const percent = Math.min(Math.max(((clampedVal - min) / range) * 100, 0), 100);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      const nextVal = parseFloat(e.currentTarget.value);
      if (!isControlled) {
        setLocalValue(nextVal);
      }
      onValueChange?.([nextVal]);
    };

    const handleCommit = () => {
      onValueCommit?.([currentVal]);
    };

    return (
      <div
        className={cn(
          "relative flex w-full touch-none select-none items-center py-1.5",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
      >
        {/* Track background */}
        <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
          {/* Active Range Fill */}
          <div
            className="absolute h-full bg-primary transition-all duration-75"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Visual Thumb Marker */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-all",
            isFocused && "ring-2 ring-ring ring-offset-1 ring-offset-background",
          )}
          style={{
            left: `${percent}%`,
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Accessible native range input overlaid invisibly */}
        <input
          type="range"
          ref={ref}
          min={min}
          max={max}
          step={step}
          value={currentVal}
          disabled={disabled}
          onChange={handleChange}
          onInput={handleChange}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
              handleCommit();
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
      </div>
    );
  },
);

Slider.displayName = "Slider";

export { Slider };
