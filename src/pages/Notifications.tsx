import React, { useMemo, useState } from 'react';
import { Bell, BellOff, CheckCheck, Loader2, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotificationRecord } from '../lib/destinations';
import './notifications.css';

const formatTime = (iso?: string) => {
    if (!iso) return 'Just now';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

const resolveRoute = (notification: AppNotificationRecord) => {
    const route = notification.metadata?.route;
    if (typeof route === 'string' && route.startsWith('/')) return route;
    if (notification.type === 'message_new' && typeof notification.metadata?.conversation_id === 'string') {
        return `/messages?conversation=${notification.metadata.conversation_id}`;
    }
    if (notification.type.startsWith('listing_')) return '/provider/studio';
    if (notification.type.startsWith('verification_')) return '/profile';
    return '/profile';
};

export const Notifications: React.FC = () => {
    const navigate = useNavigate();
    const {
        notifications,
        unreadCount,
        loading,
        refresh,
        markAsRead,
        markAsUnread,
        markAllAsRead,
    } = useNotifications();
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const filtered = useMemo(() => (
        filter === 'all'
            ? notifications
            : notifications.filter((item) => !item.is_read)
    ), [filter, notifications]);

    return (
        <main className="ntf-page animate-fade">
            <div className="container ntf-shell">
                <header className="ntf-header">
                    <div>
                        <h1>Notifications</h1>
                        <p>Global activity for messages, bookings, payments, and admin reviews.</p>
                    </div>
                    <div className="ntf-actions">
                        <button type="button" className="ntf-btn ntf-btn--ghost" onClick={() => void refresh()}>
                            <RefreshCcw size={15} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            className="ntf-btn ntf-btn--primary"
                            onClick={() => void markAllAsRead()}
                            disabled={!unreadCount}
                        >
                            <CheckCheck size={15} />
                            Mark all read
                        </button>
                    </div>
                </header>

                <section className="ntf-board">
                    <div className="ntf-filter-row">
                        <button
                            type="button"
                            className={`ntf-filter${filter === 'all' ? ' ntf-filter--active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            className={`ntf-filter${filter === 'unread' ? ' ntf-filter--active' : ''}`}
                            onClick={() => setFilter('unread')}
                        >
                            Unread
                            {unreadCount > 0 && <span>{unreadCount}</span>}
                        </button>
                    </div>

                    {loading ? (
                        <div className="ntf-loading">
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="ntf-empty">
                            {filter === 'unread' ? <BellOff size={26} /> : <Bell size={26} />}
                            <strong>{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</strong>
                            <p>New messages, bookings, approvals, and payment updates will appear here.</p>
                        </div>
                    ) : (
                        <div className="ntf-list">
                            {filtered.map((item) => (
                                <article key={item.id} className={`ntf-item${item.is_read ? '' : ' ntf-item--unread'}`}>
                                    <button
                                        type="button"
                                        className="ntf-item-body"
                                        onClick={() => {
                                            if (!item.is_read) {
                                                void markAsRead(item.id);
                                            }
                                            navigate(resolveRoute(item));
                                        }}
                                    >
                                        {!item.is_read && <span className="ntf-dot" aria-hidden />}
                                        <div className="ntf-copy">
                                            <h3>{item.title}</h3>
                                            {item.body && <p>{item.body}</p>}
                                            <time>{formatTime(item.created_at)}</time>
                                        </div>
                                    </button>

                                    <div className="ntf-item-actions">
                                        {item.is_read ? (
                                            <button type="button" onClick={() => void markAsUnread(item.id)}>Mark unread</button>
                                        ) : (
                                            <button type="button" onClick={() => void markAsRead(item.id)}>Mark read</button>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
};
