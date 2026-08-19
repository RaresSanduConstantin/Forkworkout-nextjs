import { StorageGate } from "@/components/StorageBoot";

export default function StartWorkoutStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}
