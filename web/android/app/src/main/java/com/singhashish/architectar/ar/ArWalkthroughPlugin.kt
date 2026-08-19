package com.singhashish.architectar.ar

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ar.core.ArCoreApk

/**
 * The JS <-> native bridge for the AR walkthrough (Phase 4). Registered
 * in MainActivity.java. Deliberately thin: the real state machine and
 * ARCore lifecycle all live in ArWalkthroughActivity, not here -- this
 * plugin's only job is "is this worth offering at all" and "launch the
 * full-screen AR experience," matching how the existing web-based Scene
 * Viewer/Quick Look handoff is also a fire-and-hand-off, not something
 * the calling page stays wired into moment-to-moment.
 */
@CapacitorPlugin(name = "ArWalkthrough")
class ArWalkthroughPlugin : Plugin() {

    /**
     * A cheap up-front check so the web UI can decide whether to show a
     * "Walkthrough" button at all -- SUPPORTED_NOT_INSTALLED and
     * SUPPORTED_APK_TOO_OLD both count as "supported" here since
     * ArWalkthroughActivity itself handles installing/updating ARCore
     * when the walkthrough is actually opened; this call only rules out
     * genuinely incapable hardware (UNSUPPORTED_DEVICE_NOT_CAPABLE).
     */
    @PluginMethod
    fun isSupported(call: PluginCall) {
        val availability = ArCoreApk.getInstance().checkAvailability(context)
        val result = JSObject()
        result.put("supported", availability != ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE)
        call.resolve(result)
    }

    @PluginMethod
    fun startWalkthrough(call: PluginCall) {
        val modelUrl = call.getString("modelUrl")
        if (modelUrl.isNullOrBlank()) {
            call.reject("modelUrl is required")
            return
        }
        val scalePreset = call.getString("scalePreset")
        val projectName = call.getString("projectName") ?: ""

        val intent = Intent(context, ArWalkthroughActivity::class.java).apply {
            putExtra(ArWalkthroughActivity.EXTRA_MODEL_URL, modelUrl)
            putExtra(ArWalkthroughActivity.EXTRA_SCALE_PRESET, scalePreset)
            putExtra(ArWalkthroughActivity.EXTRA_PROJECT_NAME, projectName)
        }
        activity.startActivity(intent)
        call.resolve()
    }
}
