// Shared P90X video data + helpers, used by both the program page
// (components/P90XWorkout.tsx) and the full-screen watch page (app/watch/[key]).

// `videoSrc` is an optional direct video URL (e.g. a hosted CDN/Blob MP4).
// When present a native <video> player with full controls is used; otherwise
// we fall back to the Google Drive preview embed.
export type P90XExercise = { name: string; videoUrl: string; videoSrc?: string };

export const P90X_EXERCISES: Record<string, P90XExercise> = {
  "1": { name: "Chest and Back", videoUrl: "https://drive.google.com/file/d/1oq-3-kDNLwYNXP26SCWVQhe2Gz6vmgCz/view?usp=sharing" },
  "2": { name: "Plyometrics", videoUrl: "https://drive.google.com/file/d/1S-ZRjxO9d9Heu-V686f9jXt--NnfBCly/view?usp=sharing" },
  "3": { name: "Shoulders and Arms", videoUrl: "https://drive.google.com/file/d/11gm5yEcIVfo2EJpzaVDUdSYaHDakfTOt/view?usp=sharing" },
  "4": { name: "Yoga X", videoUrl: "https://drive.google.com/file/d/1ztrHX-i2k4rQDu-ShYFZbSBn1iKdxG6c/view?usp=sharing" },
  "5": { name: "Legs and Back", videoUrl: "https://drive.google.com/file/d/1A30ZC6gghBSENauJkgx5F-_N3bhvlakn/view?usp=sharing" },
  "6": { name: "Kenpo X", videoUrl: "https://drive.google.com/file/d/1VX3H0zFsQDGyeV9JetIQH5hmA84zorTJ/view?usp=sharing" },
  "7": { name: "Core Synergistics", videoUrl: "https://drive.google.com/file/d/1tiDE4eeuatiRyLleb5aegeVvDlGZngE8/view?usp=sharing" },
  "8": { name: "X Stretch", videoUrl: "https://drive.google.com/file/d/1iridqEvh_lgHrkUvgvrwhphqlUoBIP_8/view?usp=sharing" },
  "9": { name: "Chest, Shoulders, and Triceps", videoUrl: "https://drive.google.com/file/d/1sMQMmw1dVP1CFI5WqdogdGa15xJg10vM/view?usp=sharing" },
  "10": { name: "Back and Biceps", videoUrl: "https://drive.google.com/file/d/11aoFEDClPmvjjVb6D0demCy7WSnHlZOf/view?usp=sharing" },
  "11": { name: "Cardio X", videoUrl: "https://drive.google.com/file/d/1bI002fGDXzps7JQAopmK6IPVjHd7ezND/view?usp=sharing" },
  "12": { name: "Ab Ripper X", videoUrl: "https://drive.google.com/file/d/1xykiAfHSoBIPHHiCcPSPfTTUNUF4Lnxv/view?usp=sharing" },
};

/** Converts a Google Drive share/view URL into its embeddable /preview URL. */
export function getEmbedUrl(shareUrl: string): string {
  const fileId = shareUrl.match(/\/d\/([^/]+)/)?.[1];
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : shareUrl;
}
