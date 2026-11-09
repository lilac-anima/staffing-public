import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
// Settings and reservations share one CAS row so admission and limit changes serialize.
export const deploymentSettings = sqliteTable('deployment_settings', {
  id: text('id').primaryKey(), revision: text('revision').notNull(),
  data: text('data').notNull(), updatedAt: text('updated_at').notNull(),
});

// Atomic, sanitized snapshots appended by capacity-ledger triggers.
export const workerActivityObservations = sqliteTable('worker_activity_observations', {
  id: integer('id').primaryKey({ autoIncrement: true }), revision: text('revision').notNull(),
  observedAt: text('observed_at').notNull(), validUntil: text('valid_until').notNull(), activeIds: text('active_ids').notNull(),
}, table => [index('worker_activity_observed_idx').on(table.observedAt)]);
