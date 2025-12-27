import { an } from "vitest/dist/reporters-w_64AS5f";

export type OpsItem = {
  id: string;
  title: string;
  description: string;
  system?: string;
  env?: string;
  status: "pending" | "analyzed" | "failed";
  analysis?: any;
  createdAt: string;
  updatedAt: string;
  error?: any;
};

const items: OpsItem[] = [];

export function listItems(): OpsItem[] {
  return items;
}

export function createItem(input: Omit<OpsItem, "id" | "status" | "createdAt" | "updatedAt"> & { id: string }): OpsItem {
  const now = new Date().toISOString();
  const item: OpsItem = {
    id: input.id,
    title: input.title,
    description: input.description,
    system: input.system,
    env: input.env,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  items.unshift(item);
  return item;
}

export function saveAnalysis(id: string, analysis: any): OpsItem | null {
  const item = items.find((x) => x.id === id);
  if (!item) return null;

  item.analysis = analysis;
  item.status = "analyzed";
  item.updatedAt = new Date().toISOString();
  return item;
}

export function saveStatus(
  id: string,
  body: { status: "pending" | "analyzed" | "failed"; error?: any }
): OpsItem | null {
  const item = items.find((x) => x.id === id);
  if (!item) return null;

  item.status = body.status;
  item.updatedAt = new Date().toISOString();

  if (body.error !== undefined) {
    item.error = body.error;
  } else if (body.status !== "failed") {
    delete item.error;
  }

  return item;
}



// test-only helper
export function __resetItemsForTests() {
  items.length = 0;
}