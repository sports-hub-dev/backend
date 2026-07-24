const mailConfig = require("../config/mail");
const logger = require("./logger");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const sendEmail = async ({ to, subject, html }) => {
  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": mailConfig.brevoApiKey,
      },
      body: JSON.stringify({
        sender: mailConfig.from,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Brevo API error (status ${res.status})`);
    }

    logger.info(`Email sent: ${data.messageId}`);
    return data;
  } catch (error) {
    logger.error(`Email send error: ${error.message}`);
    throw error;
  }
};

const sendPasswordResetEmail = async (to, resetToken, resetUrl) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Sports Hub - Password Reset</h2>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="${resetUrl}" 
         style="display:inline-block;padding:12px 24px;background:#e94560;color:#fff;text-decoration:none;border-radius:4px;margin:20px 0;">
        Reset Password
      </a>
      <p>This link expires in <strong>15 minutes</strong>.</p>
      <p>If you did not request this, please ignore this email.</p>
      <hr/>
      <small style="color:#999;">Sports Hub &mdash; Egypt</small>
    </div>
  `;
  return sendEmail({ to, subject: "Sports Hub - Password Reset Request", html });
};

module.exports = { sendEmail, sendPasswordResetEmail };