import * as React from "react"

import { GlassButton, GlassCard, GlassSurface } from "../glass"
import { cn } from "@/lib/utils"

const CONTROL_CONFIG = [
  {
    key: "displacementScale" as const,
    label: "Displacement",
    min: 0.2,
    max: 1.4,
    step: 0.05,
    defaultValue: 0.9,
  },
  {
    key: "blurAmount" as const,
    label: "Blur",
    min: 6,
    max: 40,
    step: 1,
    defaultValue: 18,
  },
  {
    key: "saturation" as const,
    label: "Saturation",
    min: 0.7,
    max: 1.6,
    step: 0.05,
    defaultValue: 1.05,
  },
  {
    key: "aberrationIntensity" as const,
    label: "Aberration",
    min: 0,
    max: 0.2,
    step: 0.01,
    defaultValue: 0.07,
  },
  {
    key: "elasticity" as const,
    label: "Elasticity",
    min: 0.2,
    max: 1,
    step: 0.05,
    defaultValue: 0.65,
  },
] satisfies Array<{
  key: keyof LiquidGlassState
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
}>

type LiquidGlassState = {
  displacementScale: number
  blurAmount: number
  saturation: number
  aberrationIntensity: number
  elasticity: number
}

export function LiquidGlassPlayground() {
  const [variant, setVariant] = React.useState<"light" | "dark">("light")
  const [disabled, setDisabled] = React.useState(false)
  const [values, setValues] = React.useState<LiquidGlassState>(() =>
    CONTROL_CONFIG.reduce(
      (acc, control) => {
        acc[control.key] = control.defaultValue
        return acc
      },
      {} as LiquidGlassState,
    ),
  )

  const handleChange = React.useCallback((key: keyof LiquidGlassState, next: number) => {
    setValues((previous) => ({ ...previous, [key]: next }))
  }, [])

  return (
    <div className="space-y-6">
      <GlassCard className="p-6" glassDisabled={disabled} glassSurfaceClassName="max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Liquid Glass Playground</h2>
            <p className="text-sm text-muted-foreground">
              Tweak the shader parameters and preview the fallbacks for lower powered mobile devices.
            </p>
          </div>
          <GlassButton
            size="sm"
            variant="secondary"
            glassDisabled={disabled}
            onClick={() => setVariant((current) => (current === "light" ? "dark" : "light"))}
          >
            Switch to {variant === "light" ? "dark" : "light"} variant
          </GlassButton>
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <GlassSurface
          variant={variant}
          disabled={disabled}
          className="min-h-[240px]"
          contentClassName="flex h-full flex-col justify-between p-6"
          {...values}
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Preview</p>
            <h3 className="text-2xl font-semibold">Mobile header shell</h3>
            <p className="mt-2 text-sm text-white/70">
              The glass surface tracks the user pointer through the shared provider. Try changing the parameters to balance
              performance and fidelity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <GlassButton size="sm" variant="secondary" glassDisabled={disabled}>
              Primary Action
            </GlassButton>
            <GlassButton size="sm" variant="ghost" glassDisabled={disabled}>
              Secondary
            </GlassButton>
          </div>
        </GlassSurface>

        <aside className="space-y-4 rounded-2xl border border-border/60 bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Disable glass</span>
            <button
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full border border-border/80 bg-background transition",
                disabled && "bg-primary",
              )}
              type="button"
              onClick={() => setDisabled((previous) => !previous)}
            >
              <span
                className={cn(
                  "inline-block size-5 translate-x-0.5 rounded-full bg-white shadow transition",
                  disabled && "translate-x-[22px]",
                )}
              />
            </button>
          </div>

          <div className="space-y-4">
            {CONTROL_CONFIG.map((control) => (
              <label key={control.key} className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{control.label}</span>
                  <span className="tabular-nums text-muted-foreground">{values[control.key].toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={values[control.key]}
                  onChange={(event) => handleChange(control.key, Number.parseFloat(event.target.value))}
                  className="accent-primary"
                />
              </label>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
