import { StorageGate } from "@/components/StorageBoot";

export default function HistoryStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}
