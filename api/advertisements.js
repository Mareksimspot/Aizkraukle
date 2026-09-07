import { isSameOrigin, isValidCsrf, readSession } from "../lib/auth.js";
import {
  readAdvertisements,
  removeUnusedMedia,
  validateAdvertisements,
  writeAdvertisements,
} from "../lib/advertisements.js";

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export async function GET(request) {
  try {
    const advertisements = await readAdvertisements();
    const adminRequest = new URL(request.url).searchParams.get("admin") === "1";
    return json(advertisements.config, 200, {
      "Cache-Control": adminRequest
        ? "private, no-store"
        : "public, max-age=0, s-maxage=600, stale-while-revalidate=60",
      ETag: `"${advertisements.version}"`,
      "X-Advertisements-Version": advertisements.version,
    });
  } catch (error) {
    console.error("Unable to read advertisements", error);
    return json({ error: "Unable to read advertisements" }, 503, { "Cache-Control": "no-store" });
  }
}

export async function PUT(request) {
  const session = readSession(request);
  if (!session || !isSameOrigin(request) || !isValidCsrf(request, session)) {
    return json({ error: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  }

  let config;
  try {
    const body = await request.text();
    if (body.length > 10000) throw new TypeError("Advertisement configuration is too large");
    config = validateAdvertisements(JSON.parse(body));
  } catch (error) {
    return json({ error: error.message || "Invalid advertisement configuration" }, 400, {
      "Cache-Control": "no-store",
    });
  }

  try {
    const result = await writeAdvertisements(config, request.headers.get("if-match"));
    if (result.conflict) {
      return json(
        { error: "Advertisements changed since they were opened. Reload and try again." },
        409,
        { "Cache-Control": "no-store" },
      );
    }
    try {
      await removeUnusedMedia(result.previous, config);
    } catch (error) {
      console.error("Unable to remove replaced advertisement media", error);
    }
    return json(
      { saved: true, version: result.version },
      200,
      { "Cache-Control": "no-store", "X-Advertisements-Version": result.version },
    );
  } catch (error) {
    console.error("Unable to save advertisements", error);
    return json({ error: "Unable to save advertisements" }, 503, { "Cache-Control": "no-store" });
  }
}
