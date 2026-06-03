package com.siddhisoftwaress.VoiceRecording

import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.nio.ByteBuffer
import kotlin.math.max

class AudioConcatModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AudioConcatModule"

  @ReactMethod
  fun concatenateM4a(inputUris: ReadableArray, outputUri: String, promise: Promise) {
    var muxer: MediaMuxer? = null

    try {
      if (inputUris.size() == 0) {
        promise.reject("NO_INPUTS", "No audio segments were provided.")
        return
      }

      val inputPaths = mutableListOf<String>()
      for (index in 0 until inputUris.size()) {
        val uri = inputUris.getString(index)
        val path = uri?.let { uriToPath(it) }

        if (path.isNullOrBlank() || !File(path).exists()) {
          promise.reject("MISSING_INPUT", "Audio segment was not found: $uri")
          return
        }

        inputPaths.add(path)
      }

      val outputPath = uriToPath(outputUri)
      if (outputPath.isBlank()) {
        promise.reject("BAD_OUTPUT", "Output path is invalid.")
        return
      }

      File(outputPath).parentFile?.mkdirs()
      if (File(outputPath).exists()) {
        File(outputPath).delete()
      }

      val firstTrack = findAudioTrack(inputPaths.first())
      val firstFormat = firstTrack.format

      muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val outputTrackIndex = muxer.addTrack(firstFormat)
      muxer.start()

      var presentationOffsetUs = 0L

      inputPaths.forEach { inputPath ->
        val track = findAudioTrack(inputPath)
        validateCompatibleFormat(firstFormat, track.format)

        val segmentDurationUs = copyAudioSamples(
          inputPath = inputPath,
          sourceTrackIndex = track.index,
          sourceFormat = track.format,
          muxer = muxer,
          outputTrackIndex = outputTrackIndex,
          presentationOffsetUs = presentationOffsetUs,
        )

        presentationOffsetUs += segmentDurationUs
      }

      muxer.stop()
      muxer.release()
      muxer = null

      promise.resolve(pathToFileUri(outputPath))
    } catch (error: Exception) {
      try {
        muxer?.stop()
      } catch (_: Exception) {
      }

      muxer?.release()
      promise.reject("CONCAT_FAILED", error.message, error)
    }
  }

  private fun copyAudioSamples(
    inputPath: String,
    sourceTrackIndex: Int,
    sourceFormat: MediaFormat,
    muxer: MediaMuxer,
    outputTrackIndex: Int,
    presentationOffsetUs: Long,
  ): Long {
    val extractor = MediaExtractor()

    try {
      extractor.setDataSource(inputPath)
      extractor.selectTrack(sourceTrackIndex)

      val maxInputSize = if (sourceFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
        sourceFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
      } else {
        1024 * 1024
      }

      val buffer = ByteBuffer.allocateDirect(max(maxInputSize, 1024 * 1024))
      val bufferInfo = android.media.MediaCodec.BufferInfo()
      val sampleTimes = mutableListOf<Long>()
      var firstSampleTimeUs: Long? = null
      var lastRelativePresentationUs = 0L

      while (true) {
        buffer.clear()
        val sampleSize = extractor.readSampleData(buffer, 0)
        if (sampleSize < 0) break

        val sampleTimeUs = extractor.sampleTime
        if (firstSampleTimeUs == null) {
          firstSampleTimeUs = sampleTimeUs
        }

        val relativePresentationUs = sampleTimeUs - (firstSampleTimeUs ?: 0L)
        sampleTimes.add(relativePresentationUs)
        lastRelativePresentationUs = relativePresentationUs

        bufferInfo.set(
          0,
          sampleSize,
          presentationOffsetUs + relativePresentationUs,
          extractor.sampleFlags,
        )

        muxer.writeSampleData(outputTrackIndex, buffer, bufferInfo)
        extractor.advance()
      }

      val formatDurationUs = if (sourceFormat.containsKey(MediaFormat.KEY_DURATION)) {
        sourceFormat.getLong(MediaFormat.KEY_DURATION)
      } else {
        0L
      }

      val inferredFrameDurationUs = inferFrameDurationUs(sampleTimes, sourceFormat)
      return max(formatDurationUs, lastRelativePresentationUs + inferredFrameDurationUs)
    } finally {
      extractor.release()
    }
  }

  private fun inferFrameDurationUs(
    sampleTimes: List<Long>,
    format: MediaFormat,
  ): Long {
    if (sampleTimes.size >= 2) {
      return max(1L, sampleTimes.last() - sampleTimes[sampleTimes.size - 2])
    }

    val sampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
      format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    } else {
      44100
    }

    return (1024L * 1_000_000L) / sampleRate
  }

  private fun findAudioTrack(path: String): AudioTrackInfo {
    val extractor = MediaExtractor()

    try {
      extractor.setDataSource(path)

      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = if (format.containsKey(MediaFormat.KEY_MIME)) {
          format.getString(MediaFormat.KEY_MIME)
        } else {
          null
        }

        if (mime?.startsWith("audio/") == true) {
          return AudioTrackInfo(index, format)
        }
      }

      throw IllegalArgumentException("No audio track found in $path")
    } finally {
      extractor.release()
    }
  }

  private fun validateCompatibleFormat(reference: MediaFormat, candidate: MediaFormat) {
    val referenceMime = reference.getString(MediaFormat.KEY_MIME)
    val candidateMime = candidate.getString(MediaFormat.KEY_MIME)

    if (referenceMime != candidateMime) {
      throw IllegalArgumentException("Cannot merge audio segments with different codecs.")
    }

    validateMatchingInteger(reference, candidate, MediaFormat.KEY_SAMPLE_RATE, "sample rate")
    validateMatchingInteger(reference, candidate, MediaFormat.KEY_CHANNEL_COUNT, "channel count")
  }

  private fun validateMatchingInteger(
    reference: MediaFormat,
    candidate: MediaFormat,
    key: String,
    label: String,
  ) {
    if (!reference.containsKey(key) || !candidate.containsKey(key)) return

    if (reference.getInteger(key) != candidate.getInteger(key)) {
      throw IllegalArgumentException("Cannot merge audio segments with different $label.")
    }
  }

  private fun uriToPath(uri: String): String {
    return if (uri.startsWith("file://")) {
      Uri.parse(uri).path ?: ""
    } else {
      uri
    }
  }

  private fun pathToFileUri(path: String): String = Uri.fromFile(File(path)).toString()

  private data class AudioTrackInfo(
    val index: Int,
    val format: MediaFormat,
  )
}
