import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A tiny document store: collections of JSON docs keyed by id.
// Uses Supabase (table `flowforge_docs`) when a service role key is set,
// otherwise a JSON file under .flowforge/ for local development.

export type Collection = "workflows" | "runs" | "connections" | "kv";

interface Backend {
  list<T>(col: Collection): Promise<T[]>;
  get<T>(col: Collection, id: string): Promise<T | null>;
  put<T>(col: Collection, id: string, doc: T): Promise<void>;
  remove(col: Collection, id: string): Promise<void>;
  clear(col: Collection): Promise<void>;
}

class SupabaseBackend implements Backend {
  constructor(private db: SupabaseClient) {}

  async list<T>(col: Collection) {
    const { data, error } = await this.db
      .from("flowforge_docs")
      .select("data")
      .eq("collection", col)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(`Store list failed: ${error.message}`);
    return (data ?? []).map((r) => r.data as T);
  }

  async get<T>(col: Collection, id: string) {
    const { data, error } = await this.db
      .from("flowforge_docs")
      .select("data")
      .eq("collection", col)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Store get failed: ${error.message}`);
    return (data?.data as T) ?? null;
  }

  async put<T>(col: Collection, id: string, doc: T) {
    const { error } = await this.db.from("flowforge_docs").upsert({
      collection: col,
      id,
      data: doc,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Store put failed: ${error.message}`);
  }

  async remove(col: Collection, id: string) {
    const { error } = await this.db
      .from("flowforge_docs")
      .delete()
      .eq("collection", col)
      .eq("id", id);
    if (error) throw new Error(`Store delete failed: ${error.message}`);
  }

  async clear(col: Collection) {
    const { error } = await this.db
      .from("flowforge_docs")
      .delete()
      .eq("collection", col);
    if (error) throw new Error(`Store clear failed: ${error.message}`);
  }
}

type FileData = Record<string, Record<string, { doc: unknown; at: number }>>;

class FileBackend implements Backend {
  private file = path.join(process.cwd(), ".flowforge", "data.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<FileData> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return {};
    }
  }

  // Serialize writes so concurrent requests don't clobber each other.
  private mutate(fn: (d: FileData) => void) {
    const next = this.queue.then(async () => {
      const d = await this.read();
      fn(d);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(d));
    });
    this.queue = next.catch(() => {});
    return next;
  }

  async list<T>(col: Collection) {
    await this.queue;
    const d = await this.read();
    return Object.values(d[col] ?? {})
      .sort((a, b) => b.at - a.at)
      .map((e) => e.doc as T);
  }

  async get<T>(col: Collection, id: string) {
    await this.queue;
    const d = await this.read();
    return (d[col]?.[id]?.doc as T) ?? null;
  }

  put<T>(col: Collection, id: string, doc: T) {
    return this.mutate((d) => {
      d[col] ??= {};
      d[col][id] = { doc, at: Date.now() };
    });
  }

  remove(col: Collection, id: string) {
    return this.mutate((d) => {
      delete d[col]?.[id];
    });
  }

  clear(col: Collection) {
    return this.mutate((d) => {
      d[col] = {};
    });
  }
}

let backend: Backend | null = null;

export function storeKind(): "supabase" | "file" {
  return process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "supabase"
    : "file";
}

export function store(): Backend {
  if (backend) return backend;
  if (storeKind() === "supabase") {
    backend = new SupabaseBackend(
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      ),
    );
  } else {
    backend = new FileBackend();
  }
  return backend;
}
