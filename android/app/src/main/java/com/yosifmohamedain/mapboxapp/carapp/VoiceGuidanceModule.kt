package com.yosifmohamedain.mapboxapp.carapp

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

// Routes spoken cues (preemption alerts, turn-by-turn guidance — see
// VoiceGuidanceService.ts's announce()) through the navigation-guidance
// audio channel Android Auto expects from a NAVIGATION-category car app
// (see AndroidManifest.xml / SpatCarAppService / SpatSession). Plain
// expo-speech plays on the ordinary media stream, which AAOS's
// driver-distraction audio policy suppresses for anything but that
// registered channel once a car session is connected — that's why
// preemption voice cues went silent on the phone the moment Android Auto
// connected. Tagging our own TextToSpeech instance with
// USAGE_ASSISTANCE_NAVIGATION_GUIDANCE and requesting audio focus under
// that same usage makes the cue audible whether or not a car is connected.
class VoiceGuidanceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    TextToSpeech.OnInitListener {

    override fun getName(): String = "VoiceGuidance"

    private val audioManager =
        reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private val guidanceAudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    private var focusRequest: AudioFocusRequest? = null
    private val utteranceCounter = AtomicInteger(0)

    private var tts: TextToSpeech? = null
    private var ttsReady = false

    // TextToSpeech's onInit is async — an announce() that arrives before it
    // fires (e.g. the first preemption alert right after app launch) would
    // otherwise be silently dropped instead of queued.
    private var pendingSpeak: Pair<String, String?>? = null

    init {
        tts = TextToSpeech(reactContext.applicationContext, this)
    }

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
        if (!ttsReady) return

        tts?.setAudioAttributes(guidanceAudioAttributes)
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) = abandonFocus()

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = abandonFocus()

            override fun onError(utteranceId: String?, errorCode: Int) = abandonFocus()
        })

        pendingSpeak?.let { (text, voiceId) ->
            pendingSpeak = null
            speakInternal(text, voiceId)
        }
    }

    // voiceIdentifier mirrors VoiceGuidanceService's activeVoiceId — the
    // same setting picked in SettingsScreen's voice picker — so switching to
    // this native path doesn't change which voice reads the alert.
    @ReactMethod
    fun announce(text: String, voiceIdentifier: String?) {
        if (!ttsReady) {
            pendingSpeak = text to voiceIdentifier
            return
        }
        speakInternal(text, voiceIdentifier)
    }

    @ReactMethod
    fun stop() {
        tts?.stop()
        abandonFocus()
    }

    private fun speakInternal(text: String, voiceIdentifier: String?) {
        val engine = tts ?: return

        val matchedVoice = voiceIdentifier?.let { id ->
            engine.voices?.firstOrNull { it.name == id }
        }
        if (matchedVoice != null) {
            engine.voice = matchedVoice
        } else {
            engine.language = Locale.US
        }
        engine.setSpeechRate(0.9f)

        if (!requestFocus()) return

        // QUEUE_ADD, not QUEUE_FLUSH: two legitimate cues landing close
        // together (e.g. "cleared" for the zone just left immediately
        // followed by "granted" for the next one on a fast zone-to-zone hop)
        // must both be heard in order, not have the second cut the first off
        // mid-utterance — see the PreemptionViewModel.syncPosition debounce
        // fix this pairs with.
        val utteranceId = "voice-guidance-${utteranceCounter.incrementAndGet()}"
        engine.speak(text, TextToSpeech.QUEUE_ADD, null, utteranceId)
    }

    private fun requestFocus(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(guidanceAudioAttributes)
                .build()
            focusRequest = request
            audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
            ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
    }

    private fun abandonFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            focusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
    }

    override fun invalidate() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        abandonFocus()
        super.invalidate()
    }
}
