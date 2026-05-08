import { createContext } from 'react';
import type { AppNotificationRecord } from '../lib/destinations';

export type PushPermissionState = NotificationPermission | 'unsupported';

export interface NotificationCenterContextType {
    notifications: AppNotificationRecord[];
    unreadCount: number;
    loading: boolean;
    pushPermission: PushPermissionState;
    refresh: () => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAsUnread: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    requestPushPermission: () => Promise<PushPermissionState>;
}

export const NotificationCenterContext = createContext<NotificationCenterContextType | undefined>(undefined);
