/**
 * Post-expansion sanity checks on a PPTScene. Produces warnings only — the
 * scene still compiles. Useful for catching layout regressions.
 */

import type { Box, PPTElement, PPTScene } from "../core/types.js";
import { Warnings } from "./warnings.js";

const TOLERANCE = 0.05; // inches; allow tiny overshoot (decor circles are intentional)

function eachElement(elements: PPTElement[], fn: (el: PPTElement) => void): void {
  for (const el of elements) {
    fn(el);
    if (el.type === "group") eachElement(el.children, fn);
  }
}

function outOfBounds(box: Box, w: number, h: number): boolean {
  return (
    box.x < -TOLERANCE ||
    box.y < -TOLERANCE ||
    box.x + box.w > w + TOLERANCE ||
    box.y + box.h > h + TOLERANCE
  );
}

export function validateScene(scene: PPTScene): Warnings {
  const warnings = new Warnings();
  const { width, height } = scene.size;

  if (scene.slides.length === 0) {
    warnings.add("schema", "Scene has no slides.");
  }

  scene.slides.forEach((slide, i) => {
    const where = `slide ${i + 1}`;
    if (slide.elements.length === 0) {
      warnings.add("schema", "Slide has no elements.", where);
    }
    let offenders = 0;
    eachElement(slide.elements, (el) => {
      // Decorative ellipses (hero/section accents) intentionally bleed off any
      // slide edge; don't count them as overflow.
      const isDecor = el.type === "shape" && el.shape === "ellipse";
      if (!isDecor && outOfBounds(el.box, width, height)) offenders += 1;
    });
    if (offenders > 0) {
      warnings.add(
        "out-of-bounds",
        `${offenders} element(s) extend beyond the slide bounds.`,
        where
      );
    }
  });

  return warnings;
}
