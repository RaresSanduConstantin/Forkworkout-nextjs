import { StorageGate } from "@/components/StorageBoot";

export default function AppStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}
