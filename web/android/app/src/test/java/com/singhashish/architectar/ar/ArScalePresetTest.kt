package com.singhashish.architectar.ar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Mirrors web/src/types/ScalePreset.test.ts -- this Kotlin copy of the
 * same arithmetic (see ArScalePreset.kt's own doc comment for why it's
 * duplicated rather than shared) needs to agree with the web version's
 * behavior, including for inputs the web side would never actually send.
 */
class ArScalePresetTest {

    @Test
    fun `1 to 1 renders at true size`() {
        assertEquals(1f, ArScalePreset.visualScale("1:1"))
    }

    @Test
    fun `shrinks larger ratios proportionally`() {
        assertEquals(0.01f, ArScalePreset.visualScale("1:100"))
        assertEquals(0.001f, ArScalePreset.visualScale("1:1000"))
    }

    @Test
    fun `accepts every standard preset`() {
        for (ratio in listOf(1, 5, 10, 20, 50, 100, 200, 500, 1000)) {
            assertEquals(1f / ratio, ArScalePreset.visualScale("1:$ratio"))
        }
    }

    @Test
    fun `rejects a ratio outside the standard list`() {
        assertNull(ArScalePreset.visualScale("1:1000000"))
    }

    @Test
    fun `rejects malformed input instead of throwing`() {
        assertNull(ArScalePreset.visualScale(""))
        assertNull(ArScalePreset.visualScale("1:"))
        assertNull(ArScalePreset.visualScale("garbage"))
        assertNull(ArScalePreset.visualScale("2:100"))
    }
}
