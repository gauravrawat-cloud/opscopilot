import { describe, it, expect, beforeEach } from "vitest";
import {
  listItems,
  createItem,
  saveAnalysis,
  __resetItemsForTests,
} from "../src/repo/itemsRepo";

describe("itemsRepo (in-memory)", () => {
  beforeEach(() => {
    __resetItemsForTests();
  });

  it("createItem() adds item and listItems() returns it", () => {
    const item = createItem({
      id: "1",
      title: "Test item",
      description: "Something broke",
      system: "system",
      env: "dev",
    });

    const all = listItems();

    expect(all.length).toBe(1);
    expect(all[0].id).toBe("1");
    expect(all[0].status).toBe("pending");
    expect(all[0].createdAt).toBeTruthy();
    expect(all[0].updatedAt).toBeTruthy();
  });

  it("saveAnalysis() updates item status and analysis", () => {
    createItem({
      id: "1",
      title: "Test item",
      description: "Something broke",
      system: "system",
      env: "dev",
    });

    const analysis = {
      summary: "Likely Cosmos throttling",
      severity: 3,
    };

    const updated = saveAnalysis("1", analysis);

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("analyzed");
    expect(updated?.analysis).toEqual(analysis);
    expect(updated?.updatedAt).toBeTruthy();
  });

  it("saveAnalysis() returns null if item not found", () => {
    const result = saveAnalysis("missing-id", { foo: "bar" });
    expect(result).toBeNull();
  });
});
