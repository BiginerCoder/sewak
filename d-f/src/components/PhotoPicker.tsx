"use client";

import { Camera, X } from "lucide-react";
import { useId, useState } from "react";

async function resize(file: File, max = 1000): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

export function PhotoPicker({
  value, onChange, error, label = "Photo evidence", hint,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  error?: string;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  async function pick(file?: File) {
    setLocalErr("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalErr("Choose an image file.");
      return;
    }
    setBusy(true);
    try {
      onChange(await resize(file));
    } catch {
      setLocalErr("That image could not be read. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  const err = error || localErr;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="photo-drop">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Selected evidence preview" />
        ) : (
          <Camera size={22} className="muted" aria-hidden />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            id={id}
            type="file"
            accept="image/*"
            onChange={(e) => pick(e.target.files?.[0])}
            aria-describedby={`${id}-h`}
            aria-invalid={!!err}
            style={{ maxWidth: "100%", fontSize: 13.5 }}
          />
          <div id={`${id}-h`} className="hint">
            {busy ? "Preparing image…" : hint ?? "Optional. Images are resized in your browser before saving."}
          </div>
        </div>
        {value && (
          <button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => onChange(null)}>
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
      {err && <div className="error" role="alert">{err}</div>}
    </div>
  );
}
