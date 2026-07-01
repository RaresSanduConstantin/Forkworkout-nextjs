
import { cn } from "@/lib/utils"

// Renders brand headings in the modern display font (Outfit, loaded in the root
// layout as --font-display) with a clean pink→orange→yellow gradient.
export function honkFont(text: string) {
    return (<span className={cn('font-display font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent')}>{text}</span>)
  }