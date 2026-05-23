"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps router.push in startTransition so `isPending` becomes true
 * synchronously on click — before the server responds. Use this instead
 * of <Link> when you want to show a skeleton immediately on click.
 */
export function useNavigate() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  return { navigate, isPending };
}
