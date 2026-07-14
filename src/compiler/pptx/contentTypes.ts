/**
 * [Content_Types].xml — declares the content type of every part in the package.
 */

import { XML_DECL } from "../../core/xml.js";

const CT = {
  presentation:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  slide: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  slideMaster:
    "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
  slideLayout:
    "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  theme: "application/vnd.openxmlformats-officedocument.theme+xml",
  core: "application/vnd.openxmlformats-package.core-properties+xml",
  app: "application/vnd.openxmlformats-officedocument.extended-properties+xml",
};

export function contentTypesXml(slideCount: number): string {
  const slideOverrides = Array.from({ length: slideCount }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${CT.slide}"/>`
  ).join("");

  return (
    XML_DECL +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Override PartName="/ppt/presentation.xml" ContentType="${CT.presentation}"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT.slideMaster}"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT.slideLayout}"/>` +
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="${CT.theme}"/>` +
    slideOverrides +
    `<Override PartName="/docProps/core.xml" ContentType="${CT.core}"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="${CT.app}"/>` +
    `</Types>`
  );
}
