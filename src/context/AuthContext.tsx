import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { createOrUpdateProfileFromSignup, getProfile } from '../lib/destinations';
import type { Profile, SignupInput } from '../lib/destinations';
import { clearOAuthIntent, getOAuthIntent, isGoogleTouristSignupIntent } from '../lib/oauthIntent';
import { getRoleLabel, getVerificationLabel, isProviderRole, type UserRole } from '../lib/platform';
import { AuthContext } from './auth-context';

const parseAuthRole = (value: unknown): UserRole | null => {
    if (
        value === 'tourist'
        || value === 'tour_company'
        || value === 'tour_instructor'
        || value === 'tour_guide'
        || value === 'admin'
    ) {
        return value;
    }
    return null;
};

const metadataString = (metadata: User['user_metadata'], key: string) => {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim() ? value : null;
};

const metadataBoolean = (metadata: User['user_metadata'], key: string) => metadata?.[key] === true;

const metadataNumberString = (metadata: User['user_metadata'], key: string) => {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return typeof value === 'string' ? value : '';
};

const metadataFullName = (metadata: User['user_metadata']) => (
    metadataString(metadata, 'full_name') || metadataString(metadata, 'name')
);

const signupInputFromAuthMetadata = (nextUser: User, role: UserRole, fallbackName?: string | null): SignupInput => {
    const metadata = nextUser.user_metadata;

    return {
        fullName: metadataFullName(metadata) || fallbackName || nextUser.email?.split('@')[0] || 'Member',
        email: nextUser.email || '',
        password: '',
        role,
        phone: metadataString(metadata, 'phone') || '',
        country: metadataString(metadata, 'country') || '',
        city: metadataString(metadata, 'city') || '',
        bio: metadataString(metadata, 'bio') || '',
        companyName: metadataString(metadata, 'company_name') || '',
        registrationNumber: metadataString(metadata, 'registration_number') || '',
        website: metadataString(metadata, 'website') || '',
        specialties: metadataString(metadata, 'specialties') || '',
        licenseNumber: metadataString(metadata, 'license_number') || '',
        languages: metadataString(metadata, 'languages') || '',
        yearsExperience: metadataNumberString(metadata, 'years_experience'),
        governmentId: metadataString(metadata, 'government_id_ref') || '',
        certificateId: metadataString(metadata, 'certificate_id') || '',
        worksUnderCompany: metadataBoolean(metadata, 'works_under_company'),
    };
};

const signupInputFromGoogleTouristIntent = (
    nextUser: User,
    profile: Profile | null,
    intent: ReturnType<typeof getOAuthIntent>
): SignupInput => {
    const metadata = nextUser.user_metadata;

    return {
        fullName: intent?.fullName || profile?.full_name || metadataFullName(metadata) || nextUser.email?.split('@')[0] || 'Tourist',
        email: nextUser.email || profile?.email || '',
        password: '',
        role: 'tourist',
        phone: intent?.phone || profile?.phone || metadataString(metadata, 'phone') || '',
        country: intent?.country || profile?.country || metadataString(metadata, 'country') || '',
        city: intent?.city || profile?.city || metadataString(metadata, 'city') || '',
        bio: intent?.bio || profile?.bio || metadataString(metadata, 'bio') || '',
        companyName: '',
        registrationNumber: '',
        website: profile?.website || metadataString(metadata, 'website') || '',
        specialties: '',
        licenseNumber: '',
        languages: Array.isArray(profile?.languages)
            ? profile.languages.join(', ')
            : typeof profile?.languages === 'string'
                ? profile.languages
                : '',
        yearsExperience: typeof profile?.years_experience === 'number' ? String(profile.years_experience) : '',
        governmentId: '',
        certificateId: profile?.certificate_id || '',
        worksUnderCompany: false,
    };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);

    const loadProfile = async (nextUser: User | null) => {
        if (!nextUser) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        setProfileLoading(true);
        try {
            let currentUser = nextUser;
            let profileData = await getProfile(currentUser.id);
            const oauthIntent = getOAuthIntent();
            const pendingGoogleTouristSignup = isGoogleTouristSignupIntent(oauthIntent);

            let authRole = parseAuthRole(currentUser.user_metadata?.role);
            const providerRoleFromAuth = isProviderRole(authRole) ? authRole : null;
            const profileRole = parseAuthRole(profileData?.role);

            if (pendingGoogleTouristSignup && !authRole && !profileRole) {
                try {
                    const { data: updatedUserData, error: updateUserError } = await supabase.auth.updateUser({
                        data: {
                            ...currentUser.user_metadata,
                            role: 'tourist',
                            full_name: oauthIntent.fullName || metadataFullName(currentUser.user_metadata) || currentUser.email?.split('@')[0] || 'Tourist',
                            phone: oauthIntent.phone || metadataString(currentUser.user_metadata, 'phone') || '',
                            country: oauthIntent.country || metadataString(currentUser.user_metadata, 'country') || '',
                            city: oauthIntent.city || metadataString(currentUser.user_metadata, 'city') || '',
                            bio: oauthIntent.bio || metadataString(currentUser.user_metadata, 'bio') || '',
                        },
                    });

                    if (updateUserError) throw updateUserError;
                    if (updatedUserData.user) {
                        currentUser = updatedUserData.user;
                        setUser(updatedUserData.user);
                        authRole = parseAuthRole(updatedUserData.user.user_metadata?.role);
                    }
                } catch (error) {
                    console.error('Failed applying Google tourist signup metadata:', error);
                }
            }

            const shouldBootstrapGoogleTouristProfile = pendingGoogleTouristSignup
                && profileData?.role !== 'admin'
                && !isProviderRole(profileData?.role)
                && profileRole !== 'tourist';

            if (shouldBootstrapGoogleTouristProfile) {
                try {
                    await createOrUpdateProfileFromSignup(
                        currentUser.id,
                        signupInputFromGoogleTouristIntent(currentUser, profileData, oauthIntent)
                    );
                    profileData = await getProfile(currentUser.id);
                } catch (error) {
                    console.error('Failed creating tourist profile from Google signup:', error);
                }
            }

            if (!profileData && authRole) {
                try {
                    await createOrUpdateProfileFromSignup(currentUser.id, signupInputFromAuthMetadata(currentUser, authRole));
                    profileData = await getProfile(currentUser.id);
                } catch (error) {
                    console.error('Failed bootstrapping profile from auth metadata:', error);
                }
            }

            const effectiveProviderRole = isProviderRole(profileData?.role)
                ? profileData.role
                : providerRoleFromAuth;

            if (effectiveProviderRole) {
                try {
                    if (!isProviderRole(profileData?.role)) {
                        await createOrUpdateProfileFromSignup(
                            currentUser.id,
                            signupInputFromAuthMetadata(currentUser, effectiveProviderRole, profileData?.full_name || 'Provider')
                        );
                        profileData = await getProfile(currentUser.id);
                    }
                } catch (error) {
                    console.error('Failed ensuring provider profile:', error);
                }
            }

            if (pendingGoogleTouristSignup && profileData?.role === 'tourist') {
                clearOAuthIntent();
            }

            setProfile(profileData);
        } finally {
            setProfileLoading(false);
        }
    };

    useEffect(() => {
        const syncSessionUser = (sessionUser: User | null) => {
            setUser(sessionUser);
            void loadProfile(sessionUser).finally(() => setLoading(false));
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            syncSessionUser(session?.user ?? null);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            syncSessionUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const refreshProfile = async () => {
        await loadProfile(user);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const authMetadataRole = typeof user?.user_metadata?.role === 'string'
        ? user.user_metadata.role
        : null;

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                loading,
                profileLoading,
                roleLabel: getRoleLabel(profile?.role || authMetadataRole),
                verificationLabel: getVerificationLabel(profile?.verification_status),
                isProvider: isProviderRole(profile?.role),
                isAdmin: profile?.role === 'admin',
                refreshProfile,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
