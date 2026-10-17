// Shared FlowForge data shapes. Safe to import from client and server code.

export type StepKind = "trigger" | "action" | "filter";

export interface Step {
  id: string;
  kind: StepKind;
  /** App key from the catalog, e.g. "webhook", "telegram", "linkedin". */
  app: string;
  /** Trigger or action key inside that app, e.g. "send_message". */
  op: string;
  label: string;
  /** Connection id for apps that need credentials. */
  connectionId?: string;
  /** Field values; strings may contain {{template}} references. */
  config: Record<string, string>;
}

export interface Workflow {
  id: string;
  name: string;
  status: "on" | "off";
  /** Secret token that must accompany webhook calls for this workflow. */
  hookToken: string;
  steps: Step[];
  runs: number;
  createdAt: string;
  updatedAt: string;
  /** Polling/schedule bookkeeping (last schedule fire, seen RSS ids...). */
  state?: Record<string, unknown>;
}

export interface StepResult {
  stepId: string;
  label: string;
  app: string;
  status: "success" | "error" | "skipped" | "stopped";
  output?: unknown;
  error?: string;
  ms: number;
}

export interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  source: "webhook" | "schedule" | "rss" | "test" | "manual" | "telegram";
  status: "success" | "error" | "filtered";
  startedAt: string;
  ms: number;
  input: unknown;
  steps: StepResult[];
  error?: string;
}

export interface Connection {
  id: string;
  app: string;
  /** Human label, usually the account name returned by the platform. */
  label: string;
  /** AES-GCM encrypted JSON of the credential fields / tokens. */
  secret: string;
  createdAt: string;
  expiresAt?: string;
  /** Non-secret extras such as account ids or Facebook page list. */
  meta?: Record<string, unknown>;
}

export type PublicConnection = Omit<Connection, "secret">;
