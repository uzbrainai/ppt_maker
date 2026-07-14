/**
 * PPTX → PDF conversion via LibreOffice (headless). slidewind generates the
 * editable .pptx; LibreOffice renders it to a faithful .pdf. Requires the
 * `soffice` binary (bundled in the Docker image; on macOS the LibreOffice app).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, basename, resolve, join } from "node:path";

const SOFFICE_CANDIDATES = [
  process.env.SOFFICE_BIN,
  "soffice",
  "libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
].filter(Boolean) as string[];

function resolveSoffice(): string | undefined {
  for (const c of SOFFICE_CANDIDATES) {
    // absolute path → check existence; bare command → trust PATH
    if (c.includes("/")) {
      if (existsSync(c)) return c;
    } else {
      return c;
    }
  }
  return undefined;
}

/**
 * Convert a .pptx to .pdf in the same directory (or `outDir`). Returns the pdf
 * path. Throws if LibreOffice isn't available or conversion fails.
 */
export function convertToPdf(pptxPath: string, outDir?: string): Promise<string> {
  const bin = resolveSoffice();
  if (!bin) {
    return Promise.reject(
      new Error("LibreOffice (soffice) not found. Install it or set SOFFICE_BIN to enable --pdf.")
    );
  }
  const abs = resolve(pptxPath);
  const dir = outDir ? resolve(outDir) : dirname(abs);
  const pdfPath = join(dir, basename(abs).replace(/\.pptx$/i, ".pdf"));

  return new Promise((res, rej) => {
    const proc = spawn(
      bin,
      ["--headless", "--convert-to", "pdf", "--outdir", dir, abs],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let err = "";
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) => rej(new Error(`Failed to launch ${bin}: ${e.message}`)));
    proc.on("close", (code) => {
      if (code === 0 && existsSync(pdfPath)) res(pdfPath);
      else rej(new Error(`PDF conversion failed (exit ${code}). ${err.trim()}`));
    });
  });
}

export function hasLibreOffice(): boolean {
  return resolveSoffice() !== undefined;
}
