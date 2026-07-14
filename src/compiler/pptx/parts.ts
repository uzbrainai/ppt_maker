/**
 * Assemble every OOXML part (path → string) for a PPTScene. buildPptx() zips
 * this map into a .pptx package.
 */

import type { PPTScene } from "../../core/types.js";
import { contentTypesXml } from "./contentTypes.js";
import {
  rootRels,
  presentationRels,
  masterRels,
  layoutRels,
  slideRels,
} from "./relationships.js";
import {
  presentationXml,
  corePropsXml,
  appPropsXml,
} from "./presentationXml.js";
import { themeXml } from "./themeXml.js";
import { masterXml } from "./masterXml.js";
import { layoutXml } from "./layoutXml.js";
import { renderSlideXml } from "./slideXml.js";
import { MediaRegistry } from "./media.js";

/** Parts are XML strings; media (images) are binary Buffers. */
export function buildParts(scene: PPTScene, title = "slidewind deck"): Record<string, string | Buffer> {
  const slideCount = scene.slides.length;
  const parts: Record<string, string | Buffer> = {};
  const media = new MediaRegistry();

  // Package-level
  parts["[Content_Types].xml"] = contentTypesXml(slideCount);
  parts["_rels/.rels"] = rootRels();

  // Doc props
  parts["docProps/core.xml"] = corePropsXml(title);
  parts["docProps/app.xml"] = appPropsXml(slideCount);

  // Presentation
  parts["ppt/presentation.xml"] = presentationXml(scene.size, slideCount);
  parts["ppt/_rels/presentation.xml.rels"] = presentationRels(slideCount);

  // Theme
  parts["ppt/theme/theme1.xml"] = themeXml(scene.theme);

  // Master + layout
  parts["ppt/slideMasters/slideMaster1.xml"] = masterXml();
  parts["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = masterRels();
  parts["ppt/slideLayouts/slideLayout1.xml"] = layoutXml();
  parts["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = layoutRels();

  // Slides (share one media registry so identical images are stored once)
  scene.slides.forEach((slide, i) => {
    const n = i + 1;
    const { xml, rels } = renderSlideXml(slide, media);
    parts[`ppt/slides/slide${n}.xml`] = xml;
    parts[`ppt/slides/_rels/slide${n}.xml.rels`] = slideRels(rels);
  });

  // Binary media parts.
  for (const item of media.items) parts[item.path] = item.data;

  return parts;
}
