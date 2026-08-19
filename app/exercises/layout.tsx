import { StorageGate } from "@/components/StorageBoot";

export default function ExercisesStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}
