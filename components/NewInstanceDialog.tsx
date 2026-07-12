"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  defaultInstanceName,
  type MarketplaceIntegration,
} from "@/lib/marketplace";
import { createInstanceForIntegration, prismaticKeys } from "@/lib/prismatic";

/**
 * The "Add Integration" dialog: asks for an instance name (pre-filled with a
 * sensible default), creates the instance, and routes to its config wizard.
 * Dependency-free modal — overlay + panel, Escape/backdrop to close.
 */
export function NewInstanceDialog({
  integration,
  existingCount,
  onClose,
}: {
  integration: MarketplaceIntegration;
  existingCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(() =>
    defaultInstanceName(integration, existingCount),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const createMutation = useMutation({
    mutationFn: () => createInstanceForIntegration(integration, name),
    onSuccess: async (instanceId) => {
      await queryClient.invalidateQueries({
        queryKey: prismaticKeys.instances(),
      });
      await queryClient.invalidateQueries({
        queryKey: prismaticKeys.marketplace(),
      });
      router.push(`/integrations/configure/${encodeURIComponent(instanceId)}`);
    },
  });
  const busy = createMutation.isPending || createMutation.isSuccess;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${integration.name} integration`}
        className="w-full max-w-sm rounded-xl border border-black/10 bg-background p-5 shadow-2xl dark:border-white/15"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-semibold">Add {integration.name}</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Name this integration so you can tell your instances apart.
        </p>

        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && name.trim()) createMutation.mutate();
          }}
        >
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            aria-label="Instance name"
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-50 dark:border-white/20 dark:focus:border-white/50"
          />

          {createMutation.error && (
            <p className="text-xs text-red-700 dark:text-red-400">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : String(createMutation.error)}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md px-3 py-2 text-sm text-black/60 hover:text-black disabled:opacity-50 dark:text-white/60 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
