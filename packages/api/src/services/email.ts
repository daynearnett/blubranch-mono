import { Resend } from 'resend';
import { randomInt } from 'node:crypto';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'BluBranch <noreply@blubranch.com>';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generic transactional email for an activity notification (connection
 * request/accept, post like/comment). Best-effort — callers should not block.
 */
export async function sendNotificationEmail(
  to: string,
  title: string,
  body: string,
  link = 'blubranch://',
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] DEV MODE — notification email to ${to}: ${title}`);
    return;
  }
  const base = process.env.PUBLIC_BASE_URL ?? 'https://api-staging.blubranch.com';
  const logo = `${base}/share/logo.png`;
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `🔨 ${title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; text-align: center;">
        <img src="${logo}" width="56" height="56" alt="BluBranch" style="border-radius: 12px;" />
        <h2 style="color: #3D5A80; margin: 16px 0 8px;">${escapeHtml(title)}</h2>
        <p style="color: #5C7A9B; font-size: 15px; line-height: 22px; margin: 0 0 24px;">${escapeHtml(body)}</p>
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #3D5A80; color: #ffffff; padding: 13px 30px; border-radius: 10px; text-decoration: none; font-weight: 700;">Open BluBranch →</a>
        <p style="color: #9AA8B8; font-size: 12px; line-height: 18px; margin-top: 32px;">
          <strong style="color:#3D5A80;">Networking for the Blue Collar.</strong><br />
          Manage which emails you get in BluBranch → Settings → Notifications.
        </p>
      </div>
    `,
  });
}

/**
 * Receipt email after a successful payment (one-time job post or the first
 * month of an Unlimited subscription). Best-effort — never blocks the webhook.
 */
export async function sendReceiptEmail(
  to: string,
  opts: { description: string; amountCents: number; recurring: boolean },
): Promise<void> {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] DEV MODE — receipt to ${to}: ${opts.description} ${amount}`);
    return;
  }
  const base = process.env.PUBLIC_BASE_URL ?? 'https://api-staging.blubranch.com';
  const logo = `${base}/share/logo.png`;
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Your BluBranch receipt — ${amount}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align:center;"><img src="${logo}" width="56" height="56" alt="BluBranch" style="border-radius: 12px;" /></div>
        <h2 style="color: #3D5A80; margin: 16px 0 8px; text-align:center;">Payment received</h2>
        <div style="background:#F5F7FA; border-radius:10px; padding:20px; margin:20px 0;">
          <div style="display:flex; justify-content:space-between; color:#2A3F58; font-size:15px; margin-bottom:8px;">
            <span>${escapeHtml(opts.description)}</span>
          </div>
          <div style="font-size:28px; font-weight:700; color:#0F2D52;">${amount}${opts.recurring ? ' <span style="font-size:14px; font-weight:500; color:#5C7A9B;">/ month</span>' : ''}</div>
        </div>
        <p style="color: #5C7A9B; font-size: 13px; line-height: 19px;">
          ${opts.recurring
            ? 'Your Unlimited plan is active. Manage or cancel anytime in BluBranch → Settings → Billing.'
            : 'Thanks for posting on BluBranch. No refunds after a job goes live.'}
        </p>
        <p style="color: #9AA8B8; font-size: 12px; margin-top: 28px; text-align:center;">
          <strong style="color:#3D5A80;">Networking for the Blue Collar.</strong>
        </p>
      </div>
    `,
  });
}

const codes = new Map<string, { code: string; expiresAt: number }>();

export function generateVerificationCode(email: string): string {
  const code = String(randomInt(100_000, 999_999));
  codes.set(email.toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });
  return code;
}

export function checkVerificationCode(email: string, code: string): boolean {
  const entry = codes.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codes.delete(email.toLowerCase());
    return false;
  }
  if (entry.code !== code) return false;
  codes.delete(email.toLowerCase());
  return true;
}

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] DEV MODE — verification code for ${email}: ${code}`);
    return;
  }

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Your BluBranch verification code',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0F2D52;">Verify your email</h2>
        <p style="color: #2A3F58; font-size: 15px;">Enter this code in the app to verify your email address:</p>
        <div style="background: #F5F7FA; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0F2D52;">${code}</span>
        </div>
        <p style="color: #5C7A9B; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
