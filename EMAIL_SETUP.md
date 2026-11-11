
---

FILE: EMAIL_SETUP.md

```markdown
# 📧 Parent Email Notification Setup Guide (Nodemailer / SMTP)

This guide covers SMTP configuration for delivering professional HTML academic performance scorecards to parents.

---

## 🛠️ Supported SMTP Providers

Nodemailer supports standard SMTP providers:
- **Gmail / Google Workspace SMTP**
- **SendGrid / Mailgun / Brevo (Sendinblue)**
- **Amazon SES**
- **Custom Institutional SMTP Server**

---

## ⚙️ Setting Up Gmail SMTP

1. Go to your **Google Account** > **Security**.
2. Enable **2-Step Verification**.
3. Under *2-Step Verification*, go to **App Passwords**.
4. Generate a 16-character App Password (e.g. `abcd efgh ijkl mnop`).
5. Fill in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_school_email@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_FROM="The City School Management" <no-reply@school.com>