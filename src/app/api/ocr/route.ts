import { handleOcr } from "@/server/ai/handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleOcr(request);
}
