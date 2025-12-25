// src/functions/items.post.ts
import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import crypto from "crypto";
import { json, requireApiKey, rateLimit } from "../shared/http";
import { OpsItem, createItem as createItemMem } from "../repo/itemsRepo";
import { createItemCosmos } from "../repo/itemsRepo.cosmos";
import { enqueueAnalyzeMessage } from "../infra/queue";

const useCosmos = (process.env["USE_COSMOS"] || "").toLowerCase() === "true";

export async function handleItemsPost(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const rl = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (rl) return rl;

  try {
    const body = (await request.json()) as Partial<OpsItem>;
    if (!body.title || !body.description) {
      return json(400, { error: "title and description are required" });
    }

    const now = new Date().toISOString();
    const item: OpsItem = {
      id: crypto.randomUUID(),
      title: body.title,
      description: body.description,
      system: body.system,
      env: body.env,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const created = useCosmos ? await createItemCosmos(item) : createItemMem(item);
    await enqueueAnalyzeMessage(created, context);

    return json(201, { item: created });
  } catch (err: any) {
    context.error("POST /items failed", err);
    return json(500, { error: "internal error" });
  }
}
