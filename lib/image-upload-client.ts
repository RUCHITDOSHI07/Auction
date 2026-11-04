"use client";

export function uploadImageFile(
  endpoint: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<{ [key: string]: unknown; warning?: string }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    request.onerror = () => reject(new Error("Network error while uploading the image."));
    request.onabort = () => reject(new Error("Image upload was cancelled."));
    request.onload = () => {
      const body = request.response as { error?: string; warning?: string } | null;
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(body?.error ?? "Unable to upload the image."));
        return;
      }
      onProgress(100);
      resolve(body ?? {});
    };
    const body = new FormData();
    body.append("file", file);
    request.send(body);
  });
}
