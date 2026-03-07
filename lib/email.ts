import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type Flavour = 'general' | 'request_card' | 'request_passport';

const flavourContent: Record<
  Flavour,
  { subject: string; heading: string; body: string; ctaLabel: string }
> = {
  general: {
    subject: 'Please update your travel profile',
    heading: 'Update your travel profile',
    body: 'Your travel advisor has requested that you review and update your travel profile. Click the button below to get started — the link expires in 24 hours.',
    ctaLabel: 'Update my profile',
  },
  request_card: {
    subject: 'Please add your payment card details',
    heading: 'Add your payment card',
    body: 'Your travel advisor has requested your payment card details for an upcoming booking. Click the button below to securely submit your card — the link expires in 24 hours.',
    ctaLabel: 'Add my card',
  },
  request_passport: {
    subject: 'Please add your passport information',
    heading: 'Add your passport details',
    body: 'Your travel advisor has requested your passport information for an upcoming booking. Click the button below to securely submit your passport — the link expires in 24 hours.',
    ctaLabel: 'Add my passport',
  },
};

export async function sendMagicLink(opts: {
  to: string;
  firstName: string;
  magicLink: string;
  orgName: string;
  logoWordmarkUrl?: string | null;
  fromEmail: string;
  flavour: Flavour;
}): Promise<void> {
  const { to, firstName, magicLink, orgName, logoWordmarkUrl, fromEmail, flavour } = opts;
  const content = flavourContent[flavour];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 0;text-align:left;">
              ${logoWordmarkUrl
    ? `<img src="${logoWordmarkUrl}" alt="${orgName}" height="32" style="display:block;margin:0 0 8px;max-width:200px;object-fit:contain;" />`
    : `<p style="margin:0 0 4px;font-size:13px;color:#888;letter-spacing:0.05em;text-transform:uppercase;">${orgName}</p>`
  }
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111;">${content.heading}</h1>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#444;">Hi ${firstName},</p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#444;">${content.body}</p>
              <a href="${magicLink}" style="display:inline-block;background:#b8860b;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;margin-bottom:32px;">${content.ctaLabel}</a>
              <p style="margin:0 0 32px;font-size:13px;color:#888;">If the button doesn&apos;t work, copy and paste this link into your browser:<br /><a href="${magicLink}" style="color:#b8860b;word-break:break-all;">${magicLink}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#999;">${orgName} &mdash; If you did not expect this email, please ignore it or contact your advisor.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject: `${content.subject} — ${orgName}`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
