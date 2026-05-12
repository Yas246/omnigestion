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
  const [displayValue, setDisplayValue] = React.useState<string>(
    value !== undefined ? String(value) : ""
  )

  // Sync display when external value changes (including reset to undefined)
  const prevValue = React.useRef(value)
  React.useEffect(() => {
    if (prevValue.current !== value) {
      setDisplayValue(value !== undefined ? String(value) : "")
      prevValue.current = value
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    if (newValue === "") {
      setDisplayValue("")
      onChange?.(emptyValue)
      return
    }

    setDisplayValue(newValue)

    const numValue = parseFloat(newValue)

    if (!isNaN(numValue)) {
      if (min !== undefined && numValue < min) return
      if (max !== undefined && numValue > max) return
      onChange?.(numValue)
    }
  }

  const handleBlur = () => {
    const numValue = parseFloat(displayValue)

    if (isNaN(numValue) || displayValue === "") {
      if (emptyValue !== undefined) {
        setDisplayValue(String(emptyValue))
        onChange?.(emptyValue)
      } else {
        setDisplayValue("")
        onChange?.(undefined)
      }
    } else {
      const constrainedValue = Math.max(min ?? numValue, Math.min(max ?? numValue, numValue))

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
