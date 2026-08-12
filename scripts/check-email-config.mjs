import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return acc;

      const [, key, rawValue] = match;
      const value = rawValue
        .replace(/^['"]|['"]$/g, '')
        .trim();
      acc[key] = value;
      return acc;
    }, {});
};

const env = {
  ...parseEnvFile(envPath),
  ...process.env,
};

const valueOf = (key) => String(env[key] || '').trim();
const required = ['RESEND_API_KEY', 'EMAIL_FROM'];
const missing = required.filter((key) => !valueOf(key));
const issues = [];

if (missing.length) {
  issues.push(`Missing required email key(s): ${missing.join(', ')}`);
}

const from = valueOf('EMAIL_FROM');
if (from && (from.includes('your-domain.com') || !from.includes('@'))) {
  issues.push('EMAIL_FROM must use a real verified sender address or domain.');
}

const resendKey = valueOf('RESEND_API_KEY');
if (resendKey && !resendKey.startsWith('re_')) {
  issues.push('RESEND_API_KEY does not look like a Resend API key.');
}

if (!valueOf('PUBLIC_APP_URL') && !valueOf('VITE_PUBLIC_APP_URL')) {
  console.warn('Warning: PUBLIC_APP_URL/VITE_PUBLIC_APP_URL is missing. Emails can send, but dashboard links may be omitted.');
}

if (issues.length) {
  console.error('Transactional email configuration is incomplete.');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log('Transactional email configuration keys are present.');
}
