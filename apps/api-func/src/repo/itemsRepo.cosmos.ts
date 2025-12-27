import { CosmosClient, Container } from "@azure/cosmos";
import { OpsItem } from "./itemsRepo";

function getContainer(): Container {
  const endpoint = process.env["COSMOS_ENDPOINT"];
  const key = process.env["COSMOS_KEY"];
  const dbName = process.env["COSMOS_DB_NAME"];
  const containerName = process.env["COSMOS_ITEMS_NAME"];

  if (!endpoint || !key || !dbName || !containerName) {
    throw new Error("Cosmos env vars missing (COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DB_NAME, COSMOS_ITEMS_NAME)");
  }

  const client = new CosmosClient({ endpoint, key });
  return client.database(dbName).container(containerName);
}

export async function listItemsCosmos(): Promise<OpsItem[]> {
  const container = getContainer();
  const { resources } = await container.items
    .query<OpsItem>("SELECT * FROM c ORDER BY c.createdAt DESC")
    .fetchAll();
  return resources;
}

export async function createItemCosmos(item: OpsItem): Promise<OpsItem> {
  const container = getContainer();
  const { resource } = await container.items.create(item);
  if (!resource) throw new Error("Failed to create item in Cosmos");
  return resource;
}

export async function saveAnalysisCosmos(id: string, analysis: any): Promise<OpsItem | null> {
  const container = getContainer();

  try {
    const { resource: existing } = await container.item(id, id).read<OpsItem>();
    if (!existing) return null;

    const updated: OpsItem = {
      ...existing,
      analysis,
      status: "analyzed",
      updatedAt: new Date().toISOString(),
    };

    const { resource } = await container.item(id, id).replace(updated);
    return resource ?? null;
  } catch {
    return null;
  }
}

export async function saveStatusCosmos(
  id: string,
  body: { status: "pending" | "analyzed" | "failed"; error?: any }
): Promise<OpsItem | null> {
  const container = getContainer();

  try {
    const { resource } = await container.item(id, id).read<OpsItem>();
    if (!resource) return null;

    const now = new Date().toISOString();

    resource.status = body.status;
    resource.updatedAt = now;

    if (body.error !== undefined) {
      (resource as any).error = body.error;
    } else if (body.status !== "failed") {
      // clear previous error when status changes away from failed
      delete (resource as any).error;
    }

    const { resource: replaced } = await container.item(id, id).replace(resource);
    return (replaced ?? null) as OpsItem | null;
  } catch (e: any) {
    if (e?.code === 404) return null;
    throw e;
  }
}