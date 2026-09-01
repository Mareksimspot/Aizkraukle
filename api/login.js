import {
  createSession,
  csrfToken,
  isSameOrigin,
  sessionCookie,
  verifyPassword,
} from "../lib/auth.js";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return new Response(JSON.stringify({ error: "Invalid request origin" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  let credentials;
  try {
    const body = await request.text();
    if (body.length > 4096) throw new Error("Request is too large");
    credentials = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const username = typeof credentials.username === "string" ? credentials.username : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  let valid = false;
  try {
    const passwordMatches = password.length <= 256 && verifyPassword(password);
    valid =
      username.length <= 100 &&
      username === process.env.ADMIN_USERNAME &&
      passwordMatches;
  } catch (error) {
    console.error("Admin authentication is not configured", error);
    return new Response(JSON.stringify({ error: "Authentication is not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  if (!valid) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return new Response(JSON.stringify({ error: "Incorrect username or password" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const token = createSession(username);
  return new Response(JSON.stringify({ authenticated: true, csrfToken: csrfToken(token) }), {
    status: 200,
    headers: { ...jsonHeaders, "Set-Cookie": sessionCookie(token, request) },
  });
}
