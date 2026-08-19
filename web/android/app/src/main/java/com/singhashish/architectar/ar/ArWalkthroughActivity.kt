package com.singhashish.architectar.ar

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.TrackingFailureReason
import io.github.sceneview.ar.ARScene
import io.github.sceneview.ar.arcore.createAnchorOrNull
import io.github.sceneview.ar.arcore.isValid
import io.github.sceneview.ar.rememberARCameraNode
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.node.ModelNode
import io.github.sceneview.rememberCollisionSystem
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberModelLoader
import io.github.sceneview.rememberNodes
import io.github.sceneview.rememberOnGestureListener
import io.github.sceneview.rememberView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL

/**
 * The native AR walkthrough (Phase 4, docs/features/ar-walkthrough.md).
 * A separate full-screen Activity, not embedded in the Capacitor
 * WebView -- the same shape the existing web-based Scene Viewer/Quick
 * Look handoff already uses, for the same reason: this is a genuinely
 * different, camera-driven experience, not another screen of the app.
 *
 * Launched by ArWalkthroughPlugin.kt with three extras: the model's own
 * public GLB URL, its scale preset (e.g. "1:100"), and the project name
 * (display only). Everything below is intentionally sequential and
 * explicit rather than clever: camera permission -> ARCore availability
 * -> ARCore install (if needed) -> download the model -> hand off to
 * SceneView's ARScene, which owns the actual ARCore session from that
 * point on. Each step has its own user-facing state (ArWalkthroughState)
 * and its own failure path -- see that file for why raw ARCore/Android
 * states are never shown directly to whoever's holding the phone.
 */
class ArWalkthroughActivity : ComponentActivity() {

    companion object {
        const val EXTRA_MODEL_URL = "modelUrl"
        const val EXTRA_SCALE_PRESET = "scalePreset"
        const val EXTRA_PROJECT_NAME = "projectName"
        private const val TAG = "ArWalkthrough"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val modelUrl = intent.getStringExtra(EXTRA_MODEL_URL)
        val scalePresetExtra = intent.getStringExtra(EXTRA_SCALE_PRESET)
        val projectName = intent.getStringExtra(EXTRA_PROJECT_NAME) ?: ""
        val visualScale = scalePresetExtra?.let { ArScalePreset.visualScale(it) } ?: 1f

        if (modelUrl.isNullOrBlank()) {
            // Nothing sensible to show without a model -- this is a
            // programming error in how the plugin launched this Activity,
            // not a real-world failure a user should ever see, so it
            // just refuses to open rather than showing a broken screen.
            Log.e(TAG, "ArWalkthroughActivity started with no model URL -- refusing to open.")
            finish()
            return
        }

        setContent {
            MaterialTheme {
                ArWalkthroughScreen(
                    modelUrl = modelUrl,
                    visualScale = visualScale,
                    projectName = projectName,
                    onClose = { finish() },
                )
            }
        }
    }
}

@Composable
private fun ArWalkthroughScreen(
    modelUrl: String,
    visualScale: Float,
    projectName: String,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    var state by remember { mutableStateOf<ArWalkthroughState>(ArWalkthroughState.CheckingAvailability) }
    var localModelFile by remember { mutableStateOf<File?>(null) }
    // Bumped on every onResume -- forces the availability/permission/
    // install gate to re-run, specifically for the case where the user
    // was sent to Google Play to install/update ARCore or Google Play
    // Services and is now returning to this Activity. ARCore's own docs
    // are explicit that requestInstall() must be re-checked in
    // onResume(), not just called once -- this is that re-check.
    var resumeSignal by remember { mutableIntStateOf(0) }
    var arCoreInstallRequestedOnce by remember { mutableStateOf(false) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) resumeSignal++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        state = if (granted) {
            ArWalkthroughState.CheckingAvailability
        } else {
            ArWalkthroughState.CameraPermissionDenied
        }
    }

    // The gate: permission -> ARCore availability -> ARCore install.
    // Re-runs on resumeSignal changing (returning from a permission
    // dialog or a Play Store install/update) as well as on entering
    // CheckingAvailability/InstallingArCore specifically.
    LaunchedEffect(state, resumeSignal) {
        when (state) {
            is ArWalkthroughState.CheckingAvailability -> {
                val hasCameraPermission = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.CAMERA,
                ) == PackageManager.PERMISSION_GRANTED
                if (!hasCameraPermission) {
                    state = ArWalkthroughState.RequestingCameraPermission
                    permissionLauncher.launch(Manifest.permission.CAMERA)
                    return@LaunchedEffect
                }

                // ArCoreApk.checkAvailability() can return UNKNOWN_CHECKING
                // while it queries Play Store in the background -- poll
                // briefly rather than treating that as a real answer.
                var availability = ArCoreApk.getInstance().checkAvailability(context)
                var attempts = 0
                while (availability.isTransient && attempts < 10) {
                    delay(300)
                    availability = ArCoreApk.getInstance().checkAvailability(context)
                    attempts++
                }

                state = when {
                    availability.isSupported -> ArWalkthroughState.LoadingModel
                    availability == ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE ->
                        ArWalkthroughState.UnsupportedDevice
                    else -> ArWalkthroughState.InstallingArCore
                }
            }

            is ArWalkthroughState.InstallingArCore -> {
                val activity = context as? ComponentActivity ?: return@LaunchedEffect
                try {
                    val installStatus = ArCoreApk.getInstance()
                        .requestInstall(activity, !arCoreInstallRequestedOnce)
                    arCoreInstallRequestedOnce = true
                    when (installStatus) {
                        ArCoreApk.InstallStatus.INSTALLED -> state = ArWalkthroughState.LoadingModel
                        ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
                            // Control is about to leave this Activity for
                            // Play Store/Google Play Services; onResume's
                            // resumeSignal bump re-enters this branch when
                            // the user comes back.
                        }
                    }
                } catch (e: Exception) {
                    Log.e("ArWalkthrough", "ARCore install request failed", e)
                    state = ArWalkthroughState.Error(
                        "Couldn't install the AR components this device needs. Please update Google Play Services and try again.",
                        recoverable = true,
                    )
                }
            }

            is ArWalkthroughState.LoadingModel -> {
                try {
                    val file = withContext(Dispatchers.IO) {
                        downloadToCache(context.cacheDir, modelUrl)
                    }
                    localModelFile = file
                    state = ArWalkthroughState.SearchingForSurfaces
                } catch (e: Exception) {
                    Log.e("ArWalkthrough", "Model download failed: $modelUrl", e)
                    state = ArWalkthroughState.Error(
                        "Couldn't download the model for AR. Check your connection and try again.",
                        recoverable = true,
                    )
                }
            }

            else -> Unit
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        val modelFile = localModelFile
        if (modelFile != null &&
            (state is ArWalkthroughState.SearchingForSurfaces ||
                state is ArWalkthroughState.ReadyForPlacement ||
                state is ArWalkthroughState.Placed ||
                state is ArWalkthroughState.TrackingLimited ||
                state is ArWalkthroughState.TrackingLost)
        ) {
            ArWalkthroughScene(
                modelFile = modelFile,
                visualScale = visualScale,
                onStateChange = { state = it },
            )
        }

        ArStatusOverlay(
            state = state,
            projectName = projectName,
            onClose = onClose,
            onRetry = { state = ArWalkthroughState.CheckingAvailability },
        )
    }
}

/**
 * The actual ARCore scene: plane detection, tap-to-place, and the
 * placed model. Once a model is anchored, "walkthrough" needs no extra
 * code of its own -- SceneView's AR camera node already reflects the
 * device's real tracked pose every frame (that's what ARCore's motion
 * tracking *is*), so physically walking around the room already moves
 * the virtual camera through the model at whatever visualScale was
 * applied to it. See docs/features/ar-walkthrough.md's Requirements.
 */
@Composable
private fun ArWalkthroughScene(
    modelFile: File,
    visualScale: Float,
    onStateChange: (ArWalkthroughState) -> Unit,
) {
    val engine = rememberEngine()
    val modelLoader = rememberModelLoader(engine)
    val cameraNode = rememberARCameraNode(engine)
    val childNodes = rememberNodes()
    val view = rememberView(engine)
    val collisionSystem = rememberCollisionSystem(view)
    var frame by remember { mutableStateOf<Frame?>(null) }
    var hasPlaced by remember { mutableStateOf(false) }

    ARScene(
        modifier = Modifier.fillMaxSize(),
        childNodes = childNodes,
        engine = engine,
        view = view,
        modelLoader = modelLoader,
        collisionSystem = collisionSystem,
        planeRenderer = !hasPlaced,
        cameraNode = cameraNode,
        sessionConfiguration = { session, config ->
            config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
            config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
            config.depthMode = if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
                Config.DepthMode.AUTOMATIC
            } else {
                Config.DepthMode.DISABLED
            }
            config.focusMode = Config.FocusMode.AUTO
        },
        // Without this, a real ARCore session failure (camera held by
        // another app, a fatal session exception, Play Services dying
        // mid-session) left the screen silently stuck on whatever status
        // text was last shown -- there was no path back to a working
        // state or even an explanation. This is that path.
        onSessionFailed = { exception ->
            Log.e("ArWalkthrough", "ARCore session failed", exception)
            onStateChange(
                ArWalkthroughState.Error(
                    "AR couldn't start (${exception.message ?: "the camera may be in use by another app"}). Try again.",
                    recoverable = true,
                ),
            )
        },
        onSessionUpdated = { _, updatedFrame ->
            frame = updatedFrame
            if (!hasPlaced) {
                onStateChange(
                    if (updatedFrame.getUpdatedTrackables(com.google.ar.core.Plane::class.java).isNotEmpty() ||
                        childNodes.isNotEmpty()
                    ) {
                        ArWalkthroughState.ReadyForPlacement
                    } else {
                        ArWalkthroughState.SearchingForSurfaces
                    },
                )
            }
        },
        onTrackingFailureChanged = { reason ->
            if (!hasPlaced) return@ARScene
            onStateChange(
                if (reason == null) {
                    ArWalkthroughState.Placed
                } else {
                    ArWalkthroughState.TrackingLimited(reason.toWalkthroughReason())
                },
            )
        },
        onGestureListener = rememberOnGestureListener(
            onSingleTapConfirmed = { motionEvent, node ->
                if (node != null || hasPlaced) return@rememberOnGestureListener
                val hitResults = frame?.hitTest(motionEvent.x, motionEvent.y) ?: return@rememberOnGestureListener
                val hit = hitResults.firstOrNull { it.isValid(depthPoint = false, point = false) }
                val anchor = hit?.createAnchorOrNull() ?: return@rememberOnGestureListener

                // createModelInstance() reads and parses the downloaded
                // file on this call -- a truncated download or a server
                // error page saved under a .glb name (downloadToCache
                // doesn't itself validate the response) throws here, not
                // earlier. Uncaught, that would crash the whole app on
                // tap instead of just failing this one placement attempt.
                try {
                    val anchorNode = AnchorNode(engine = engine, anchor = anchor)
                    val modelNode = ModelNode(
                        modelInstance = modelLoader.createModelInstance(modelFile.absolutePath),
                        scaleToUnits = null,
                        centerOrigin = null,
                    ).apply {
                        scale = io.github.sceneview.math.Scale(visualScale, visualScale, visualScale)
                    }
                    anchorNode.addChildNode(modelNode)
                    childNodes.add(anchorNode)
                    hasPlaced = true
                    onStateChange(ArWalkthroughState.Placed)
                } catch (e: Exception) {
                    Log.e("ArWalkthrough", "Failed to place model", e)
                    anchor.detach()
                    // downloadToCache() reuses whatever's already on disk
                    // for this URL -- if that file is what just failed to
                    // parse, deleting it here is what makes "Try again"
                    // actually re-download instead of retrying the same
                    // bad file forever.
                    modelFile.delete()
                    onStateChange(
                        ArWalkthroughState.Error(
                            "This model couldn't be loaded for AR. Check your connection and try again.",
                            recoverable = true,
                        ),
                    )
                }
            },
        ),
    )
}

private fun TrackingFailureReason.toWalkthroughReason(): TrackingLimitedReason = when (this) {
    TrackingFailureReason.NONE -> TrackingLimitedReason.NONE
    TrackingFailureReason.EXCESSIVE_MOTION -> TrackingLimitedReason.EXCESSIVE_MOTION
    TrackingFailureReason.INSUFFICIENT_LIGHT -> TrackingLimitedReason.INSUFFICIENT_LIGHT
    TrackingFailureReason.INSUFFICIENT_FEATURES -> TrackingLimitedReason.INSUFFICIENT_FEATURES
    TrackingFailureReason.CAMERA_UNAVAILABLE -> TrackingLimitedReason.CAMERA_UNAVAILABLE
    TrackingFailureReason.BAD_STATE -> TrackingLimitedReason.BAD_STATE
    else -> TrackingLimitedReason.NONE
}

/** Downloads [url] into [cacheDir], reusing an already-downloaded copy
 * (keyed by URL hash) rather than re-fetching on every walkthrough open
 * -- a real IFC/FBX-derived GLB can be tens of MB, not worth re-pulling
 * over the client's mobile connection every single time. */
private fun downloadToCache(cacheDir: File, url: String): File {
    val fileName = "ar_model_${url.hashCode()}.glb"
    val target = File(cacheDir, fileName)
    if (target.exists() && target.length() > 0) return target

    val tempFile = File(cacheDir, "$fileName.part")
    URL(url).openStream().use { input ->
        FileOutputStream(tempFile).use { output ->
            input.copyTo(output)
        }
    }
    tempFile.renameTo(target)
    return target
}

@Composable
private fun ArStatusOverlay(
    state: ArWalkthroughState,
    projectName: String,
    onClose: () -> Unit,
    onRetry: () -> Unit,
) {
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        // Top bar: project name + close button, always visible so
        // there's always a way out of AR mode regardless of state --
        // see docs/features/ar-walkthrough.md's error-handling notes.
        Surface(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxSize(),
            color = Color.Transparent,
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Surface(color = Color.Black.copy(alpha = 0.55f)) {
                    Box(modifier = Modifier.fillMaxSize().padding(12.dp)) {
                        Text(projectName, color = Color.White, modifier = Modifier.align(Alignment.CenterStart))
                        Text(
                            "Close",
                            color = Color.White,
                            modifier = Modifier
                                .align(Alignment.CenterEnd)
                                .padding(4.dp)
                                .clickable(onClick = onClose),
                        )
                    }
                }
                Spacer(modifier = Modifier.height(0.dp))
            }
        }

        val message = state.toStatusMessage()
        if (message != null) {
            Surface(
                modifier = Modifier.align(Alignment.BottomCenter).padding(24.dp),
                color = Color.Black.copy(alpha = 0.75f),
                shape = MaterialTheme.shapes.medium,
            ) {
                Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    if (state.isBusy()) {
                        CircularProgressIndicator(modifier = Modifier.padding(bottom = 8.dp))
                    }
                    Text(message, color = Color.White)
                    if (state is ArWalkthroughState.Error && state.recoverable) {
                        Button(onClick = onRetry, modifier = Modifier.padding(top = 8.dp)) {
                            Text("Try again")
                        }
                    }
                    if (state is ArWalkthroughState.UnsupportedDevice ||
                        state is ArWalkthroughState.CameraPermissionDenied ||
                        (state is ArWalkthroughState.Error && !state.recoverable)
                    ) {
                        Button(onClick = onClose, modifier = Modifier.padding(top = 8.dp)) {
                            Text("Close")
                        }
                    }
                }
            }
        }
    }
}

private fun ArWalkthroughState.isBusy(): Boolean = this is ArWalkthroughState.CheckingAvailability ||
    this is ArWalkthroughState.RequestingCameraPermission ||
    this is ArWalkthroughState.InstallingArCore ||
    this is ArWalkthroughState.LoadingModel ||
    this is ArWalkthroughState.SearchingForSurfaces

private fun ArWalkthroughState.toStatusMessage(): String? = when (this) {
    is ArWalkthroughState.CheckingAvailability -> "Checking AR support…"
    is ArWalkthroughState.RequestingCameraPermission -> "Camera access is needed to place the model in AR."
    is ArWalkthroughState.CameraPermissionDenied ->
        "Camera access was denied. Enable it in your phone's Settings to use AR walkthrough."
    is ArWalkthroughState.InstallingArCore -> "Installing AR components…"
    is ArWalkthroughState.UnsupportedDevice -> "This device doesn't support AR. Try the regular 3D view instead."
    is ArWalkthroughState.LoadingModel -> "Loading model…"
    is ArWalkthroughState.SearchingForSurfaces -> "Move your phone slowly to find a surface."
    is ArWalkthroughState.ReadyForPlacement -> "Tap a surface to place the model."
    is ArWalkthroughState.Placed -> null
    is ArWalkthroughState.TrackingLimited -> reason.toUserMessage()
    is ArWalkthroughState.TrackingLost -> "Tracking lost. Move your phone to help find the space again."
    is ArWalkthroughState.Error -> message
}

private val ArCoreApk.Availability.isTransient: Boolean
    get() = this == ArCoreApk.Availability.UNKNOWN_CHECKING

private val ArCoreApk.Availability.isSupported: Boolean
    get() = this == ArCoreApk.Availability.SUPPORTED_INSTALLED
