"use client";
import React, { useEffect, useRef, useState } from "react";

/**
 * MouthOverlay
 * ─────────────────────────────────────────────────────────────────
 * Renders an audio-reactive "mouth shadow" positioned over the
 * avatar's actual mouth. Creates the illusion of speech without
 * requiring true lip sync.
 *
 * How it works:
 *   1. Positioned absolutely using normalized mouthCoords (0-1).
 *   2. An AnalyserNode extracts the audio's amplitude envelope
 *      in real-time during playback.
 *   3. The overlay's scaleY follows the amplitude — silence
 *      shows a thin closed line, loud syllables show an open oval.
 *
 * Design notes:
 *   - Dark semi-transparent fill reads as "shadow inside an open
 *     mouth" rather than a fake cartoon mouth.
 *   - Blur softens edges so it blends with the photo.
 */

export interface MouthCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MouthOverlayProps {
  /** Normalized 0-1 mouth box. If null, overlay renders nothing. */
  coords: any;
  /** The AudioBufferSourceNode currently playing ElevenLabs audio. */
  audioNode: AudioNode | null;
  /** The AudioContext the source is connected to. */
  audioContext: AudioContext | null;
  /** Whether the avatar is actively speaking (drives visibility). */
  active: boolean;
}

export const MouthOverlay: React.FC<MouthOverlayProps> = ({
  coords,
  audioNode,
  audioContext,
  active,
}) => {
  // Current amplitude (0 = silent, 1 = peak). Drives scaleY.
  const [amplitude, setAmplitude] = useState(0);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // ── Hook up the analyser when an audio node arrives ──
  useEffect(() => {
    if (!audioNode || !audioContext || !active) {
      setAmplitude(0);
      return;
    }

    // Create analyser and splice it into the audio graph.
    // We tap into the already-connected source without muting playback.
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    analyserRef.current = analyser;

    try {
      audioNode.connect(analyser);
    } catch (e) {
      // Node might already be connected — safe to ignore
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);

      // Compute RMS amplitude from the waveform — perceptually meaningful.
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const sample = (dataArray[i] - 128) / 128;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // ElevenLabs audio RMS rarely exceeds ~0.3, so we scale up to use
      // the full 0-1 range of the overlay's visual response.
      const scaled = Math.min(1, rms * 3.5);
      setAmplitude(scaled);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        audioNode.disconnect(analyser);
        analyser.disconnect();
      } catch (e) {
        /* ignore */
      }
    };
  }, [audioNode, audioContext, active]);

  // Render nothing if we have no calibration
  if (!coords) return null;

  // Convert normalized coords → CSS percentages
  const left = `${coords.x * 100}%`;
  const top = `${coords.y * 100}%`;
  const width = `${coords.width * 100}%`;
  const height = `${coords.height * 100}%`;

  // Amplitude drives openness + opacity
  const openness = active ? 0.15 + amplitude * 0.85 : 0.05;
  const opacity = active ? 0.55 + amplitude * 0.25 : 0;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        top,
        width,
        height,
        transformOrigin: "center center",
      }}
    >
      <div
        className="w-full h-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(20,5,10,0.95) 0%, rgba(30,10,15,0.7) 50%, transparent 100%)",
          borderRadius: "50%",
          transform: `scaleY(${openness})`,
          transition: "transform 60ms linear, opacity 150ms ease-out",
          opacity,
          filter: "blur(3px)",
        }}
      />
    </div>
  );
};

export default MouthOverlay;
