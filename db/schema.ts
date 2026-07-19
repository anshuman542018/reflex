import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const repositoryState = sqliteTable("repository_state", {
  repo: text("repo").primaryKey(),
  filesJson: text("files_json").notNull(),
  agentsMd: text("agents_md").notNull(),
  skillMd: text("skill_md").notNull().default(""),
  mistakesPrevented: integer("mistakes_prevented").notNull().default(0),
  sessions: integer("sessions").notNull().default(0),
  lastEvent: text("last_event").notNull().default("Seeded demo repository"),
  updatedAt: text("updated_at").notNull(),
});

export const corrections = sqliteTable("corrections", {
  id: text("id").primaryKey(),
  repo: text("repo").notNull(),
  prompt: text("prompt").notNull(),
  beforeJson: text("before_json").notNull(),
  afterJson: text("after_json").notNull(),
  context: text("context").notNull(),
  status: text("status").notNull().default("captured"),
  createdAt: text("created_at").notNull(),
});

export const rules = sqliteTable("rules", {
  id: text("id").primaryKey(),
  correctionId: text("correction_id").notNull(),
  statement: text("statement").notNull(),
  rationale: text("rationale").notNull(),
  skillMarkdown: text("skill_markdown").notNull(),
  evalFilename: text("eval_filename").notNull(),
  evalCode: text("eval_code").notNull(),
  status: text("status").notNull().default("verified"),
  createdAt: text("created_at").notNull(),
});
