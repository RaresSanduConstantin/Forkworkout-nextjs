import { StorageGate } from "@/components/StorageBoot";

export default function NutritionStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}

