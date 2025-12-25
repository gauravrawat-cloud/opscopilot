import { QueueClient } from "@azure/storage-queue";
import { InvocationContext } from "@azure/functions";
import { OpsItem } from "../repo/itemsRepo";

export async function enqueueAnalyzeMessage(item: OpsItem, context: InvocationContext) {
  const conn = process.env["AzureWebJobsStorage"];
  const queueName = process.env["OPS_QUEUE_NAME"] || "ops-items";
  if (!conn) throw new Error("AzureWebJobsStorage is missing");

  const client = new QueueClient(conn, queueName);
  await client.createIfNotExists();

  const payload = {
    id: item.id,
    title: item.title,
    description: item.description,
    system: item.system,
    env: item.env,
    action: "analyze",
  };

  await client.sendMessage(Buffer.from(JSON.stringify(payload)).toString("base64"));
  context.log(`Enqueued analyze message for ${item.id}`);
}
