import { StorageGate } from "@/components/StorageBoot";

export default function BodyStorageLayout({ children }: { children: React.ReactNode }) {
  return <StorageGate>{children}</StorageGate>;
}
