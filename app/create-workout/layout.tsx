import { StorageGate } from "@/components/StorageBoot";

export default function CreateWorkoutStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}
