/**
 * ppt/theme/theme1.xml — the DrawingML theme. Color scheme and font scheme are
 * derived from the resolved slidewind theme so the deck's defaults are coherent.
 * The format scheme uses standard, valid fill/line/effect/bg style lists.
 */

import { XML_DECL, escapeXml } from "../../core/xml.js";
import { rgbHexToOoxml } from "../../core/color.js";
import type { ResolvedTheme } from "../../core/types.js";

function clr(hex: string): string {
  return `<a:srgbClr val="${rgbHexToOoxml(hex)}"/>`;
}

export function themeXml(theme: ResolvedTheme): string {
  const c = theme.colors;
  const major = escapeXml(theme.fonts.heading);
  const minor = escapeXml(theme.fonts.body);

  const clrScheme =
    `<a:clrScheme name="${escapeXml(theme.name)}">` +
    `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
    `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
    `<a:dk2>${clr(c.text)}</a:dk2>` +
    `<a:lt2>${clr(c.backgroundMuted)}</a:lt2>` +
    `<a:accent1>${clr(c.primary)}</a:accent1>` +
    `<a:accent2>${clr(c.primaryDark)}</a:accent2>` +
    `<a:accent3>${clr(c.success)}</a:accent3>` +
    `<a:accent4>${clr(c.warning)}</a:accent4>` +
    `<a:accent5>${clr(c.danger)}</a:accent5>` +
    `<a:accent6>${clr(c.textMuted)}</a:accent6>` +
    `<a:hlink>${clr(c.primary)}</a:hlink>` +
    `<a:folHlink>${clr(c.primaryDark)}</a:folHlink>` +
    `</a:clrScheme>`;

  const fontScheme =
    `<a:fontScheme name="${escapeXml(theme.name)}">` +
    `<a:majorFont><a:latin typeface="${major}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
    `<a:minorFont><a:latin typeface="${minor}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
    `</a:fontScheme>`;

  const fmtScheme =
    `<a:fmtScheme name="Office">` +
    `<a:fillStyleLst>` +
    `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
    `<a:gradFill rotWithShape="1"><a:gsLst>` +
    `<a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs>` +
    `</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>` +
    `<a:gradFill rotWithShape="1"><a:gsLst>` +
    `<a:gs pos="0"><a:schemeClr val="phClr"><a:shade val="98000"/></a:schemeClr></a:gs>` +
    `<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="78000"/></a:schemeClr></a:gs>` +
    `</a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>` +
    `</a:fillStyleLst>` +
    `<a:lnStyleLst>` +
    `<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>` +
    `<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>` +
    `<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>` +
    `</a:lnStyleLst>` +
    `<a:effectStyleLst>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle>` +
    `<a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle>` +
    `</a:effectStyleLst>` +
    `<a:bgFillStyleLst>` +
    `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
    `<a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/></a:schemeClr></a:solidFill>` +
    `<a:solidFill><a:schemeClr val="phClr"><a:shade val="80000"/></a:schemeClr></a:solidFill>` +
    `</a:bgFillStyleLst>` +
    `</a:fmtScheme>`;

  return (
    XML_DECL +
    `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${escapeXml(theme.name)}">` +
    `<a:themeElements>` +
    clrScheme +
    fontScheme +
    fmtScheme +
    `</a:themeElements>` +
    `<a:objectDefaults/>` +
    `<a:extraClrSchemeLst/>` +
    `</a:theme>`
  );
}
