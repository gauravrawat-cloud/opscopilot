import { CosmosClient, Container } from "@azure/cosmos";
import { OpsItem } from "./itemsRepo";

function getContainer(): Container {
  const endpoint = process.env["COSMOS_ENDPOINT"];
  const key = process.env["COSMOS_KEY"];
  const dbName = process.env["COSMOS_DB_NAME"];
  const containerName = process.env["COSMOS_CONTAINER_NAME"];

  if (!endpoint || !key || !dbName || !containerName) {
    throw new Error("Cosmos env vars missing (COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DB_NAME, COSMOS_CONTAINER_NAME)");
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