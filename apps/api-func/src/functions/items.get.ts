// src/functions/items.get.ts
import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { json, requireApiKey, rateLimit } from "../shared/http";
import { listItems as listItemsMem } from "../repo/itemsRepo";
import { listItemsCosmos } from "../repo/itemsRepo.cosmos";

const useCosmos = (process.env["USE_COSMOS"] || "").toLowerCase() === "true";

export async function handleItemsGet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const rl = rateLimit(request, { limit: 120, windowMs: 60_000 });
  if (rl) return rl;

  const items = useCosmos ? await listItemsCosmos() : listItemsMem();
  return json(200, { items });
}
