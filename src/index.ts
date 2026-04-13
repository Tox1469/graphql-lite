export type Field = string | { [key: string]: Field[] | Field };

export interface QueryOptions {
  operation?: "query" | "mutation" | "subscription";
  name?: string;
  variables?: Record<string, { type: string; value: unknown }>;
}

function renderFields(fields: Field[], indent = 2): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  for (const f of fields) {
    if (typeof f === "string") {
      lines.push(`${pad}${f}`);
    } else {
      for (const [key, sub] of Object.entries(f)) {
        const subs = Array.isArray(sub) ? sub : [sub];
        lines.push(`${pad}${key} {`);
        lines.push(renderFields(subs, indent + 2));
        lines.push(`${pad}}`);
      }
    }
  }
  return lines.join("\n");
}

function renderArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args).map(([k, v]) => {
    if (typeof v === "string" && v.startsWith("$")) return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  });
  return parts.length ? `(${parts.join(", ")})` : "";
}

export class GraphQLBuilder {
  private rootName: string;
  private args: Record<string, unknown> = {};
  private fields: Field[] = [];
  private opts: QueryOptions;

  constructor(rootName: string, opts: QueryOptions = {}) {
    this.rootName = rootName;
    this.opts = opts;
  }

  withArgs(args: Record<string, unknown>): this {
    this.args = { ...this.args, ...args };
    return this;
  }

  select(...fields: Field[]): this {
    this.fields.push(...fields);
    return this;
  }

  build(): { query: string; variables: Record<string, unknown> } {
    const op = this.opts.operation ?? "query";
    const vars = this.opts.variables ?? {};
    const varDecl = Object.keys(vars).length
      ? `(${Object.entries(vars).map(([k, v]) => `$${k}: ${v.type}`).join(", ")})`
      : "";
    const name = this.opts.name ? ` ${this.opts.name}` : "";
    const argsStr = renderArgs(this.args);
    const body = renderFields(this.fields, 4);
    const query = `${op}${name}${varDecl} {\n  ${this.rootName}${argsStr} {\n${body}\n  }\n}`;
    const variables: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vars)) variables[k] = v.value;
    return { query, variables };
  }
}

export const query = (root: string, opts?: QueryOptions) => new GraphQLBuilder(root, { ...opts, operation: "query" });
export const mutation = (root: string, opts?: QueryOptions) => new GraphQLBuilder(root, { ...opts, operation: "mutation" });
