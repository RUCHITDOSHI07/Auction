"use client";

import { useEffect, useRef, useState } from "react";
import { optimizedImageUrl, type ImageTransformOptions } from "@/lib/storage/image-url";

type ImageFilePickerProps = {
  label: string;
  currentUrl?: string;
  fallback: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  imageCrop?: ImageTransformOptions["crop"];
  trimTransparentPadding?: boolean;
  disabled?: boolean;
};

export default function ImageFilePicker({
  label,
  currentUrl,
  fallback,
  file,
  onFileChange,
  imageCrop,
  trimTransparentPadding = false,
  disabled = false,
}: ImageFilePickerProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | undefined>(undefined);
  const localPreviewRef = useRef<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
  }, []);

  function setLocalPreview(file: File | null) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    const previewUrl = file ? URL.createObjectURL(file) : undefined;
    localPreviewRef.current = previewUrl;
    setLocalPreviewUrl(previewUrl);
  }

  const previewUrl = file ? localPreviewUrl : currentUrl;

  return (
    <div className="image-file-picker">
      <div className="image-file-preview">
        {previewUrl
          ? <img src={optimizedImageUrl(previewUrl, { width: 240, height: 240, crop: imageCrop, trim: trimTransparentPadding }) ?? previewUrl} alt={`${label} preview`} />
          : <span aria-hidden="true">{fallback}</span>}
      </div>
      <div className="image-file-actions">
        <label>{label}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={disabled} onChange={(event) => {
          const selectedFile = event.target.files?.[0] ?? null;
          if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
            setFileError("Choose an image that is 10 MB or smaller.");
            setLocalPreview(null);
            onFileChange(null);
            event.target.value = "";
            return;
          }
          setFileError(null);
          setLocalPreview(selectedFile);
          onFileChange(selectedFile);
        }} /></label>
        <small>JPEG, PNG, WebP, GIF or AVIF · 10 MB maximum</small>
        {fileError && <small className="image-file-error" role="alert">{fileError}</small>}
        {file && <button className="button button-outline" type="button" disabled={disabled} onClick={() => { setLocalPreview(null); onFileChange(null); }}>Discard selected image</button>}
      </div>
    </div>
  );
}
