import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageCircle, Search, Send } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import {
    getConversationMessages,
    getConversations,
    getOrCreateConversation,
    getUserProfileById,
    sendConversationMessage,
    type ConversationMessageRecord,
    type ConversationRecord,
    type Profile,
} from '../lib/destinations';
import './messages.css';

type ConversationListItem = {
    conversation: ConversationRecord;
    otherUserId: string;
    otherProfile: Profile | null;
    lastMessageText: string;
    lastMessageAt: string;
};

const getDisplayName = (profile: Profile | null, fallbackId: string) => (
    profile?.full_name || profile?.email || `User ${fallbackId.slice(0, 8)}`
);

const getAvatarLabel = (profile: Profile | null, fallbackId: string) => {
    const source = profile?.full_name || profile?.email || fallbackId;
    return source.trim().charAt(0).toUpperCase();
};

const formatConversationTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (diffMs < oneDay) {
        return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
    }

    if (diffMs < oneDay * 7) {
        return new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
        }).format(date);
    }

    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
    }).format(date);
};

const formatBubbleTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

const truncate = (value: string, max = 72) => {
    const clean = value.trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 3)}...`;
};

export const Messages: React.FC = () => {
    const { user } = useAuth();
    const { notifications, markAsRead } = useNotifications();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedConversationId = searchParams.get('conversation');
    const targetUserId = searchParams.get('user');

    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [text, setText] = useState('');
    const [query, setQuery] = useState('');
    const [bootstrapError, setBootstrapError] = useState<string | null>(null);
    const [conversations, setConversations] = useState<ConversationListItem[]>([]);
    const [messages, setMessages] = useState<ConversationMessageRecord[]>([]);

    const messageListRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(
        () => conversations.find((item) => item.conversation.id === selectedConversationId) || null,
        [conversations, selectedConversationId]
    );

    const filteredConversations = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return conversations;

        return conversations.filter((item) => {
            const name = getDisplayName(item.otherProfile, item.otherUserId).toLowerCase();
            const preview = item.lastMessageText.toLowerCase();
            const role = (item.otherProfile?.role || '').toLowerCase();
            return name.includes(normalized) || preview.includes(normalized) || role.includes(normalized);
        });
    }, [conversations, query]);

    const loadConversations = useCallback(async () => {
        if (!user) return;
        const rows = await getConversations(user.id);

        const items = await Promise.all(rows.map(async (conversation) => {
            const otherUserId = conversation.traveler_id === user.id
                ? (conversation.provider_id || '')
                : (conversation.traveler_id || '');

            if (!otherUserId) {
                return null;
            }

            const [otherProfile, conversationMessages] = await Promise.all([
                getUserProfileById(otherUserId),
                getConversationMessages(conversation.id),
            ]);

            const latest = conversationMessages[conversationMessages.length - 1];
            const lastMessageText = latest?.body || 'No messages yet. Say hello.';
            const lastMessageAt = latest?.created_at || conversation.created_at || '';

            return {
                conversation,
                otherUserId,
                otherProfile,
                lastMessageText,
                lastMessageAt,
            } as ConversationListItem;
        }));

        const normalized = items
            .filter((item): item is ConversationListItem => Boolean(item))
            .sort((a, b) => {
                const left = new Date(a.lastMessageAt || a.conversation.created_at || 0).getTime();
                const right = new Date(b.lastMessageAt || b.conversation.created_at || 0).getTime();
                return right - left;
            });

        setConversations(normalized);
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const bootstrap = async () => {
            setLoadingConversations(true);
            try {
                setBootstrapError(null);
                if (targetUserId && targetUserId !== user.id) {
                    const conversation = await getOrCreateConversation(user.id, targetUserId);
                    setSearchParams({ conversation: conversation.id }, { replace: true });
                }
                await loadConversations();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Could not open this conversation.';
                setBootstrapError(message);
            } finally {
                setLoadingConversations(false);
            }
        };

        void bootstrap();
    }, [loadConversations, setSearchParams, targetUserId, user]);

    useEffect(() => {
        if (!selectedConversationId) {
            setMessages([]);
            return;
        }

        let active = true;
        const load = async () => {
            if (active) setLoadingMessages(true);
            const rows = await getConversationMessages(selectedConversationId);
            if (!active) return;
            setMessages(rows);
            setLoadingMessages(false);
        };

        void load();

        const interval = window.setInterval(() => {
            void load();
        }, 4000);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [selectedConversationId]);

    useEffect(() => {
        if (!user) return;
        const interval = window.setInterval(() => {
            void loadConversations();
        }, 15000);
        return () => window.clearInterval(interval);
    }, [loadConversations, user]);

    useEffect(() => {
        if (!messageListRef.current) return;
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }, [messages, selectedConversationId]);

    useEffect(() => {
        if (!selectedConversationId || messages.length === 0) return;
        const unreadForConversation = notifications.filter((item) => (
            !item.is_read
            && item.type === 'message_new'
            && item.metadata?.conversation_id === selectedConversationId
        ));
        if (!unreadForConversation.length) return;

        void Promise.all(unreadForConversation.map((item) => markAsRead(item.id)));
    }, [markAsRead, messages.length, notifications, selectedConversationId]);

    const submitCurrentMessage = async () => {
        if (!user || !selectedConversationId || !text.trim()) return;

        setSending(true);
        try {
            await sendConversationMessage({
                conversation_id: selectedConversationId,
                sender_user_id: user.id,
                body: text.trim(),
            });
            setText('');

            const [nextMessages] = await Promise.all([
                getConversationMessages(selectedConversationId),
                loadConversations(),
            ]);

            setMessages(nextMessages);
        } catch (error) {
            console.error(error);
            alert('Failed to send message. Apply the latest SQL policies and retry.');
        } finally {
            setSending(false);
        }
    };

    const handleSend = (event: React.FormEvent) => {
        event.preventDefault();
        void submitCurrentMessage();
    };

    if (!user) return null;

    return (
        <main className="msg-page animate-fade">
            <div className="container msg-shell">
                <header className="msg-page-head">
                    <h1>Messages</h1>
                    <p>Real-time style messaging for bookings, updates, and traveler support.</p>
                </header>

                {bootstrapError && (
                    <div className="msg-empty-thread" style={{ marginBottom: '16px' }}>
                        <MessageCircle size={22} />
                        <p>{bootstrapError}</p>
                    </div>
                )}

                <div className={`msg-layout${selected ? ' msg-layout--thread' : ''}`}>
                    <aside className="msg-sidebar">
                        <div className="msg-sidebar-top">
                            <h2>Inbox</h2>
                            <div className="msg-search">
                                <Search size={15} />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search conversations"
                                />
                            </div>
                        </div>

                        <div className="msg-conversation-list">
                            {loadingConversations ? (
                                <div className="msg-center-state">
                                    <Loader2 className="animate-spin" size={22} />
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <div className="msg-empty-list">
                                    <MessageCircle size={20} />
                                    <p>{conversations.length === 0 ? 'No conversations yet.' : 'No matching conversations.'}</p>
                                </div>
                            ) : (
                                filteredConversations.map((item) => {
                                    const isActive = item.conversation.id === selectedConversationId;
                                    return (
                                        <button
                                            key={item.conversation.id}
                                            type="button"
                                            className={`msg-conversation-item${isActive ? ' msg-conversation-item--active' : ''}`}
                                            onClick={() => setSearchParams({ conversation: item.conversation.id })}
                                        >
                                            <div className="msg-avatar-wrap">
                                                {item.otherProfile?.profile_image_url ? (
                                                    <img
                                                        className="msg-avatar"
                                                        src={item.otherProfile.profile_image_url}
                                                        alt={getDisplayName(item.otherProfile, item.otherUserId)}
                                                    />
                                                ) : (
                                                    <div className="msg-avatar msg-avatar--fallback">
                                                        {getAvatarLabel(item.otherProfile, item.otherUserId)}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="msg-conversation-main">
                                                <div className="msg-conversation-row">
                                                    <strong>{getDisplayName(item.otherProfile, item.otherUserId)}</strong>
                                                    <span>{formatConversationTime(item.lastMessageAt)}</span>
                                                </div>
                                                <div className="msg-conversation-row msg-conversation-row--meta">
                                                    <p>{truncate(item.lastMessageText)}</p>
                                                    <em>{item.otherProfile?.role || 'member'}</em>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <section className="msg-thread">
                        {selected ? (
                            <>
                                <header className="msg-thread-head">
                                    <button
                                        type="button"
                                        className="msg-mobile-back"
                                        onClick={() => setSearchParams({})}
                                    >
                                        <ArrowLeft size={16} />
                                    </button>

                                    <div className="msg-thread-user">
                                        {selected.otherProfile?.profile_image_url ? (
                                            <img
                                                className="msg-avatar"
                                                src={selected.otherProfile.profile_image_url}
                                                alt={getDisplayName(selected.otherProfile, selected.otherUserId)}
                                            />
                                        ) : (
                                            <div className="msg-avatar msg-avatar--fallback">
                                                {getAvatarLabel(selected.otherProfile, selected.otherUserId)}
                                            </div>
                                        )}
                                        <div>
                                            <strong>{getDisplayName(selected.otherProfile, selected.otherUserId)}</strong>
                                            <span>{selected.otherProfile?.role || 'member'}</span>
                                        </div>
                                    </div>

                                    <Link to={`/users/${selected.otherUserId}`} className="msg-profile-link">
                                        View profile
                                    </Link>
                                </header>

                                <div className="msg-thread-body" ref={messageListRef}>
                                    {loadingMessages ? (
                                        <div className="msg-center-state">
                                            <Loader2 className="animate-spin" size={22} />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="msg-empty-thread">
                                            <MessageCircle size={24} />
                                            <p>No messages yet. Start the conversation.</p>
                                        </div>
                                    ) : (
                                        messages.map((message) => {
                                            const mine = message.sender_user_id === user.id;
                                            return (
                                                <div
                                                    key={message.id}
                                                    className={`msg-bubble-row${mine ? ' msg-bubble-row--mine' : ''}`}
                                                >
                                                    <div className={`msg-bubble${mine ? ' msg-bubble--mine' : ''}`}>
                                                        <p>{message.body}</p>
                                                        <time>{formatBubbleTime(message.created_at)}</time>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <form className="msg-composer" onSubmit={handleSend}>
                                    <textarea
                                        value={text}
                                        onChange={(event) => setText(event.target.value)}
                                        onInput={(event) => {
                                            const target = event.currentTarget;
                                            target.style.height = 'auto';
                                            target.style.height = `${Math.min(target.scrollHeight, 140)}px`;
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                if (!sending && text.trim()) {
                                                    void submitCurrentMessage();
                                                }
                                            }
                                        }}
                                        placeholder="Write a message"
                                        rows={1}
                                    />
                                    <button type="submit" disabled={sending || !text.trim()} aria-label="Send message">
                                        {sending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="msg-thread-empty">
                                <MessageCircle size={32} />
                                <h3>Select a conversation</h3>
                                <p>Choose a contact from the inbox to start chatting.</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
};

