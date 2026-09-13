"use client";

import { useEffect, useState } from "react";

type ToastKind = "success" | "info" | "warning" | "error";
interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  sticky?: boolean;
}

const listeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

function emit() {
  for (const l of listeners) l([...toasts]);
}

export function pushToast(t: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  const toast = { id, ...t };
  toasts.push(toast);
  emit();
  if (!t.sticky && t.kind !== "error") {
    setTimeout(() => dismissToast(id), 4000);
  }
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToast() {
  return { push: pushToast, dismiss: dismissToast };
}

export function useToastList(): Toast[] {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}

export type { Toast, ToastKind };
