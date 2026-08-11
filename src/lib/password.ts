export const PASSWORD_REQUIREMENTS = [
    { key: 'length', label: '8 characters', test: (value: string) => value.length >= 8 },
    { key: 'uppercase', label: 'Capital letter', test: (value: string) => /[A-Z]/.test(value) },
    { key: 'lowercase', label: 'Lowercase letter', test: (value: string) => /[a-z]/.test(value) },
    { key: 'number', label: 'Number', test: (value: string) => /\d/.test(value) },
    { key: 'special', label: 'Special character', test: (value: string) => /[^A-Za-z0-9\s]/.test(value) },
] as const;

export const PASSWORD_REQUIREMENTS_ERROR =
    'Password must include 8 characters, a capital letter, a lowercase letter, a number, and a special character.';

export const PASSWORD_METER_CIRCUMFERENCE = 157.08;

export const getPasswordFormatStatus = (password: string) => {
    const requirements = PASSWORD_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        met: requirement.test(password),
    }));
    const metCount = requirements.filter((requirement) => requirement.met).length;

    return {
        requirements,
        percentage: Math.round((metCount / PASSWORD_REQUIREMENTS.length) * 100),
        isComplete: metCount === PASSWORD_REQUIREMENTS.length,
    };
};
