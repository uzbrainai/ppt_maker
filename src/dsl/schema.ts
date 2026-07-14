/**
 * Zod schemas for DeckSpec Lite. These validate the LLM-facing authoring
 * format. The schema is intentionally permissive about *content* (e.g. unknown
 * utility classes are warnings, not errors) but strict about *structure*.
 */

import { z } from "zod";

/** [icon, title, body] | [title, body] | object form */
const itemTupleSchema = z.union([
  z.tuple([z.string(), z.string(), z.string()]),
  z.tuple([z.string(), z.string()]),
  z
    .object({
      icon: z.string().optional(),
      t: z.string().optional(),
      title: z.string().optional(),
      s: z.string().optional(),
      body: z.string().optional(),
      group: z.string().optional(),
      g: z.string().optional(),
      len: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    })
    .passthrough(),
]);

/** Image container spec. `data` (runtime bytes) is attached after parse, so the
 * schema only validates the authoring fields. */
const imageSchema = z.object({
  src: z.string().optional(),
  prompt: z.string().optional(),
  alt: z.string().optional(),
}).passthrough();

const titleSlideSchema = z.object({
  title: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string(),
    s: z.string().optional(),
    image: imageSchema.optional(),
    notes: z.string().optional(),
  }),
});

const cardsSlideSchema = z.object({
  cards: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    items: z.array(itemTupleSchema).min(1),
    note: z.string().optional(),
    s: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const workflowSlideSchema = z.object({
  wf: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    steps: z.array(itemTupleSchema).min(1),
    callout: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const kpiTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.tuple([z.string(), z.string(), z.string()]),
  z
    .object({
      value: z.string().optional(),
      v: z.string().optional(),
      label: z.string().optional(),
      l: z.string().optional(),
      icon: z.string().optional(),
    })
    .passthrough(),
]);

const kpiSlideSchema = z.object({
  kpi: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    items: z.array(kpiTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const bulletItemSchema = z.union([
  z.string(),
  z.tuple([z.string(), z.string()]),
  z
    .object({
      t: z.string().optional(),
      title: z.string().optional(),
      s: z.string().optional(),
      body: z.string().optional(),
      icon: z.string().optional(),
      group: z.string().optional(),
      g: z.string().optional(),
      len: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    })
    .passthrough(),
]);

const bulletsSlideSchema = z.object({
  bullets: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    s: z.string().optional(),
    items: z.array(bulletItemSchema).min(1),
    notes: z.string().optional(),
  }),
});

const cmpColumnSchema = z
  .object({
    t: z.string().optional(),
    title: z.string().optional(),
    s: z.string().optional(),
    subtitle: z.string().optional(),
    icon: z.string().optional(),
    tone: z.enum(["good", "bad", "neutral"]).optional(),
    points: z.array(z.string()).optional(),
    group: z.string().optional(),
  })
  .passthrough();

const cmpSlideSchema = z.object({
  cmp: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    items: z.array(cmpColumnSchema).min(2),
    notes: z.string().optional(),
  }),
});

const sectionSlideSchema = z.object({
  section: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string(),
    s: z.string().optional(),
    n: z.string().optional(),
    image: imageSchema.optional(),
    notes: z.string().optional(),
  }),
});

const showcaseSlideSchema = z.object({
  showcase: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    s: z.string().optional(),
    image: imageSchema,
    points: z.array(z.union([
      z.string(),
      z.tuple([z.string(), z.string()]),
      z.object({ t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
    ])).optional(),
    notes: z.string().optional(),
  }),
});

const chartItemSchema = z.union([
  z.tuple([z.string(), z.number()]),
  z.object({ label: z.string().optional(), l: z.string().optional(), value: z.number().optional(), v: z.number().optional(), color: z.string().optional() }).passthrough(),
]);

const chartSeriesSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  data: z.array(z.number()).optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
}).passthrough();

const chartSlideSchema = z.object({
  chart: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    type: z.enum(["bar", "barh", "line", "area", "scatter", "donut"]),
    t: z.string().optional(),
    items: z.array(chartItemSchema).optional(),
    series: z.array(chartSeriesSchema).optional(),
    x: z.array(z.string()).optional(),
    legend: z.boolean().optional(),
    values: z.boolean().optional(),
    pattern: z.boolean().optional(),
    s: z.string().optional(),
    points: z.array(z.string()).optional(),
    insightTitle: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const timelineTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.tuple([z.string(), z.string(), z.string()]),
  z.object({ date: z.string().optional(), d: z.string().optional(), t: z.string().optional(), title: z.string().optional(), s: z.string().optional(), body: z.string().optional(), icon: z.string().optional() }).passthrough(),
]);

const timelineSlideSchema = z.object({
  timeline: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    eyebrow: z.string().optional(),
    t: z.string().optional(),
    items: z.array(timelineTupleSchema).min(1),
    callout: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const summarySlideSchema = z.object({
  summary: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    s: z.string().optional(),
    items: z.array(itemTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const gaugeTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.tuple([z.string(), z.string(), z.string()]),
  z.object({ value: z.string().optional(), v: z.string().optional(), title: z.string().optional(), t: z.string().optional(), label: z.string().optional(), body: z.string().optional(), s: z.string().optional(), icon: z.string().optional() }).passthrough(),
]);

const gaugeSlideSchema = z.object({
  gauge: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    items: z.array(gaugeTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const pyramidTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.tuple([z.string()]),
  z.object({ title: z.string().optional(), t: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
]);

const pyramidSlideSchema = z.object({
  pyramid: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    eyebrow: z.string().optional(),
    t: z.string().optional(),
    items: z.array(pyramidTupleSchema).min(2),
    notes: z.string().optional(),
  }),
});

const tableSlideSchema = z.object({
  table: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.union([z.string(), z.number()]))).min(1),
    summary: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const agendaItemSchema = z.union([
  z.string(),
  z.tuple([z.string()]),
  z.object({ title: z.string().optional(), t: z.string().optional(), label: z.string().optional() }).passthrough(),
]);

const agendaSlideSchema = z.object({
  agenda: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    items: z.array(agendaItemSchema).min(1),
    notes: z.string().optional(),
  }),
});

const roadmapTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.tuple([z.string(), z.string(), z.string()]),
  z.object({ phase: z.string().optional(), n: z.string().optional(), t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
]);

const roadmapSlideSchema = z.object({
  roadmap: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    eyebrow: z.string().optional(),
    t: z.string().optional(),
    items: z.array(roadmapTupleSchema).min(1),
    callout: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const problemTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({ t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
]);

const problemSlideSchema = z.object({
  problem: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    s: z.string().optional(),
    items: z.array(problemTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const statPanelSchema = z.object({
  type: z.enum(["bar", "line", "area", "donut"]).optional(),
  t: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  s: z.string().optional(),
  items: z.array(chartItemSchema).optional(),
  series: z.array(chartSeriesSchema).optional(),
  x: z.array(z.string()).optional(),
  pattern: z.boolean().optional(),
}).passthrough();

const statSlideSchema = z.object({
  stat: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    eyebrow: z.string().optional(),
    t: z.string().optional(),
    items: z.array(statPanelSchema).min(1),
    notes: z.string().optional(),
  }),
});

const criteriaTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({ t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
]);

const criteriaSlideSchema = z.object({
  criteria: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string().optional(),
    s: z.string().optional(),
    items: z.array(criteriaTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const highlightSlideSchema = z.object({
  highlight: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    t: z.string(),
    s: z.string().optional(),
    featured: z.string().optional(),
    icon: z.string().optional(),
    image: imageSchema.optional(),
    items: z.array(agendaItemSchema).min(1),
    notes: z.string().optional(),
  }),
});

const spineTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({ t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
]);

const spineSlideSchema = z.object({
  spine: z.object({
    class: z.string().optional(),
    source: z.string().optional(),
    brand: z.string().optional(),
    t: z.string().optional(),
    items: z.array(spineTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const columnTupleSchema = z.union([
  z.tuple([z.string(), z.string(), z.string()]),
  z.tuple([z.string(), z.string()]),
  z.object({ icon: z.string().optional(), t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
]);
const columnsSlideSchema = z.object({
  columns: z.object({
    class: z.string().optional(), source: z.string().optional(),
    t: z.string().optional(), s: z.string().optional(),
    items: z.array(columnTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const radialTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({ t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional() }).passthrough(),
]);
const radialSlideSchema = z.object({
  radial: z.object({
    class: z.string().optional(), source: z.string().optional(),
    t: z.string().optional(), s: z.string().optional(), center: z.string().optional(),
    items: z.array(radialTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

const funnelTupleSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({ t: z.string().optional(), title: z.string().optional(), body: z.string().optional(), s: z.string().optional(), value: z.string().optional() }).passthrough(),
]);
const funnelSlideSchema = z.object({
  funnel: z.object({
    class: z.string().optional(), source: z.string().optional(),
    eyebrow: z.string().optional(), t: z.string().optional(),
    items: z.array(funnelTupleSchema).min(1),
    notes: z.string().optional(),
  }),
});

/** Stub macros — accepted structurally, expanded as placeholders. */
const stubSlideSchema = z.object({
  arch: z.object({ class: z.string().optional(),
    source: z.string().optional(), t: z.string().optional() }).passthrough(),
});

export const slideSchema = z.union([
  titleSlideSchema,
  cardsSlideSchema,
  workflowSlideSchema,
  kpiSlideSchema,
  bulletsSlideSchema,
  sectionSlideSchema,
  cmpSlideSchema,
  chartSlideSchema,
  timelineSlideSchema,
  summarySlideSchema,
  gaugeSlideSchema,
  pyramidSlideSchema,
  tableSlideSchema,
  agendaSlideSchema,
  roadmapSlideSchema,
  problemSlideSchema,
  statSlideSchema,
  criteriaSlideSchema,
  highlightSlideSchema,
  spineSlideSchema,
  showcaseSlideSchema,
  columnsSlideSchema,
  radialSlideSchema,
  funnelSlideSchema,
  stubSlideSchema,
]);

export const deckSpecSchema = z.object({
  format: z.literal("deckspec/0.1"),
  theme: z.string().optional(),
  deck: z.string().optional(),
  appearance: z.enum(["light", "dark"]).optional(),
  target: z.enum(["ppt365", "ppt365.mac", "ppt365.win", "generic"]).optional(),
  mode: z.enum(["editable", "balanced", "pixel"]).optional(),
  size: z.enum(["wide", "standard"]).optional(),
  slides: z.array(z.unknown()).min(1),
});

export type DeckSpecInput = z.infer<typeof deckSpecSchema>;
