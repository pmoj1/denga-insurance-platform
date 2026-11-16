import { StaffShell } from "@/components/StaffShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
