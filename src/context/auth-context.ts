import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../lib/destinations';

export interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    profileLoading: boolean;
    roleLabel: string;
    verificationLabel: string;
    isProvider: boolean;
    isAdmin: boolean;
    refreshProfile: () => Promise<void>;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
