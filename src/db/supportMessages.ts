/**
 * Support messages. Users can submit a contact-form / support-chat message;
 * admins reply from the admin panel.
 */

import { query } from "./pool.js";

export interface SupportMessage {
  id: number;
  userId: string | null;
  name: string | null;
  email: string | null;
  body: string;
  reply: string | null;
  repliedBy: string | null;
  repliedAt: string | null;
  createdAt: string;
}

type Row = {
  id: number;
  user_id: string | null;
  name: string | null;
  email: string | null;
  body: string;
  reply: string | null;
  replied_by: string | null;
  replied_at: Date | null;
  created_at: Date;
};

function toMsg(r: Row): SupportMessage {
  return {
    id: Number(r.id),
    userId: r.user_id,
    name: r.name,
    email: r.email,
    body: r.body,
    reply: r.reply,
    repliedBy: r.replied_by,
    repliedAt: r.replied_at ? r.replied_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function createSupportMessage(input: {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  body: string;
}): Promise<SupportMessage> {
  const { rows } = await query<Row>(
    `INSERT INTO support_messages (user_id, name, email, body)
       VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.userId ?? null, input.name ?? null, input.email ?? null, input.body]
  );
  return toMsg(rows[0]!);
}

export async function listSupportMessages(limit = 200): Promise<SupportMessage[]> {
  const { rows } = await query<Row>(
    `SELECT * FROM support_messages ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map(toMsg);
}

export async function replySupportMessage(
  id: number,
  reply: string,
  adminId: string
): Promise<SupportMessage | null> {
  const { rows } = await query<Row>(
    `UPDATE support_messages
        SET reply = $2, replied_by = $3, replied_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, reply, adminId]
  );
  return rows[0] ? toMsg(rows[0]) : null;
}
