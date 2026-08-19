# Publishing to the Google Play Store — what's left

> Part of [`release/`](README.md) — see also
> [`play-store-listing.md`](play-store-listing.md) and
> [`privacy-policy.md`](privacy-policy.md).

This session built and build-verified the app (see
[`../history/sessions/2026-08-19-session-11.md`](../history/sessions/2026-08-19-session-11.md))
and produced a debug-signed APK for hands-on testing
(`releases/architect-ar-debug.apk`). **Publishing to the Play Store itself
was not done and could not be done from here** — every step below needs
either the owner's own Google account/payment method, a real physical
device, or a judgment call about the business (pricing, target audience)
that isn't this session's to make.

## 1. Test on a real device first

Install `releases/architect-ar-debug.apk` on an actual Android phone
(minSdk 24 / Android 7.0+) with ARCore support. Specifically check:
walkthrough button appears, camera permission prompt, plane detection
actually finds a surface, tap-to-place actually places the model at a
sensible size, walking around the phone actually moves you through the
model. None of this has been verified hands-on — see
[`../features/ar-walkthrough.md`](../features/ar-walkthrough.md)'s
Implementation section for exactly what has and hasn't been checked.

## 2. Create a Google Play Console account

- https://play.google.com/console/signup — one-time **$25 USD**
  registration fee, a Google account, and identity verification
  (government ID) are all required. Only the account owner can do this.

## 3. Generate a real release signing key

The debug APK is signed with the shared, publicly-known Android debug
key — fine for installing/testing directly, but Google will reject an
upload signed with it. A real release key needs to be generated once,
kept safe, and reused for every future update (losing it means losing
the ability to update the app):

```bash
keytool -genkey -v -keystore architect-ar-release.keystore \
  -alias architect-ar -keyalg RSA -keysize 2048 -validity 10000
```

Then either let Google manage upload signing (Play App Signing —
recommended, Google's current default) or wire the keystore into
`web/android/app/build.gradle`'s `signingConfigs` block yourself. Do not
commit the keystore file or its passwords to this repository.

## 4. Build a release bundle

```bash
cd web
npm run build           # web/dist -- must be current
npx cap sync android
cd android
./gradlew bundleRelease  # produces app/build/outputs/bundle/release/app-release.aab
```

Play Console expects an `.aab` (Android App Bundle), not an `.apk`, for a
new app.

## 5. Fill in the store listing

Draft copy is in [`play-store-listing.md`](play-store-listing.md) — title,
short/full description, category. Still needed, and not something this
session can produce: real screenshots from a real device (Play Console
requires at least 2), a feature graphic (1024×500), and the app's
512×512 hi-res icon (`releases/play-store-icon-512.png`, generated this
session from the same "HSA" mark used elsewhere in the app — swap for a
real logo if/when one exists, see
[`../history/status.md`](../history/status.md)'s open items).

## 6. Host the privacy policy

Play Console requires a **live URL** to a privacy policy for any app that
requests the camera permission (this app does, for AR). A draft is in
[`privacy-policy.md`](privacy-policy.md) — it needs to be hosted
somewhere reachable (a page in the existing web app is the natural place,
e.g. `/privacy`, since the domain already exists) and the real URL filled
into Play Console's data-safety section. Not built this session — the
draft text exists, the hosted page doesn't yet.

## 7. Content rating and data-safety questionnaires

Play Console requires answering a content-rating questionnaire (this app
has no user-generated content visible to other users, no ads, no
in-app purchases — should rate as "Everyone") and a data-safety form
declaring what data the app collects. This app's own data collection is
already documented in the privacy policy draft; someone with Play
Console access needs to transcribe those answers into Google's specific
form.

## 8. Submit and wait for review

Google's review can take anywhere from a few hours to a few days for a
first submission. Nothing to do here but wait once everything above is
submitted.

## What this session did NOT do, and why

- **Did not create a Play Console account or pay the $25 fee** — needs
  the owner's own Google account and payment method.
- **Did not generate a real release signing key** — a real one should be
  generated once by whoever will own it long-term (losing it is
  effectively permanent), not invented and thrown away by an automated
  session.
- **Did not take real device screenshots** — this sandbox has no camera
  or display.
- **Did not host the privacy policy** — needs a decision on whether it
  lives in this web app or elsewhere, and a real deploy.
- **Did not submit anything to Google** — everything above needs the
  account owner's direct action at some point; this session went as far
  as a from-scratch autonomous session honestly could.
