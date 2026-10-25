import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverDb } from '@/lib/server-db';
import { routeRoomMessage } from '@/lib/routing';
import { generateReply } from '@/lib/orchestrator';
export const runtime = 'nodejs';
export const maxDuration = 60;
const schema = z.object({ id: z.uuid(), roomId: z.uuid(), content: z.string().trim().min(1).max(4000) });
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 20000) return NextResponse.json({ error: 'Message too large' }, { status: 413 });
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    if (!token) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const db = serverDb(token);
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Your session expired. Reload to reconnect.' }, { status: 401 });
    const raw = await request.text();
    if (raw.length > 20000) return NextResponse.json({ error: 'Message too large' }, { status: 413 });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid message' }, { status: 400 }); }
    const body = schema.safeParse(parsed);
    if (!body.success) return NextResponse.json({ error: 'Enter a message of up to 4,000 characters.' }, { status: 400 });
    const { id, roomId, content } = body.data;
    // RLS-gated reads precede service-role writes. The RPC rechecks membership.
    const [{ data: history, error: historyError }, { data: people, error: peopleError }, { data: agents, error: agentsError }] = await Promise.all([
      db.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(40),
      db.from('members').select('display_name').eq('room_id', roomId),
      db.rpc('room_friends', { p_room: roomId })
    ]);
    if (historyError || peopleError || agentsError) throw new Error('Could not read conversation');
    const { data: room, error: roomError } = await db.from('rooms').select('ai_only').eq('id', roomId).single();
    if (roomError) throw new Error('Room not found');
    const route = routeRoomMessage(content, history || [], user.id, (people || []).map(p=>p.display_name), agents || [], room.ai_only);
    const admin = serverDb();
    const { error } = await admin.rpc('submit_routed_message', { p_id: id, p_room: roomId, p_user: user.id, p_content: content, p_routing: route });
    if (error) return NextResponse.json({ error: error.code === 'PGRST202' ? 'Apply the Phase 2 database migration before using this version.' : error.message }, { status: 400 });
    // Use persisted routing, not this retry's newly observed conversation.
    const { data: saved, error: savedError } = await admin.from('messages').select('*').eq('id', id).eq('user_id', user.id).eq('room_id', roomId).single();
    if (savedError || !saved) throw new Error('Could not load submitted request');
    if (saved.routing?.agentId) await generateReply(admin, saved);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: 'Unable to finish sending. Retry safely using the same message.' }, { status: 503 });
  }
}
