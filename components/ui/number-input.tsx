import * as React from "react"
import { Input } from "@/components/ui/input"

export interface NumberInputProps extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "value"> {
  /** Value as number */
  value?: number | undefined
  /** Callback receiving the number value */
  onChange?: (value: number | undefined) => void
  /** Minimum allowed value */
  min?: number
  /** Maximum allowed value */
  max?: number
  /** Step for increment/decrement */
  step?: number
  /** Fallback value when input is empty (default: undefined) */
  emptyValue?: number | undefined
  /** Display value when undefined */
  placeholder?: string
}

/**
 * NumberInput component that properly handles empty input state.
 *
 * When the user clears the input, the value becomes `undefined` (or `emptyValue`)
 * instead of immediately converting to `0`. This allows the user to type freely
 * without getting "0" when they delete the content.
 *
 * @example
 * ```tsx
 * <NumberInput
 *   value={form.watch('price')}
 *   onChange={(value) => form.setValue('price', value)}
 *   min={0}
 *   step="0.01"
 *   placeholder="0.00"
 * />
 * ```
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  emptyValue = undefined,
  placeholder = "0",
  className,
  ...props
}: NumberInputProps) {
  // Internal state for the displayed string value
  const [displayValue, setDisplayValue] = React.useState<string>(
    value !== undefined ? String(value) : ""
  )

  // Update display value when prop value changes
  React.useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(String(value))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    // Allow empty input (user is clearing)
    if (newValue === "") {
      setDisplayValue("")
      onChange?.(emptyValue)
      return
    }

    // Allow typing (don't restrict yet, validate on blur)
    setDisplayValue(newValue)

    // Convert to number and validate
    const numValue = parseFloat(newValue)

    // Only call onChange if it's a valid number
    if (!isNaN(numValue)) {
      if (min !== undefined && numValue < min) return
      if (max !== undefined && numValue > max) return
      onChange?.(numValue)
    }
  }

  const handleBlur = () => {
    // On blur, ensure we have a valid number or emptyValue
    const numValue = parseFloat(displayValue)

    if (isNaN(numValue) || displayValue === "") {
      // Apply emptyValue if set, otherwise clear
      if (emptyValue !== undefined) {
        setDisplayValue(String(emptyValue))
        onChange?.(emptyValue)
      } else {
        setDisplayValue("")
        onChange?.(undefined)
      }
    } else {
      // Apply min/max constraints on blur
      const constrainedValue =
        min !== undefined && numValue < min ? min :
        max !== undefined && numValue > max ? max :
        numValue

      setDisplayValue(String(constrainedValue))
      onChange?.(constrainedValue)
    }
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  )
}
