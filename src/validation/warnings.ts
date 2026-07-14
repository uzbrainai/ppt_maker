/**
 * Lightweight warning collection. Warnings never stop the pipeline; they are
 * surfaced via the CLI (`inspect`) and the build summary.
 */

export type WarningCode =
  | "unknown-class"
  | "unknown-slide-macro"
  | "stub-macro"
  | "radial-gradient-fallback"
  | "freeform-unsupported"
  | "text-overflow-risk"
  | "out-of-bounds"
  | "schema"
  | "unknown-theme"
  | "unknown-icon";

export interface Warning {
  code: WarningCode;
  message: string;
  /** optional location hint, e.g. "slide 2", "class 'foo'" */
  where?: string;
}

export class Warnings {
  private list: Warning[] = [];

  add(code: WarningCode, message: string, where?: string): void {
    this.list.push({ code, message, where });
  }

  push(warning: Warning): void {
    this.list.push(warning);
  }

  merge(other: Warnings | Warning[]): void {
    const items = other instanceof Warnings ? other.all() : other;
    this.list.push(...items);
  }

  all(): Warning[] {
    return this.list.slice();
  }

  get count(): number {
    return this.list.length;
  }

  format(): string {
    if (this.list.length === 0) return "No warnings.";
    return this.list
      .map((w) => {
        const loc = w.where ? ` (${w.where})` : "";
        return `  ⚠ [${w.code}]${loc} ${w.message}`;
      })
      .join("\n");
  }
}
