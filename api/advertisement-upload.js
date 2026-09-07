import { handleUpload } from "@vercel/blob/client";
import { isSameOrigin, isValidCsrf, readSession } from "../lib/auth.js";
import { CONTENT_TYPES, MAXIMUM_SIZE } from "../lib/advertisements.js";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request) {
  const session = readSession(request);
  if (!session || !isSameOrigin(request) || !isValidCsrf(request, session)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const text = await request.text();
    if (text.length > 50000) throw new TypeError("Upload request is too large");
    const body = JSON.parse(text);
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || "{}");
        const match = pathname.match(/^signage\/ads\/screen-([12])\/[a-zA-Z0-9._-]{1,180}$/);
        if (!match || Number(match[1]) !== Number(payload.screen)) {
          throw new TypeError("Invalid advertisement upload path");
        }
        return {
          allowedContentTypes: [...CONTENT_TYPES],
          maximumSizeInBytes: MAXIMUM_SIZE,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return json(response, 200);
  } catch (error) {
    return json({ error: error.message || "Unable to authorize upload" }, 400);
  }
}
