CREATE TABLE `corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`prompt` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`context` text NOT NULL,
	`status` text DEFAULT 'captured' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repository_state` (
	`repo` text PRIMARY KEY NOT NULL,
	`files_json` text NOT NULL,
	`agents_md` text NOT NULL,
	`skill_md` text DEFAULT '' NOT NULL,
	`mistakes_prevented` integer DEFAULT 0 NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`last_event` text DEFAULT 'Seeded demo repository' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`correction_id` text NOT NULL,
	`statement` text NOT NULL,
	`rationale` text NOT NULL,
	`skill_markdown` text NOT NULL,
	`eval_filename` text NOT NULL,
	`eval_code` text NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`created_at` text NOT NULL
);
