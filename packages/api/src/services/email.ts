import { Resend } from 'resend';
import { randomInt } from 'node:crypto';

const resend = new Resend(process.env.RESEND_API_KEY ?? '');

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'BluBranch <noreply@blubranch.com>';

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

  await resend.emails.send({
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
