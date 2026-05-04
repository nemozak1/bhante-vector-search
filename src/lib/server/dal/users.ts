import { pool } from '../db/pool.ts';

export async function isAdmin(userId: string): Promise<boolean> {
	const { rows } = await pool.query<{ is_admin: boolean }>(
		`select is_admin from "user" where id = $1`,
		[userId]
	);
	return rows[0]?.is_admin === true;
}
