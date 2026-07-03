"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /**
   * Allow a decimal separator. On locales that use a comma (e.g. many EU
   * iPhones) a typed "," is normalized to "." so decimals can be entered.
   */
  decimal?: boolean;
};

/**
 * Numeric input rendered as `type="text"` with the matching soft keyboard.
 *
 * We deliberately avoid `type="number"`: on iOS with a comma decimal locale the
 * browser silently discards a typed "," (the DOM value becomes empty), so
 * decimals can't be entered at all. Using `type="text"` lets the raw character
 * reach JS, where we normalize "," -> "." and strip anything non-numeric.
 */
export function NumberInput({
  decimal = false,
  inputMode,
  onChange,
  ...props
}: NumberInputProps) {
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      let cleaned = decimal
        ? raw.replace(/,/g, ".").replace(/[^0-9.]/g, "")
        : raw.replace(/[^0-9]/g, "");

      // Keep only the first decimal point.
      if (decimal) {
        const firstDot = cleaned.indexOf(".");
        if (firstDot !== -1) {
          cleaned =
            cleaned.slice(0, firstDot + 1) +
            cleaned.slice(firstDot + 1).replace(/\./g, "");
        }
      }

      if (cleaned !== raw) e.target.value = cleaned;
      onChange?.(e);
    },
    [decimal, onChange]
  );

  return (
    <Input
      {...props}
      type="text"
      inputMode={inputMode ?? (decimal ? "decimal" : "numeric")}
      onChange={handleChange}
    />
  );
}
