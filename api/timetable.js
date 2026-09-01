import { isSameOrigin, isValidCsrf, readSession } from "../lib/auth.js";
import { readTimetable, validateTimetable, writeTimetable } from "../lib/timetable.js";

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export async function GET(request) {
  try {
    const timetable = await readTimetable();
    const adminRequest = new URL(request.url).searchParams.get("admin") === "1";
    return json(timetable.records, 200, {
      "Cache-Control": adminRequest
        ? "private, no-store"
        : "public, max-age=0, s-maxage=600, stale-while-revalidate=60",
      ETag: `"${timetable.version}"`,
      "X-Timetable-Version": timetable.version,
    });
  } catch (error) {
    console.error("Unable to read timetable", error);
    return json({ error: "Unable to read timetable" }, 503, { "Cache-Control": "no-store" });
  }
}

export async function PUT(request) {
  const session = readSession(request);
  if (!session || !isSameOrigin(request) || !isValidCsrf(request, session)) {
    return json({ error: "Unauthorized" }, 401, { "Cache-Control": "no-store" });
  }

  let records;
  try {
    const body = await request.text();
    if (body.length > 200000) throw new TypeError("Timetable is too large");
    records = validateTimetable(JSON.parse(body));
  } catch (error) {
    return json({ error: error.message || "Invalid timetable" }, 400, { "Cache-Control": "no-store" });
  }

  try {
    const result = await writeTimetable(records, request.headers.get("if-match"));
    if (result.conflict) {
      return json(
        { error: "Timetable changed since it was opened. Reload and try again." },
        409,
        { "Cache-Control": "no-store" },
      );
    }
    return json(
      { saved: true, version: result.version },
      200,
      { "Cache-Control": "no-store", "X-Timetable-Version": result.version },
    );
  } catch (error) {
    console.error("Unable to save timetable", error);
    return json({ error: "Unable to save timetable" }, 503, { "Cache-Control": "no-store" });
  }
}
