import { maximumImageBytes, validateImageBytes } from "./image-validation.ts";

const googleDriveHosts = new Set(["drive.google.com", "docs.google.com"]);
const allowedDownloadHosts = new Set(["drive.google.com", "drive.usercontent.google.com"]);
const maximumRedirects = 5;
const maximumConfirmationPageBytes = 256 * 1024;
const confirmationTokenPattern = /^[A-Za-z0-9_-]+$/;

type GoogleDriveFileReference = { fileId: string; resourceKey?: string };

function parseGoogleDriveFileReference(value: string): GoogleDriveFileReference | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !googleDriveHosts.has(url.hostname.toLowerCase())) return null;
  const pathMatch = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  const fileId = pathMatch?.[1] ?? url.searchParams.get("id");
  if (!fileId || !/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return null;
  const resourceKey = url.searchParams.get("resourcekey") ?? undefined;
  if (resourceKey && !/^[A-Za-z0-9_-]{1,256}$/.test(resourceKey)) return null;
  return { fileId, ...(resourceKey ? { resourceKey } : {}) };
}

export function parseGoogleDriveFileId(value: string): string | null {
  return parseGoogleDriveFileReference(value)?.fileId ?? null;
}

function isAllowedDownloadUrl(url: URL) {
  return url.protocol === "https:" && (
    allowedDownloadHosts.has(url.hostname.toLowerCase()) ||
    url.hostname.toLowerCase().endsWith(".googleusercontent.com")
  );
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
  tooLargeMessage: string,
): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) throw new Error(tooLargeMessage);
  if (!response.body) throw new Error("Google Drive returned an empty image response.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error(tooLargeMessage);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, length);
}

function htmlAttribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))
    ?.slice(1)
    .find(Boolean);
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'");
}

function makeDownloadUrl(fileId: string, resourceKey?: string, confirmationToken?: string) {
  const url = new URL("https://drive.google.com/uc");
  url.searchParams.set("export", "download");
  url.searchParams.set("id", fileId);
  if (resourceKey) url.searchParams.set("resourcekey", resourceKey);
  if (confirmationToken) url.searchParams.set("confirm", confirmationToken);
  return url;
}

function confirmationUrlFromHtml(
  html: string,
  fileId: string,
  resourceKey: string | undefined,
  baseUrl: URL,
): URL | null {
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const hrefValue = htmlAttribute(tag, "href");
    if (!hrefValue) continue;
    let href: URL;
    try {
      href = new URL(decodeHtmlAttribute(hrefValue), baseUrl);
    } catch {
      continue;
    }
    if (
      isAllowedDownloadUrl(href) &&
      href.searchParams.get("id") === fileId &&
      href.searchParams.get("confirm") &&
      confirmationTokenPattern.test(href.searchParams.get("confirm") ?? "")
    ) {
      if (resourceKey && !href.searchParams.has("resourcekey")) {
        href.searchParams.set("resourcekey", resourceKey);
      }
      return href;
    }
  }

  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    if (htmlAttribute(tag, "name")?.toLowerCase() !== "confirm") continue;
    const token = htmlAttribute(tag, "value");
    if (!token || !confirmationTokenPattern.test(token)) continue;
    return makeDownloadUrl(fileId, resourceKey, token);
  }
  return null;
}

function confirmationTokenFromCookie(response: Response): string | null {
  const cookieHeader = response.headers.get("set-cookie");
  const match = cookieHeader?.match(/(?:^|,)\s*download_warning_[^=;,\s]+=([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

export async function downloadGoogleDriveImage(
  sourceUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ bytes: Buffer; contentType: string }> {
  const fileReference = parseGoogleDriveFileReference(sourceUrl);
  if (!fileReference) throw new Error("Use a supported public Google Drive file link.");
  const { fileId, resourceKey } = fileReference;
  let url = makeDownloadUrl(fileId, resourceKey);
  const signal = AbortSignal.timeout(20_000);
  let response: Response | undefined;
  let followedConfirmation = false;

  for (let redirectCount = 0; redirectCount <= maximumRedirects; redirectCount += 1) {
    if (!isAllowedDownloadUrl(url)) throw new Error("Google Drive redirected to an unsupported host.");
    response = await fetcher(url, { signal, redirect: "manual", headers: { Accept: "image/*" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Google Drive returned an invalid redirect.");
      url = new URL(location, url);
      response = undefined;
      continue;
    }
    if (!response.ok) throw new Error(`Google Drive download failed with HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (contentType === "text/html" || contentType === "application/xhtml+xml") {
      if (followedConfirmation) {
        throw new Error("Google Drive returned an HTML page instead of the image. Verify the file is publicly accessible.");
      }
      const html = (await readBoundedBody(
        response,
        maximumConfirmationPageBytes,
        "Google Drive confirmation page exceeds the permitted size.",
      )).toString("utf8");
      const token = confirmationTokenFromCookie(response);
      const confirmationUrl = confirmationUrlFromHtml(html, fileId, resourceKey, url);
      if (confirmationUrl) {
        url = confirmationUrl;
      } else if (token) {
        url = makeDownloadUrl(fileId, resourceKey, token);
      } else {
        throw new Error("Google Drive did not return an image. The file may be private or inaccessible; use an Anyone with the link URL.");
      }
      followedConfirmation = true;
      response = undefined;
      continue;
    }
    break;
  }
  if (!response) throw new Error("Google Drive redirected too many times.");
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) throw new Error("Google Drive link did not return an image. Check that sharing is set to Anyone with the link.");
  const bytes = await readBoundedBody(response, maximumImageBytes, "Google Drive image exceeds the 10 MB limit.");
  validateImageBytes(bytes, contentType);
  return { bytes, contentType };
}
