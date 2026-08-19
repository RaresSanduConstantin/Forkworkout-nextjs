import { StorageGate } from "@/components/StorageBoot";

export default function SharedWorkoutStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}
