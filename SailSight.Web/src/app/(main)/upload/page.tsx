"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload as UploadIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/controls";
import { cn } from "@/lib/cn";

const MAX_BYTES = 100 * 1024 * 1024;

export default function UploadPage() {
  const router = useRouter();
  const toast = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".vkx")) {
      toast.push({ kind: "error", message: "Only .vkx files are accepted." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.push({ kind: "error", message: "File exceeds 100 MB limit." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/sessions", { method: "POST", body: fd });
      if (res.status === 201 || res.ok) {
        const data = await res.json().catch(() => null);
        const id = data?.id ?? data?.Id;
        toast.push({ kind: "success", message: "Session uploaded." });
        if (id != null) router.push(`/sessions/${id}`);
        else router.push("/sessions");
        return;
      }
      if (res.status === 400) toast.push({ kind: "error", message: "File appears corrupt or invalid." });
      else if (res.status === 409) toast.push({ kind: "warning", message: "Session already uploaded (duplicate)." });
      else toast.push({ kind: "error", message: `Upload failed (${res.status}).` });
    } catch {
      toast.push({ kind: "error", message: "Upload failed. Please retry." });
    } finally {
      setUploading(false);
    }
  }, [toast, router]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Upload session</h1>
      <Card className="p-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition",
            dragOver ? "border-action-primary bg-action-primary/5" : "border-border-default hover:border-action-primary/60"
          )}
        >
          {uploading ? (
            <Loader2 className="h-12 w-12 animate-spin text-action-primary" />
          ) : (
            <UploadIcon className="h-12 w-12 text-action-primary" />
          )}
          <p className="mt-4 text-text-primary">
            {uploading ? "Uploading…" : "Drag & drop a .vkx file here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-text-secondary">Maximum 100 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept=".vkx"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </Card>
    </div>
  );
}
