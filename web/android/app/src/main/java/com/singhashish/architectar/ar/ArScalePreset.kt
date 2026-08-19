package com.singhashish.architectar.ar

/**
 * Mirrors web/src/types/ScalePreset.ts's visualScale() exactly, so a
 * model placed in the native AR walkthrough renders at the same
 * relative size as it does in the web viewer and the existing Scene
 * Viewer/Quick Look handoff. The exported GLB is always authored at
 * true 1:1 real-world units; this is the uniform scale factor applied
 * on top, so e.g. a "1:1000" master plan shrinks to tabletop size while
 * a "1:1" room renders true life-size.
 *
 * Kept as a small standalone object (not parsed from the web app's own
 * TS at build time) since duplicating one line of arithmetic is safer
 * and simpler here than wiring a cross-language build step for it --
 * see docs/features/ar-walkthrough.md's Open questions for why this
 * needs to be watched if the web-side presets ever change.
 */
object ArScalePreset {
    private val VALID_RATIOS = setOf(1, 5, 10, 20, 50, 100, 200, 500, 1000)

    /** "1:100" -> 0.01f. Returns null for anything that isn't a real preset. */
    fun visualScale(preset: String): Float? {
        val ratio = preset.substringAfter(':', missingDelimiterValue = "").toIntOrNull() ?: return null
        if (!preset.startsWith("1:") || ratio !in VALID_RATIOS) return null
        return 1f / ratio
    }
}
