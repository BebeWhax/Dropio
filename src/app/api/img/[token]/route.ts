import { db } from "@/lib/db";

const MAX_AGE_DAYS = 30;

/**
 * Serves an uploaded product photo by its unguessable token. It is public on
 * purpose: CJ and Google fetch the image from here.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/img/[token]">) {
  const { token } = await params;
  const search = await db.imageSearch.findUnique({
    where: { publicToken: token },
    select: { imageData: true, imageMime: true, createdAt: true },
  });
  if (!search || Date.now() - search.createdAt.getTime() > MAX_AGE_DAYS * 24 * 3600 * 1000) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(search.imageData), {
    headers: {
      "Content-Type": search.imageMime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
