export type SectionTemplate = Array<{ tStart: number; tEnd: number; type: string }>;

export const sectionTemplates: Record<number, SectionTemplate> = {
  10: [
    { tStart: 0, tEnd: 2, type: "hook" },
    { tStart: 2, tEnd: 7, type: "value" },
    { tStart: 7, tEnd: 10, type: "cta" },
  ],
  15: [
    { tStart: 0, tEnd: 3, type: "hook" },
    { tStart: 3, tEnd: 10, type: "value" },
    { tStart: 10, tEnd: 15, type: "cta" },
  ],
  20: [
    { tStart: 0, tEnd: 4, type: "hook" },
    { tStart: 4, tEnd: 14, type: "value" },
    { tStart: 14, tEnd: 20, type: "cta" },
  ],
  30: [
    { tStart: 0, tEnd: 4, type: "hook" },
    { tStart: 4, tEnd: 12, type: "setup" },
    { tStart: 12, tEnd: 22, type: "value" },
    { tStart: 22, tEnd: 30, type: "cta" },
  ],
  45: [
    { tStart: 0, tEnd: 4, type: "hook" },
    { tStart: 4, tEnd: 12, type: "setup" },
    { tStart: 12, tEnd: 28, type: "value" },
    { tStart: 28, tEnd: 38, type: "steps" },
    { tStart: 38, tEnd: 45, type: "cta" },
  ],
  60: [
    { tStart: 0, tEnd: 3, type: "hook" },
    { tStart: 3, tEnd: 10, type: "setup" },
    { tStart: 10, tEnd: 35, type: "value" },
    { tStart: 35, tEnd: 52, type: "steps" },
    { tStart: 52, tEnd: 60, type: "cta" },
  ],
};

export function pickTemplate(durationSec: number): SectionTemplate {
  const rounded = [10, 15, 20, 30, 45, 60].reduce((prev, curr) => {
    return Math.abs(curr - durationSec) < Math.abs(prev - durationSec) ? curr : prev;
  }, 30);
  return sectionTemplates[rounded] || sectionTemplates[30];
}
