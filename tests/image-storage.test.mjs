import assert from "node:assert/strict";
import test from "node:test";
import { downloadGoogleDriveImage, parseGoogleDriveFileId } from "../lib/storage/google-drive.ts";
import { cloudinaryPublicIdFromUrl, isManagedCloudinaryPublicId, optimizedImageUrl } from "../lib/storage/image-url.ts";
import { validateImageBytes } from "../lib/storage/image-validation.ts";
import { createCloudinaryImageService, createUniqueImagePublicId } from "../lib/storage/cloudinary-core.ts";
import { replacePersistedImage } from "../lib/storage/image-persistence.ts";
import { excludeAuctionStateFromPlayerImport, findPlayerIdentityMatch, playerImportIdentity } from "../lib/players/import-identity.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test("validates image signatures, MIME types, and size", () => {
  assert.equal(validateImageBytes(png, "image/png"), "png");
  assert.throws(() => validateImageBytes(png, "image/jpeg"), /does not match/);
  assert.throws(() => validateImageBytes(new Uint8Array([1, 2, 3])), /not a supported image/);
  assert.throws(() => validateImageBytes(png, "image/png", 4), /maximum permitted size/);
});

test("parses supported public Google Drive file links and rejects other hosts", () => {
  const supportedLinks = [
    "https://drive.google.com/file/d/abcdefghijklmnop/view?usp=sharing",
    "https://drive.google.com/file/d/abcdefghijklmnop/view?usp=drive_link",
    "https://drive.google.com/open?id=abcdefghijklmnop",
    "https://drive.google.com/uc?export=download&id=abcdefghijklmnop",
    "https://drive.google.com/thumbnail?id=abcdefghijklmnop",
    "https://drive.google.com/open?id=abcdefghijklmnop&resourcekey=0-abc_123",
    "https://docs.google.com/uc?id=abcdefghijklmnop",
  ];
  for (const link of supportedLinks) {
    assert.equal(parseGoogleDriveFileId(link), "abcdefghijklmnop");
  }
  assert.equal(parseGoogleDriveFileId("https://example.com/file/d/abcdefghijklmnop"), null);
  assert.equal(parseGoogleDriveFileId("http://drive.google.com/file/d/abcdefghijklmnop"), null);
  assert.equal(parseGoogleDriveFileId("https://drive.google.com/file/d/short/view"), null);
});

test("downloads bounded image content and rejects non-image Drive responses", async () => {
  const imageFetcher = async () => new Response(png, { headers: { "content-type": "image/png" } });
  const result = await downloadGoogleDriveImage(
    "https://drive.google.com/file/d/abcdefghijklmnop/view",
    imageFetcher,
  );
  assert.deepEqual(result.bytes, Buffer.from(png));
  assert.equal(result.contentType, "image/png");

  const htmlFetcher = async () => new Response("<html>sign in</html>", { headers: { "content-type": "text/html" } });
  await assert.rejects(
    downloadGoogleDriveImage("https://drive.google.com/file/d/abcdefghijklmnop/view", htmlFetcher),
    /did not return an image/,
  );

  const redirectHosts = [];
  const redirectFetcher = async (input) => {
    redirectHosts.push(new URL(input).hostname);
    if (redirectHosts.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://drive.usercontent.google.com/download?id=abcdefghijklmnop" },
      });
    }
    return new Response(png, { headers: { "content-type": "image/png" } });
  };
  await downloadGoogleDriveImage(
    "https://drive.google.com/file/d/abcdefghijklmnop/view",
    redirectFetcher,
  );
  assert.deepEqual(redirectHosts, ["drive.google.com", "drive.usercontent.google.com"]);
  await assert.rejects(
    downloadGoogleDriveImage(
      "https://drive.google.com/file/d/abcdefghijklmnop/view",
      async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    ),
    /unsupported host/,
  );

  await assert.rejects(
    downloadGoogleDriveImage(
      "https://drive.google.com/open?id=abcdefghijklmnop",
      async () => new Response("<html>Sign in to continue</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ),
    /private or inaccessible/,
  );
  await assert.rejects(
    downloadGoogleDriveImage(
      "https://drive.google.com/open?id=abcdefghijklmnop",
      async () => new Response("Permission denied", { status: 403 }),
    ),
    /HTTP 403/,
  );
});

test("follows a Google Drive confirmation page but never treats HTML as the image", async () => {
  const requests = [];
  const result = await downloadGoogleDriveImage(
    "https://drive.google.com/file/d/abcdefghijklmnop/view?resourcekey=0-abc_123",
    async (input) => {
      const url = new URL(input);
      requests.push(url);
      if (requests.length === 1) {
        return new Response(
          '<html><a href="/uc?export=download&amp;id=abcdefghijklmnop&amp;confirm=t">Download</a></html>',
          { headers: { "content-type": "text/html" } },
        );
      }
      return new Response(png, { headers: { "content-type": "image/png" } });
    },
  );
  assert.equal(result.contentType, "image/png");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get("confirm"), "t");
  assert.equal(requests[0].searchParams.get("resourcekey"), "0-abc_123");
  assert.equal(requests[1].searchParams.get("resourcekey"), "0-abc_123");

  await assert.rejects(
    downloadGoogleDriveImage(
      "https://drive.google.com/file/d/abcdefghijklmnop/view",
      async () => new Response("<html><body>not an image</body></html>", {
        headers: { "content-type": "image/png" },
      }),
    ),
    /supported image/,
  );
});

test("transforms Cloudinary URLs while preserving legacy external image URLs", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v123/pnpl/players/P001.jpg";
  assert.match(optimizedImageUrl(url, { width: 640, height: 640 }), /f_auto,q_auto:good,w_640,h_640,c_fill,g_auto/);
  const logoUrl = optimizedImageUrl(url, { width: 256, height: 256, crop: "fit" });
  assert.match(logoUrl, /w_256,h_256,c_fit/);
  assert.doesNotMatch(logoUrl, /g_auto/);
  const trimmedLogoUrl = optimizedImageUrl(url, { width: 256, height: 256, crop: "fit", trim: true });
  assert.match(trimmedLogoUrl, /e_trim,f_auto,q_auto:good,w_256,h_256,c_fit/);
  assert.equal(cloudinaryPublicIdFromUrl(url), "pnpl/players/P001");
  assert.equal(cloudinaryPublicIdFromUrl(url, "another-cloud"), undefined);
  assert.equal(isManagedCloudinaryPublicId("pnpl/players/P001"), true);
  assert.equal(isManagedCloudinaryPublicId("other/P001"), false);
  assert.equal(isManagedCloudinaryPublicId("pnpl/players/P002", "pnpl/players/P001"), false);
  assert.equal(optimizedImageUrl("https://legacy.example/player.jpg", { width: 320 }), "https://legacy.example/player.jpg");
});

test("preserves permanent Player IDs while matching imports and avoids ambiguous matches", () => {
  const players = [
    { id: "P047", name: "Ruchi Doshi", phoneNumber: "+91 98765 43210", gender: "female" },
    { id: "P048", name: "Ruchi Doshi", phoneNumber: "+91 98765 43211", gender: "female" },
  ];
  assert.equal(findPlayerIdentityMatch({ name: "Ruchi  Doshi", phoneNumber: "+91 98765 43210", gender: "female" }, players).player.id, "P047");
  assert.equal(findPlayerIdentityMatch({ name: "Ruchi Doshi", gender: "female" }, players).ambiguous, true);
  assert.equal(findPlayerIdentityMatch({ name: "Ruchi Doshi", phoneNumber: "9876543210", gender: "male" }, players).player, undefined);
  assert.equal(playerImportIdentity("Ruchi Doshi", "9876543210", "male") === playerImportIdentity("Ruchi Doshi", "9876543210", "female"), false);
  const existingPlayer = {
    id: "P047",
    name: "Ruchi Doshi",
    status: "sold",
    isSold: true,
    soldTo: "team-1",
    teamId: "team-1",
    soldPrice: 1000,
    soldRound: 2,
  };
  const reimportedPlayer = {
    ...existingPlayer,
    ...excludeAuctionStateFromPlayerImport({
      name: "Updated spelling",
      status: "available",
      isSold: false,
      soldTo: undefined,
      teamId: undefined,
      soldPrice: undefined,
      soldRound: undefined,
    }),
  };
  assert.deepEqual(reimportedPlayer, {
    id: "P047",
    name: "Updated spelling",
    status: "sold",
    isSold: true,
    soldTo: "team-1",
    teamId: "team-1",
    soldPrice: 1000,
    soldRound: 2,
  });
  assert.deepEqual(excludeAuctionStateFromPlayerImport({
    name: "Ruchi Doshi",
    status: "available",
    isSold: false,
    soldTo: "team-1",
    soldPrice: 1000,
  }), { name: "Ruchi Doshi" });
});

test("uploads, replaces, and deletes only validated images with unique PNPL IDs", async () => {
  const requests = [];
  const service = createCloudinaryImageService({
    uploader: {
      async upload(source, options) {
        requests.push({ operation: "upload", source, options });
        return { secure_url: "https://res.cloudinary.com/demo/image/upload/pnpl/players/P047.jpg", public_id: options.public_id };
      },
      async destroy(publicId, options) {
        requests.push({ operation: "delete", publicId, options });
        return { result: "ok" };
      },
    },
  });
  const publicId = createUniqueImagePublicId("pnpl/players/P047");
  assert.match(publicId, /^pnpl\/players\/P047-[0-9a-f-]{36}$/);
  assert.notEqual(publicId, createUniqueImagePublicId("pnpl/players/P047"));
  const uploaded = await service.uploadImage(png, publicId, "image/png");
  assert.equal(uploaded.cloudinaryPublicId, publicId);
  assert.equal(requests[0].options.overwrite, false);
  await service.deleteImage(uploaded.cloudinaryPublicId);
  assert.equal(requests[1].publicId, publicId);
  await assert.rejects(service.uploadImage(png, "other/P047", "image/png"), /PNPL/);
  await assert.rejects(service.uploadImage(new Uint8Array([0]), "pnpl/players/P047", "image/png"), /supported image/);
});

test("persists the new image before cleaning up the previous asset", async () => {
  const operations = [];
  const result = await replacePersistedImage({
    previousPublicId: "pnpl/players/P046",
    upload: async () => {
      operations.push("upload");
      return { photoUrl: "https://res.cloudinary.com/demo/new.jpg", cloudinaryPublicId: "pnpl/players/P047" };
    },
    persist: async (image) => {
      operations.push("persist");
      return image.photoUrl;
    },
    deleteImage: async () => operations.push("delete"),
  });
  assert.deepEqual(operations, ["upload", "persist", "delete"]);
  assert.equal(result.saved, "https://res.cloudinary.com/demo/new.jpg");
  assert.equal(result.cleanupWarning, undefined);
});

test("cleans up a new image after a failed database save", async () => {
  const deleted = [];
  const existingReference = {
    photoUrl: "https://res.cloudinary.com/demo/old.jpg",
    cloudinaryPublicId: "pnpl/players/P047-old",
  };
  const persistedReference = existingReference;
  const operations = [];
  await assert.rejects(replacePersistedImage({
    previousPublicId: existingReference.cloudinaryPublicId,
    upload: async () => {
      operations.push("upload");
      return { photoUrl: "https://res.cloudinary.com/demo/new.jpg", cloudinaryPublicId: "pnpl/players/P047-new" };
    },
    persist: async () => {
      operations.push("persist");
      throw new Error("database unavailable");
    },
    deleteImage: async (publicId) => {
      operations.push("delete-new");
      deleted.push(publicId);
    },
  }), /database unavailable/);
  assert.deepEqual(operations, ["upload", "persist", "delete-new"]);
  assert.deepEqual(deleted, ["pnpl/players/P047-new"]);
  assert.equal(persistedReference, existingReference);
  assert.equal(existingReference.cloudinaryPublicId, "pnpl/players/P047-old");
});
