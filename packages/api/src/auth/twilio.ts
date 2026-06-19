import twilio from 'twilio';

/**
 * Twilio SMS phone verification.
 *
 * If real Twilio credentials are configured, uses Twilio Verify API.
 * Otherwise falls back to an in-memory store + console log (dev/test).
 *
 * The dev fallback is NOT production-safe — set TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID before going live.
 */

const memoryCodes = new Map<string, { code: string; expiresAt: number }>();

/**
 * Normalize a phone number to E.164 (e.g. +13173537345). Twilio Verify rejects
 * bare numbers ("INVALID PARAMETER `to`"). Defaults a 10-digit number to US (+1).
 */
function toE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID,
  );
}

export async function sendVerificationCode(phone: string): Promise<{ devCode?: string }> {
  if (isTwilioConfigured()) {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: toE164(phone), channel: 'sms' });
    return {};
  }
  // Dev fallback
  const code = String(Math.floor(100000 + Math.random() * 900000));
  memoryCodes.set(phone, { code, expiresAt: Date.now() + 10 * 60_000 });
  console.log(`[twilio:dev] verification code for ${phone}: ${code}`);
  return { devCode: code };
}

export async function checkVerificationCode(phone: string, code: string): Promise<boolean> {
  if (isTwilioConfigured()) {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    const result = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: toE164(phone), code });
    return result.status === 'approved';
  }
  // Dev fallback
  const entry = memoryCodes.get(phone);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    memoryCodes.delete(phone);
    return false;
  }
  if (entry.code !== code) return false;
  memoryCodes.delete(phone);
  return true;
}
