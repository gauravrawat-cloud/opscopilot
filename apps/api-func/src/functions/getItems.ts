import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";

type OpsItem = {
  id: string;
  title: string;
  description: string;
  system?: string;
  env?: string;
  status: "pending" | "analyzed" | "failed";
  analysis?: any;
  createdAt: string;
  updatedAt: string;
};

// NOTE: In-memory store (for MVP local dev). This will reset when host restarts.
const items: OpsItem[] = [];

async function enqueueAnalyzeMessage(itemId: string, context: InvocationContext) {
    context.log("EnqueueAnalyzeMessage started!")
    const conn = process.env["AzureWebJobsStorage"];
    const queueName = process.env["OPS_QUEUE_NAME"] || "ops-items";
  
    if (!conn) throw new Error("AzureWebJobsStorage is missing");
  
    const client = new QueueClient(conn, queueName);
    await client.createIfNotExists();
  
    const payload = { id: itemId, action: "analyze" };
    await client.sendMessage(Buffer.from(JSON.stringify(payload)).toString("base64"));
  }  

function json(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}

app.http("items", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "items",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      };
    }

    if (request.method === "GET") {
      return json(200, { items });
    }

    // POST /api/items
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

      items.unshift(item);
      await enqueueAnalyzeMessage(item.id, context);
      return json(201, { item });
    } catch (err: any) {
      context.error("POST /items failed", err);
      return json(500, { error: "internal error" });
    }
  },
});

app.http("saveAnalysis", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    route: "items/{id}/analysis",
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
      if (request.method === "OPTIONS") {
        return {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST,OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        };
      }
  
      const id = request.params.id;
      if (!id) return json(400, { error: "id is required" });
  
      let body: any;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: "invalid json body" });
      }
  
      const item = items.find((x) => x.id === id);
      if (!item) return json(404, { error: "item not found" });
  
      item.analysis = body;
      item.status = "analyzed";
      item.updatedAt = new Date().toISOString();
  
      context.log(`✅ Analysis saved for item ${id}`);
      return json(200, { item });
    },
  });
  
