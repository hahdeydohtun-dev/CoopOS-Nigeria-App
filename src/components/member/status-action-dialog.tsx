import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  allowedTransitions,
  friendlyError,
  statusLabel,
  transitionLabel,
  type LifecycleStatus,
} from "@/lib/members";

export function StatusActions({
  memberId,
  current,
  onDone,
}: {
  memberId: string;
  current: LifecycleStatus;
  onDone?: () => void;
}) {
  const [target, setTarget] = useState<LifecycleStatus | null>(null);
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const queryClient = useQueryClient();

  const change = useMutation({
    mutationFn: async () => {
      if (!target) return;
      if (!reason.trim()) throw new Error("A reason is required for every status change");
      const { error } = await supabase.rpc("change_member_status", {
        _member_id: memberId,
        _new_status: target,
        _reason: reason.trim(),
        _effective_date: effectiveDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(target ? `Member moved to ${statusLabel[target]}.` : "Status updated.");
      setTarget(null);
      setReason("");
      void queryClient.invalidateQueries();
      onDone?.();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const options = allowedTransitions(current);

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No further status changes are possible for this member.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {options.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={status === "ACTIVE" ? "default" : "outline"}
            onClick={() => setTarget(status)}
          >
            {transitionLabel[status] ?? statusLabel[status]}
          </Button>
        ))}
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target ? (transitionLabel[target] ?? statusLabel[target]) : "Change status"}
            </DialogTitle>
            <DialogDescription>
              This change is recorded permanently in the member's history, together with your name
              and the reason you give.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-reason">Reason</Label>
              <Textarea
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Non-payment of monthly thrift contribution"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-date">Effective date</Label>
              <Input
                id="status-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => change.mutate()}
              disabled={change.isPending || !reason.trim()}
            >
              {change.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
