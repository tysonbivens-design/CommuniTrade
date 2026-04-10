'use client'
import { useState, useEffect, useRef } from 'react'
import Avatar from './Avatar'
import type { AppCtx } from '@/types'

interface ConversationItem {
  id: string
  context_type: string
  context_id: string | null
  last_message: string | null
  last_message_at: string | null
  participant_a: string
  participant_b: string
  profile_a: { full_name: string | null; avatar_color: string | null; avatar_url: string | null } | null
  profile_b: { full_name: string | null; avatar_color: string | null; avatar_url: string | null } | null
  unread_count: number
}

interface Message {
  id: string
  body: string
  sender_id: string
  read: boolean
  created_at: string
}

interface MessagesPageProps {
  ctx: AppCtx
  initialConversationId?: string | null
}

export default function MessagesPage({ ctx, initialConversationId }: MessagesPageProps) {
  const { user, showToast } = ctx
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    loadConversations()
  }, [userId])

  useEffect(() => {
    if (initialConversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === initialConversationId)
      if (conv) setActiveConv(conv)
    }
  }, [initialConversationId, conversations])

  useEffect(() => {
    if (activeConv) loadMessages(activeConv.id)
  }, [activeConv])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    setLoading(true)
    const res = await fetch(`/api/messages?userId=${userId}`)
    const data = await res.json()
    if (data.conversations) setConversations(data.conversations)
    setLoading(false)
  }

  async function loadMessages(convId: string) {
    const res = await fetch(`/api/messages?userId=${userId}&conversationId=${convId}`)
    const data = await res.json()
    if (data.messages) {
      setMessages(data.messages)
      // Mark as read locally
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeConv || !userId) return
    setSending(true)
    const recipientId = activeConv.participant_a === userId ? activeConv.participant_b : activeConv.participant_a

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: userId,
        recipientId,
        body: newMessage.trim(),
        contextType: activeConv.context_type,
        contextId: activeConv.context_id,
      }),
    })

    const data = await res.json()
    if (!res.ok) { showToast(data.error || 'Could not send message.', 'error'); setSending(false); return }

    setMessages(prev => [...prev, data.message])
    setNewMessage('')
    setConversations(prev => prev.map(c => c.id === activeConv.id
      ? { ...c, last_message: newMessage.trim(), last_message_at: new Date().toISOString() }
      : c
    ))
    setSending(false)
  }

  if (!userId) {
    return (
      <div className="container">
        <div className="section" style={{ textAlign: 'center', padding: '5rem' }}>
          <h2>Sign in to view your messages</h2>
        </div>
      </div>
    )
  }

  function getOtherProfile(conv: ConversationItem) {
    return conv.participant_a === userId ? conv.profile_b : conv.profile_a
  }

  function formatTime(d: string) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const CONTEXT_LABEL: Record<string, string> = {
    loan: 'Loan',
    barter: 'Barter',
    feedback: 'Feedback',
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="container">
        <div className="section">
          <h1 className="section-title">Messages</h1>
          <p className="section-subtitle">Your conversations with neighbors</p>

          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Loading...</p>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
              <h3 style={{ fontFamily: 'Fraunces, serif', marginBottom: '0.5rem' }}>No messages yet</h3>
              <p>Start a conversation from a loan or barter match.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: activeConv ? '280px 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>

              {/* Conversation list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {conversations.map(conv => {
                  const other = getOtherProfile(conv)
                  const isActive = activeConv?.id === conv.id
                  return (
                    <div
                      key={conv.id}
                      onClick={() => setActiveConv(conv)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.85rem 1rem', borderRadius: 10, cursor: 'pointer',
                        background: isActive ? 'var(--rust)' : '#fff',
                        border: `1.5px solid ${isActive ? 'var(--rust)' : 'var(--border)'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Avatar name={other?.full_name} avatarUrl={other?.avatar_url} color={other?.avatar_color} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: isActive ? '#fff' : 'var(--bark)' }}>
                            {other?.full_name || 'Neighbor'}
                          </span>
                          {conv.unread_count > 0 && (
                            <span style={{ background: isActive ? '#fff' : 'var(--rust)', color: isActive ? 'var(--rust)' : '#fff', borderRadius: 10, padding: '0.05rem 0.4rem', fontSize: '0.7rem', fontWeight: 700 }}>
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {CONTEXT_LABEL[conv.context_type]} · {conv.last_message || 'No messages yet'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Thread view */}
              {activeConv && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid var(--border)', display: 'flex', flexDirection: 'column', height: 480 }}>
                  {/* Header */}
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Avatar name={getOtherProfile(activeConv)?.full_name} avatarUrl={getOtherProfile(activeConv)?.avatar_url} color={getOtherProfile(activeConv)?.avatar_color} size={32} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{getOtherProfile(activeConv)?.full_name || 'Neighbor'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{CONTEXT_LABEL[activeConv.context_type]}</div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {messages.length === 0 ? (
                      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>No messages yet. Say hello!</p>
                    ) : messages.map(msg => {
                      const isMine = msg.sender_id === userId
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '75%', padding: '0.6rem 0.85rem', borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                            background: isMine ? 'var(--rust)' : 'var(--cream)',
                            color: isMine ? '#fff' : 'var(--bark)',
                            fontSize: '0.88rem', lineHeight: 1.5,
                          }}>
                            {msg.body}
                            <div style={{ fontSize: '0.68rem', opacity: 0.65, marginTop: '0.2rem', textAlign: 'right' }}>
                              {formatTime(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Type a message..."
                      style={{
                        flex: 1, padding: '0.6rem 0.85rem', borderRadius: 20,
                        border: '1.5px solid var(--border)', fontFamily: 'DM Sans, sans-serif',
                        fontSize: '0.88rem', outline: 'none', color: 'var(--bark)', background: 'var(--cream)',
                      }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="btn btn-primary btn-sm"
                      style={{ borderRadius: 20, padding: '0.6rem 1.1rem' }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
