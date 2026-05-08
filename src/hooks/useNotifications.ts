import { useContext } from 'react';
import { NotificationCenterContext } from '../context/notification-context';

export const useNotifications = () => {
    const context = useContext(NotificationCenterContext);

    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationCenterProvider');
    }

    return context;
};
