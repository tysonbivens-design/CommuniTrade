import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getIp } from '@/lib/ratelimit'
import { sendPushToUser } from '@/lib/webpush'
import { APP_URL } from '@/lib/email'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MSG_LIMIT = 60
const MSG_WINDOW = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  if (!rateLimit(ip, MSG_LIMIT, MSG_WINDOW)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  try {
    const { senderId, recipientId, body, contextType, contextId } = await req.json()

    if (!senderId || !recipientId || !body?.trim() || !contextType) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // Find or create conversation
    const participantA = senderId < recipientId ? senderId : recipientId
    const participantB = senderId < recipientId ? recipientId : senderId

    let { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('participant_a', participantA)
      .eq('participant_b', participantB)
      .eq('context_type', contextType)
      .eq('context_id', contextId ?? null)
      .single()

    if (!conv) {
      const { data: newConv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .insert({
          participant_a: participantA,
          participant_b: participantB,
          context_type: contextType,
          context_id: contextId ?? null,
          last_message: body.trim(),
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (convErr || !newConv) {
        return NextResponse.json({ error: 'Could not create conversation.' }, { status: 500 })
      }
      conv = newConv
    } else {
      await supabaseAdmin
        .from('conversations')
        .update({ last_message: body.trim(), last_message_at: new Date().toISOString() })
        .eq('id', conv.id)
    }

    // Insert message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert({ conversation_id: conv.id, sender_id: senderId, body: body.trim() })
      .select('id, body, created_at')
      .single()

    if (msgErr || !message) {
      return NextResponse.json({ error: 'Could not send message.' }, { status: 500 })
    }

    // In-app notification for recipient
    const { data: sender } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', senderId)
      .single()

    await supabaseAdmin.from('notifications').insert({
      user_id: recipientId,
      type: 'loan_request',
      title: `New message from ${sender?.full_name || 'a neighbor'}`,
      body: body.trim().slice(0, 100),
      data: { page: 'messages', conversation_id: conv.id },
    }).catch(() => {})

    // Push notification
    sendPushToUser(recipientId, {
      title: `${sender?.full_name || 'A neighbor'} sent you a message`,
      body: body.trim().slice(0, 100),
      url: `${APP_URL}?page=messages`,
    }).catch(() => {})

    return NextResponse.json({ ok: true, conversationId: conv.id, message })
  } catch (err: unknown) {
    console.error('Messages route error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const conversationId = searchParams.get('conversationId')

  if (!userId) return NextResponse.json({ error: 'Missing userId.' }, { status: 400 })

  if (conversationId) {
    // Fetch messages for a conversation
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, body, sender_id, read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mark messages as read for this user
    await supabaseAdmin
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)

    return NextResponse.json({ messages: data })
  }

  // Fetch all conversations for user
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, context_type, context_id, last_message, last_message_at, participant_a, participant_b, profile_a:profiles!conversations_participant_a_fkey(full_name, avatar_color, avatar_url), profile_b:profiles!conversations_participant_b_fkey(full_name, avatar_color, avatar_url)')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count unread messages per conversation
  const { data: unread } = await supabaseAdmin
    .from('messages')
    .select('conversation_id')
    .eq('read', false)
    .neq('sender_id', userId)

  const unreadCounts: Record<string, number> = {}
  for (const m of unread || []) {
    unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1
  }

  return NextResponse.json({
    conversations: (data || []).map(c => ({ ...c, unread_count: unreadCounts[c.id] || 0 }))
  })
}
