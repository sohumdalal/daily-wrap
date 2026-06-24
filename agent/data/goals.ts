import { db } from '../db/client.ts';
import type { Goal } from '../types.ts';

const DEFAULT_USER = 'default';

type Row = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  metric: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function toGoal(r: Row): Goal {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    metric: r.metric ?? undefined,
    status: r.status as Goal['status'],
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listGoals(userId: string = DEFAULT_USER): Promise<Goal[]> {
  const sql = db();
  const rows = await sql<Row[]>`
    SELECT * FROM goals
    WHERE user_id = ${userId}
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'achieved' THEN 2 ELSE 3 END,
      created_at DESC
  `;
  return rows.map(toGoal);
}

export async function activeGoals(userId: string = DEFAULT_USER): Promise<Goal[]> {
  const sql = db();
  const rows = await sql<Row[]>`
    SELECT * FROM goals
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at ASC
  `;
  return rows.map(toGoal);
}

export async function upsertGoal(
  goal: Goal,
  userId: string = DEFAULT_USER,
): Promise<Goal> {
  const sql = db();
  const rows = await sql<Row[]>`
    INSERT INTO goals (id, user_id, title, description, metric, status, created_at, updated_at)
    VALUES (
      ${goal.id},
      ${userId},
      ${goal.title},
      ${goal.description ?? null},
      ${goal.metric ?? null},
      ${goal.status},
      ${goal.createdAt ?? new Date().toISOString()},
      ${new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      title       = EXCLUDED.title,
      description = EXCLUDED.description,
      metric      = EXCLUDED.metric,
      status      = EXCLUDED.status,
      updated_at  = now()
    RETURNING *
  `;
  return toGoal(rows[0]!);
}

export async function deleteGoal(
  id: string,
  userId: string = DEFAULT_USER,
): Promise<void> {
  const sql = db();
  await sql`DELETE FROM goals WHERE id = ${id} AND user_id = ${userId}`;
}
