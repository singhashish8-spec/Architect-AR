package com.singhashish.architectar.ar

/**
 * Every state the AR walkthrough screen can be in, in user-facing terms
 * -- not raw ARCore enum values. The whole point of this type is to be
 * the one place technical AR states (TrackingFailureReason, session
 * exceptions, permission results) get translated into something a
 * client or architect standing in a room can actually act on. See
 * docs/features/ar-walkthrough.md.
 */
sealed interface ArWalkthroughState {
    data object CheckingAvailability : ArWalkthroughState
    data object UnsupportedDevice : ArWalkthroughState
    data object RequestingCameraPermission : ArWalkthroughState
    data object CameraPermissionDenied : ArWalkthroughState
    data object InstallingArCore : ArWalkthroughState
    data object LoadingModel : ArWalkthroughState
    data object SearchingForSurfaces : ArWalkthroughState
    data object ReadyForPlacement : ArWalkthroughState
    data object Placed : ArWalkthroughState
    data class TrackingLimited(val reason: TrackingLimitedReason) : ArWalkthroughState
    data object TrackingLost : ArWalkthroughState
    data class Error(val message: String, val recoverable: Boolean) : ArWalkthroughState
}

/** User-facing reasons tracking can be temporarily degraded -- mirrors
 * ARCore's own TrackingFailureReason, translated to plain language at
 * the one boundary (ArWalkthroughActivity) that reads the raw enum. */
enum class TrackingLimitedReason {
    NONE,
    EXCESSIVE_MOTION,
    INSUFFICIENT_LIGHT,
    INSUFFICIENT_FEATURES,
    CAMERA_UNAVAILABLE,
    BAD_STATE,
}

fun TrackingLimitedReason.toUserMessage(): String = when (this) {
    TrackingLimitedReason.NONE -> "Tracking is temporarily limited."
    TrackingLimitedReason.EXCESSIVE_MOTION -> "Move your phone more slowly."
    TrackingLimitedReason.INSUFFICIENT_LIGHT -> "It's too dark here -- try somewhere brighter."
    TrackingLimitedReason.INSUFFICIENT_FEATURES ->
        "Point your phone at a surface with more detail (not a plain wall or floor)."
    TrackingLimitedReason.CAMERA_UNAVAILABLE -> "The camera isn't available right now."
    TrackingLimitedReason.BAD_STATE -> "Something went wrong with tracking -- try restarting the walkthrough."
}
