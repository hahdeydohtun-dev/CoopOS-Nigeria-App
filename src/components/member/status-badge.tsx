import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone, type LifecycleStatus } from "@/lib/members";

export function MemberStatusBadge({ status }: { status: LifecycleStatus | null | undefined }) {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  return <Badge variant={statusTone[status]}>{statusLabel[status]}</Badge>;
}
