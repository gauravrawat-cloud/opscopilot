import { QueueClient } from "@azure/storage-queue";

const conn = "UseDevelopmentStorage=true";
const queueName = "ops-items";

const client = new QueueClient(conn, queueName);
await client.createIfNotExists();

const payload = { id: "demo-1", action: "analyze" };
await client.sendMessage(Buffer.from(JSON.stringify(payload)).toString("base64"));

console.log("✅ Sent message to queue:", payload);
