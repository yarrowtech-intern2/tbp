import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    getNotifications,
    getUnreadNotificationsCount,
    markAllNotificationsRead,
    markNotificationRead,
    markNotificationUnread,
    type AppNotificationRecord,
} from '../lib/destinations';
import { useAuth } from '../hooks/useAuth';
import { NotificationCenterContext, type PushPermissionState } from './notification-context';

const toNotification = (value: Record<string, unknown>): AppNotificationRecord | null => {
    if (typeof value.id !== 'string' || typeof value.user_id !== 'string') return null;
    return {
        id: value.id,
        user_id: value.user_id,
        type: typeof value.type === 'string' ? value.type : 'message_new',
        title: typeof value.title === 'string' ? value.title : 'Notification',
        body: typeof value.body === 'string' ? value.body : null,
        metadata: value.metadata && typeof value.metadata === 'object'
            ? value.metadata as Record<string, unknown>
            : null,
        is_read: value.is_read === true || Boolean(value.read_at),
        read_at: typeof value.read_at === 'string' ? value.read_at : null,
        created_at: typeof value.created_at === 'string' ? value.created_at : undefined,
    };
};

const setByNewest = (rows: AppNotificationRecord[]) => (
    [...rows].sort((a, b) => {
        const left = new Date(a.created_at || 0).getTime();
        const right = new Date(b.created_at || 0).getTime();
        return right - left;
    })
);

export const NotificationCenterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotificationRecord[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [pushPermission, setPushPermission] = useState<PushPermissionState>(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
        return Notification.permission;
    });

    const refresh = useCallback(async (options?: { silent?: boolean }) => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }
        if (!options?.silent) setLoading(true);
        try {
            const [rows, unread] = await Promise.all([
                getNotifications(user.id),
                getUnreadNotificationsCount(user.id),
            ]);
            setNotifications(setByNewest(rows));
            setUnreadCount(unread);
        } finally {
            if (!options?.silent) setLoading(false);
        }
    }, [user]);

    const requestPushPermission = useCallback(async (): Promise<PushPermissionState> => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            setPushPermission('unsupported');
            return 'unsupported';
        }
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        return permission;
    }, []);

    const markAsRead = useCallback(async (notificationId: string) => {
        if (!user || !notificationId) return;
        const alreadyRead = notifications.find((item) => item.id === notificationId)?.is_read;
        setNotifications((current) => current.map((item) => (
            item.id === notificationId ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
        )));
        setUnreadCount((current) => (alreadyRead ? current : Math.max(0, current - 1)));
        try {
            await markNotificationRead(user.id, notificationId);
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            await refresh();
        }
    }, [notifications, refresh, user]);

    const markAsUnread = useCallback(async (notificationId: string) => {
        if (!user || !notificationId) return;
        const wasRead = notifications.find((item) => item.id === notificationId)?.is_read;
        setNotifications((current) => current.map((item) => (
            item.id === notificationId ? { ...item, is_read: false, read_at: null } : item
        )));
        setUnreadCount((current) => (wasRead ? current + 1 : current));
        try {
            await markNotificationUnread(user.id, notificationId);
        } catch (error) {
            console.error('Failed to mark notification as unread:', error);
            await refresh();
        }
    }, [notifications, refresh, user]);

    const markAllAsRead = useCallback(async () => {
        if (!user) return;
        setNotifications((current) => current.map((item) => (
            item.is_read ? item : { ...item, is_read: true, read_at: new Date().toISOString() }
        )));
        setUnreadCount(0);
        try {
            await markAllNotificationsRead(user.id);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
            await refresh();
        }
    }, [refresh, user]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                const incoming = toNotification(payload.new as Record<string, unknown>);
                if (!incoming) return;

                setNotifications((current) => {
                    const next = [incoming, ...current.filter((item) => item.id !== incoming.id)];
                    const sorted = setByNewest(next);
                    setUnreadCount(sorted.filter((item) => !item.is_read).length);
                    return sorted;
                });

                if (
                    typeof window !== 'undefined'
                    && 'Notification' in window
                    && Notification.permission === 'granted'
                    && document.visibilityState !== 'visible'
                ) {
                    try {
                        const body = incoming.body ? { body: incoming.body } : undefined;
                        new Notification(incoming.title, { tag: incoming.id, ...body });
                    } catch (error) {
                        console.warn('Browser notification failed:', error);
                    }
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                const incoming = toNotification(payload.new as Record<string, unknown>);
                if (!incoming) return;
                setNotifications((current) => {
                    const next = current.some((item) => item.id === incoming.id)
                        ? current.map((item) => (item.id === incoming.id ? { ...item, ...incoming } : item))
                        : [incoming, ...current];
                    const sorted = setByNewest(next);
                    setUnreadCount(sorted.filter((item) => !item.is_read).length);
                    return sorted;
                });
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const interval = window.setInterval(() => {
            void refresh({ silent: true });
        }, 10000);
        return () => {
            window.clearInterval(interval);
        };
    }, [refresh, user]);

    useEffect(() => {
        if (!user) return;
        const onFocus = () => {
            void refresh({ silent: true });
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [refresh, user]);

    useEffect(() => {
        if (!user || typeof window === 'undefined' || !('Notification' in window)) return;
        setPushPermission(Notification.permission);
        if (Notification.permission !== 'default') return;
        const key = `tbp_push_prompted_${user.id}`;
        if (window.localStorage.getItem(key) === '1') return;
        window.localStorage.setItem(key, '1');
        void requestPushPermission();
    }, [requestPushPermission, user]);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        loading,
        pushPermission,
        refresh,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        requestPushPermission,
    }), [
        loading,
        markAllAsRead,
        markAsRead,
        markAsUnread,
        notifications,
        pushPermission,
        refresh,
        requestPushPermission,
        unreadCount,
    ]);

    return (
        <NotificationCenterContext.Provider value={value}>
            {children}
        </NotificationCenterContext.Provider>
    );
};
