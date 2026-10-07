"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { searchByImage, type ImageSearchState } from "@/app/actions/image";
import { COUNTRY_CODES, MARKETS } from "@/lib/markets";
import { useI18n } from "@/i18n/provider";

const MAX_EDGE = 1000;

/** Downscales to ≤1000px JPEG in the browser: keeps uploads small (Lens allows 500 KB) and strips EXIF data. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 480_000) return blob;
    }
  } catch {
    // Fall back to the original file; the server validates type and size.
  }
  return file;
}

export function ImageSearchForm() {
  const [state, action, pending] = useActionState<ImageSearchState, FormData>(searchByImage, {});
  const { t: messages } = useI18n();
  const t = messages.image;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Set the file and its preview URL together, releasing the previous preview.
  const choose = useCallback((next: File | null) => {
    setFile(next);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return next ? URL.createObjectURL(next) : null;
    });
  }, []);

  // Paste an image from the clipboard anywhere on the page, like Google Lens.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const pasted = item?.getAsFile();
      if (pasted) choose(new File([pasted], "pasted-image.png", { type: pasted.type }));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [choose]);

  async function submit(form: FormData) {
    if (!file) return;
    form.set("image", await shrink(file));
    form.set("fileName", file.name);
    startTransition(() => action(form));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(new FormData(e.currentTarget));
      }}
      className="card space-y-4 p-4"
    >
      {state.error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={t.choose}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped?.type.startsWith("image/")) choose(dropped);
        }}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-border hover:border-accent"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={t.selected} className="max-h-56 rounded-lg object-contain" />
        ) : (
          <>
            <span className="text-3xl" aria-hidden>
              📷
            </span>
            <span className="text-sm font-medium">{t.drop}</span>
            <span className="text-xs text-muted">{t.dropHint}</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-end">
        <div>
          <label className="label" htmlFor="country">
            {t.pricesIn}
          </label>
          <select id="country" name="country" defaultValue="US" className="input">
            {COUNTRY_CODES.map((c) => (
              <option key={c} value={c}>
                {MARKETS[c].flag} {messages.countries[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="hint">
            {t.hint}
          </label>
          <input id="hint" name="hint" maxLength={100} className="input" placeholder={t.hintPh} />
        </div>
        <button type="submit" disabled={!file || pending} className="btn-primary">
          {pending ? t.searching : t.search}
        </button>
      </div>
    </form>
  );
}
