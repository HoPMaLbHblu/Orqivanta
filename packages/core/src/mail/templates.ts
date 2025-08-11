import { config } from '../config';

export type Locale = 'en' | 'ru';

export type EmailTemplate =
  | { template: 'verify_email'; data: { name: string; url: string } }
  | { template: 'reset_password'; data: { name: string; url: string } }
  | { template: 'password_changed'; data: { name: string } }
  | { template: 'account_exists'; data: { name: string; signInUrl: string; resetUrl: string } }
  | {
      template: 'invitation';
      data: { inviterName: string; orgName: string; roleLabel: string; url: string; message?: string | null };
    }
  | {
      template: 'notification';
      data: { title: string; body?: string | null; url: string; orgName: string; category: string };
    };

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(opts: { preheader: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footer: string }) {
  const ps = opts.paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6">${esc(p)}</p>`).join('');
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${esc(opts.cta.url)}" style="background:#0F6E64;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${esc(opts.cta.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#6B655C;word-break:break-all">${esc(opts.cta.url)}</p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#FAF8F5;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1C1A17">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #E8E2D8;border-radius:12px"><tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:700;letter-spacing:-0.01em;color:#0F6E64">Orqivanta</p>
<h1 style="font-size:22px;margin:0 0 16px;font-weight:600">${esc(opts.heading)}</h1>
${ps}${cta}
</td></tr></table>
<p style="font-size:12px;color:#8A8378;margin:16px 0 0">${esc(opts.footer)}</p>
</td></tr></table></body></html>`;
  const text = [opts.heading, '', ...opts.paragraphs, ...(opts.cta ? ['', `${opts.cta.label}: ${opts.cta.url}`] : []), '', opts.footer].join('\n');
  return { html, text };
}

const t = {
  en: {
    footer: 'You received this email because of your Orqivanta account.',
    verify: (n: string) => ({
      subject: 'Confirm your email for Orqivanta',
      heading: `Welcome, ${n}`,
      p: ['Confirm your email address to finish setting up your account. The link is valid for 48 hours.'],
      cta: 'Confirm email',
    }),
    reset: (n: string) => ({
      subject: 'Reset your Orqivanta password',
      heading: `Reset your password, ${n}`,
      p: ['Someone asked to reset the password for this account. If it was you, use the link below within 60 minutes. If not, you can ignore this email.'],
      cta: 'Choose a new password',
    }),
    changed: (n: string) => ({
      subject: 'Your Orqivanta password was changed',
      heading: `Password changed, ${n}`,
      p: ['Your password was just changed and other sessions were signed out. If this wasn’t you, reset your password immediately.'],
    }),
    exists: (n: string) => ({
      subject: 'You already have an Orqivanta account',
      heading: `Hi ${n}, you already have an account`,
      p: ['Someone tried to create a new account with this email address. If it was you, sign in instead, or reset your password if you’ve forgotten it. If it wasn’t you, no action is needed.'],
      cta: 'Sign in',
      reset: 'Reset password',
    }),
    invite: (d: { inviterName: string; orgName: string; roleLabel: string; message?: string | null }) => ({
      subject: `${d.inviterName} invited you to ${d.orgName} on Orqivanta`,
      heading: `Join ${d.orgName}`,
      p: [
        `${d.inviterName} invited you to join ${d.orgName} as ${d.roleLabel}.`,
        ...(d.message ? [`“${d.message}”`] : []),
        'The invitation expires in 7 days.',
      ],
      cta: 'Accept invitation',
    }),
    notificationFooter: (org: string) => `Sent by ${org} on Orqivanta. Change which emails you receive in Account → Notifications.`,
    open: 'Open in Orqivanta',
  },
  ru: {
    footer: 'Вы получили это письмо, потому что у вас есть аккаунт Orqivanta.',
    verify: (n: string) => ({
      subject: 'Подтвердите email для Orqivanta',
      heading: `Добро пожаловать, ${n}`,
      p: ['Подтвердите адрес электронной почты, чтобы завершить настройку аккаунта. Ссылка действует 48 часов.'],
      cta: 'Подтвердить email',
    }),
    reset: (n: string) => ({
      subject: 'Сброс пароля Orqivanta',
      heading: `Сброс пароля, ${n}`,
      p: ['Кто-то запросил сброс пароля для этого аккаунта. Если это были вы, перейдите по ссылке в течение 60 минут. Иначе просто проигнорируйте письмо.'],
      cta: 'Задать новый пароль',
    }),
    changed: (n: string) => ({
      subject: 'Пароль Orqivanta изменён',
      heading: `Пароль изменён, ${n}`,
      p: ['Ваш пароль только что изменили, другие сеансы завершены. Если это были не вы, немедленно сбросьте пароль.'],
    }),
    exists: (n: string) => ({
      subject: 'У вас уже есть аккаунт Orqivanta',
      heading: `${n}, у вас уже есть аккаунт`,
      p: ['Кто-то попытался создать новый аккаунт с этим адресом. Если это были вы, просто войдите или сбросьте пароль. Если нет, ничего делать не нужно.'],
      cta: 'Войти',
      reset: 'Сбросить пароль',
    }),
    invite: (d: { inviterName: string; orgName: string; roleLabel: string; message?: string | null }) => ({
      subject: `${d.inviterName} приглашает вас в ${d.orgName} на Orqivanta`,
      heading: `Присоединяйтесь к ${d.orgName}`,
      p: [
        `${d.inviterName} приглашает вас в ${d.orgName} с ролью «${d.roleLabel}».`,
        ...(d.message ? [`«${d.message}»`] : []),
        'Приглашение действует 7 дней.',
      ],
      cta: 'Принять приглашение',
    }),
    notificationFooter: (org: string) => `Отправлено ${org} через Orqivanta. Настроить письма можно в разделе Аккаунт → Уведомления.`,
    open: 'Открыть в Orqivanta',
  },
};

export function renderEmail(input: EmailTemplate, locale: Locale = 'en'): RenderedEmail {
  const l = t[locale] ?? t.en;
  switch (input.template) {
    case 'verify_email': {
      const c = l.verify(input.data.name);
      return { subject: c.subject, ...layout({ preheader: c.p[0]!, heading: c.heading, paragraphs: c.p, cta: { label: c.cta, url: input.data.url }, footer: l.footer }) };
    }
    case 'reset_password': {
      const c = l.reset(input.data.name);
      return { subject: c.subject, ...layout({ preheader: c.p[0]!, heading: c.heading, paragraphs: c.p, cta: { label: c.cta, url: input.data.url }, footer: l.footer }) };
    }
    case 'password_changed': {
      const c = l.changed(input.data.name);
      return { subject: c.subject, ...layout({ preheader: c.p[0]!, heading: c.heading, paragraphs: c.p, footer: l.footer }) };
    }
    case 'account_exists': {
      const c = l.exists(input.data.name);
      const r = layout({ preheader: c.p[0]!, heading: c.heading, paragraphs: [...c.p, `${c.reset}: ${input.data.resetUrl}`], cta: { label: c.cta, url: input.data.signInUrl }, footer: l.footer });
      return { subject: c.subject, ...r };
    }
    case 'invitation': {
      const c = l.invite(input.data);
      return { subject: c.subject, ...layout({ preheader: c.p[0]!, heading: c.heading, paragraphs: c.p, cta: { label: c.cta, url: input.data.url }, footer: l.footer }) };
    }
    case 'notification': {
      const d = input.data;
      const url = d.url.startsWith('http') ? d.url : `${config.appUrl}${d.url}`;
      return {
        subject: d.title,
        ...layout({ preheader: d.body ?? d.title, heading: d.title, paragraphs: d.body ? [d.body] : [], cta: { label: l.open, url }, footer: l.notificationFooter(d.orgName) }),
      };
    }
  }
}
