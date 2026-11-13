import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isBreached, slaRemainingHours, slaState } from "./sla.js";
import { Priority, priorityWeight, triageSort } from "./index.js";

// NOTE (course): these starter tests have high line coverage but weak assertions -
// each function is exercised, but nothing pins its behavior at the boundaries. The
// mutation-testing chapter reveals the surviving mutants (e.g. `>` vs `>=` in
// isBreached, the slaState thresholds, the triage tie-break) and strengthens these
// with boundary cases and a property-based test.

describe("slaRemainingHours", () => {
  it("returns a number", () => {
    expect(typeof slaRemainingHours(10, 4)).toBe("number");
  });
});

describe("isBreached", () => {
  it("flags a clearly overdue ticket", () => {
    expect(isBreached(10, 50)).toBe(true);
  });

  it("does not flag a brand-new ticket", () => {
    expect(isBreached(10, 0)).toBe(false);
  });

  it("is not breached at the exact SLA boundary (age === slaHours)", () => {
    expect(isBreached(10, 10)).toBe(false);
  });
});

describe("slaState", () => {
  it("returns a valid SLA state", () => {
    expect(["ok", "due-soon", "overdue"]).toContain(slaState("high", 100, 10));
  });

  it("is overdue when well past the deadline", () => {
    expect(slaState("high", 10, 100)).toBe("overdue");
  });

  it("is overdue exactly at the deadline (remaining === 0)", () => {
    expect(slaState("high", 10, 10)).toBe("overdue");
  });

  it("is due-soon exactly at the priority's urgency window", () => {
    // high priority: urgencyWindow = 4, remaining = 10 - 6 = 4
    expect(slaState("high", 10, 6)).toBe("due-soon");
  });

  it("is due-soon strictly inside the urgency window", () => {
    // high priority: urgencyWindow = 4, remaining = 10 - 8 = 2
    expect(slaState("high", 10, 8)).toBe("due-soon");
  });

  it("is ok when comfortably outside the urgency window", () => {
    // high priority: urgencyWindow = 4, remaining = 100 - 10 = 90
    expect(slaState("high", 100, 10)).toBe("ok");
  });
});

describe("priorityWeight", () => {
  it("gives urgent more weight than low", () => {
    expect(priorityWeight("urgent")).toBeGreaterThan(priorityWeight("low"));
  });
});

describe("triageSort", () => {
  it("returns the same tickets it was given", () => {
    const sorted = triageSort([
      { id: "a", priority: "low", ageHours: 1, slaHours: 24 },
      { id: "b", priority: "urgent", ageHours: 1, slaHours: 1 },
    ]);
    expect(sorted).toHaveLength(2);
  });

  it("orders by priority desc, then by remaining SLA time asc (property-based)", () => {
    const ticket = fc.record({
      id: fc.string(),
      priority: fc.constantFrom<Priority>("low", "normal", "high", "urgent"),
      ageHours: fc.integer({ min: 0, max: 200 }),
      slaHours: fc.integer({ min: 1, max: 200 }),
    });

    fc.assert(
      fc.property(fc.array(ticket, { minLength: 2, maxLength: 20 }), (tickets) => {
        const sorted = triageSort(tickets);
        for (let i = 0; i < sorted.length - 1; i++) {
          const a = sorted[i];
          const b = sorted[i + 1];
          const weightDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
          if (weightDiff !== 0) {
            expect(weightDiff).toBeLessThan(0);
          } else {
            expect(a.slaHours - a.ageHours).toBeLessThanOrEqual(b.slaHours - b.ageHours);
          }
        }
      }),
    );
  });
});
