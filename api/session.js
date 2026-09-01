import {
  csrfToken,
  expiredSessionCookie,
  isSameOrigin,
  isValidCsrf,
  readSession,
} from "../lib/auth.js";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

export function GET(request) {
  const session = readSession(request);
  if (!session) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: jsonHeaders,
    });
  }
  return new Response(
    JSON.stringify({ authenticated: true, username: session.username, csrfToken: csrfToken(session.token) }),
    { status: 200, headers: jsonHeaders },
  );
}

export function DELETE(request) {
  const session = readSession(request);
  if (!session || !isSameOrigin(request) || !isValidCsrf(request, session)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: { ...jsonHeaders, "Set-Cookie": expiredSessionCookie(request) },
  });
}
