import { getPhoto } from "@/lib/store";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const k = new URL(req.url).searchParams.get("k");
  const data = await getPhoto(id, k === "after" ? "afterPhoto" : "photo");
  const m = data ? /^data:([^;]+);base64,(.+)$/.exec(data) : null;
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=86400, immutable" },
  });
}
