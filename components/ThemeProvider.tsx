"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/** App-wide theme provider (light / dark / system) backed by next-themes. */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
