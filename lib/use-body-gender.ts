"use client";

import * as React from "react";

import { getBodyProfile } from "@/lib/storage/profile";

/**
 * The body-map mannequin gender ("male" by default). Read from the saved body
 * profile on mount (client-only to avoid a hydration mismatch) and refreshed
 * when the profile changes via the "fw:profile-changed" event.
 */
export function useMannequinGender(): "male" | "female" {
  const [gender, setGender] = React.useState<"male" | "female">("male");

  React.useEffect(() => {
    const read = () => setGender(getBodyProfile().sex === "female" ? "female" : "male");
    read();
    window.addEventListener("fw:profile-changed", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("fw:profile-changed", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return gender;
}
