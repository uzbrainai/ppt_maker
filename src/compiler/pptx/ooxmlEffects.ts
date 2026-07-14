/**
 * Effects: shadow → DrawingML `<a:effectLst>` with `<a:outerShdw>`.
 */

import type { ShadowSpec } from "../../core/types.js";
import { alphaToOoxml, angleToOoxml, rgbHexToOoxml } from "../../core/color.js";
import { ptToEmu } from "../../core/units.js";

export function shadowToOoxml(shadow: ShadowSpec | undefined): string {
  if (!shadow || !shadow.enabled) return "";
  const blur = ptToEmu(shadow.blur);
  const dist = ptToEmu(shadow.distance);
  const dir = angleToOoxml(shadow.direction);
  const color = rgbHexToOoxml(shadow.color);
  const alpha = alphaToOoxml(shadow.opacity);
  return (
    `<a:effectLst>` +
    `<a:outerShdw blurRad="${blur}" dist="${dist}" dir="${dir}" rotWithShape="0">` +
    `<a:srgbClr val="${color}"><a:alpha val="${alpha}"/></a:srgbClr>` +
    `</a:outerShdw>` +
    `</a:effectLst>`
  );
}
