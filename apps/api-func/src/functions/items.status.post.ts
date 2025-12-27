import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsPreflight, json, requireApiKey } from "../shared/http";
import { saveStatus as saveStatusMem } from "../repo/itemsRepo";
import { saveStatusCosmos } from "../repo/itemsRepo.cosmos";

const useCosmos = (process.env["USE_COSMOS"] || "").toLowerCase() === "true";

app.http("itemsStatusPost", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "items/{id}/status",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (request.method === "OPTIONS") {
      return corsPreflight("POST,OPTIONS");
    }

    const authError = requireApiKey(request);
    if (authError) return authError;

    const id = request.params.id;
    if (!id) return json(400, { error: "id is required" });

    const body = (await request.json()) as { status?: string; error?: any };
    const status = body.status;

    if (!["pending", "analyzed", "failed"].includes(status || "")) {
        return json(400, { error: "status must be pending|analyzed|failed" });
    }

    const payload: { status: "pending" | "analyzed" | "failed"; error?: any } = {
        status: status as "pending" | "analyzed" | "failed",
        error: body.error,
    };

    const updated = useCosmos
      ? await saveStatusCosmos(id, payload)
      : saveStatusMem(id, payload);

    if (!updated) return json(404, { error: "item not found" });

    context.log(`Status updated for ${id} => ${status} (cosmos=${useCosmos})`);
    return json(200, { item: updated });
  },
});
