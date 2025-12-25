import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { json, corsPreflight, requireApiKey, rateLimit } from "../shared/http";
import { saveAnalysis as saveAnalysisMem } from "../repo/itemsRepo";
import { saveAnalysisCosmos } from "../repo/itemsRepo.cosmos";

const useCosmos = (process.env["USE_COSMOS"] || "").toLowerCase() === "true";

app.http("itemsAnalysisPost", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "items/{id}/analysis",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (request.method === "OPTIONS") return corsPreflight("POST,OPTIONS");

    const authError = requireApiKey(request);
    if (authError) return authError;

    // allow analyzer to post more frequently
    const rl = rateLimit(request, { limit: 120, windowMs: 60_000 });
    if (rl) return rl;

    const id = request.params.id;
    if (!id) return json(400, { error: "id is required" });

    const body = await request.json();

    const updated = useCosmos ? await saveAnalysisCosmos(id, body) : saveAnalysisMem(id, body);
    if (!updated) return json(404, { error: "item not found" });

    context.log(`Analysis saved for item ${id} (cosmos=${useCosmos})`);
    return json(200, { item: updated });
  },
});
