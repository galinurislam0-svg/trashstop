import { AuthError, requireRole } from "@/lib/auth";
import { getFamilyPhoto } from "@/lib/store";
import { withCity } from "@/lib/city-server";

// Баланың тапсырма фотосы — тек өз ата-анасына
async function GET_(req: Request) {
  let me;
  try {
    me = requireRole(req, ["citizen", "akimat"]);
  } catch (e) {
    return new Response((e as AuthError).message, { status: (e as AuthError).status });
  }
  const sp = new URL(req.url).searchParams;
  const data = await getFamilyPhoto(me.uid, String(sp.get("task")), sp.get("k") === "after" ? "afterPhoto" : "beforePhoto");
  const m = data ? /^data:([^;]+);base64,(.+)$/.exec(data) : null;
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=3600" } });
}

export const GET = withCity(GET_);
