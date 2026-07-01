// Safe audio playback for workout feedback sounds.
//
// Autoplay can reject (no user gesture, muted device, missing file). Every call
// is wrapped so a failure never surfaces as an unhandled promise rejection.
export function playSound(src: string, volume = 0.5) {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => {
      /* ignore autoplay/permission errors */
    });
  } catch {
    /* ignore construction errors */
  }
}

export const SOUNDS = {
  restStart: "/sounds/rest-start.mp3",
  restEnd: "/sounds/rest-end.mp3",
} as const;
