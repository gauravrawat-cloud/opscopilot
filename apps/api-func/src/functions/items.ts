// src/functions/items.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsPreflight, json } from "../shared/http";
import { handleItemsGet } from "./items.get";
import { handleItemsPost } from "./items.post";

app.http("items", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "items",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (request.method === "OPTIONS") {
      return corsPreflight("GET,POST,OPTIONS");
    }

    if (request.method === "GET") return await handleItemsGet(request, context);
    if (request.method === "POST") return await handleItemsPost(request, context);

    return json(405, { error: "Method not allowed" });
  },
});
