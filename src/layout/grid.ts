/**
 * Grid placement. Given a content box, a cols×rows grid, and a gap, produce the
 * cell boxes in reading order (row-major). Used by the cards macro.
 */

import type { Box } from "../core/types.js";
import { columns, rows } from "./boxes.js";

export interface GridResult {
  cells: Box[];
  cols: number;
  rows: number;
}

export function gridCells(area: Box, cols: number, rowCount: number, gap: number): GridResult {
  const rowBoxes = rows(area, rowCount, gap);
  const cells: Box[] = [];
  for (const rowBox of rowBoxes) {
    cells.push(...columns(rowBox, cols, gap));
  }
  return { cells, cols, rows: rowCount };
}

/**
 * Choose a grid shape for an arbitrary item count when the class didn't pin one.
 * Prefers up to 3 columns, balancing rows.
 */
export function autoGrid(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 8) return { cols: 4, rows: 2 };
  const cols = Math.ceil(Math.sqrt(count));
  return { cols, rows: Math.ceil(count / cols) };
}
