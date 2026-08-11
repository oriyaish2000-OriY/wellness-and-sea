/**
 * /api/setup — DISABLED
 *
 * This endpoint was used during initial development to apply the DB schema.
 * It has been permanently disabled. All schema changes go through
 * Supabase SQL Editor or the Management API.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Gone' }, { status: 410 })
}
