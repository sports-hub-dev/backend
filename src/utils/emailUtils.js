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

const sendVerificationEmail = async (to, verifyUrl) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Sports Hub - Verify Your Email</h2>
      <p>Thanks for signing up! Click below to verify your email and activate your account:</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#e94560;color:#fff;text-decoration:none;border-radius:4px;margin:20px 0;">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    </div>
  `;
  return sendEmail({ to, subject: "Sports Hub - Verify Your Email", html });
};

const sendOrderNotificationEmail = async (order) => {
  const itemsHtml = order.items.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}${item.size ? ` (${item.size})` : ""}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${item.price} EGP</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">New Confirmed Order — ${order.orderNumber}</h2>
      <p><strong>Customer:</strong> ${order.customerInfo.name} (${order.customerInfo.email}, ${order.customerInfo.phone})</p>
      <p><strong>Shipping Address:</strong> ${order.shippingAddress.street}, ${order.shippingAddress.area}, ${order.shippingAddress.city}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Item</th><th style="padding:8px;border-bottom:2px solid #333;">Qty</th><th style="text-align:right;padding:8px;border-bottom:2px solid #333;">Price</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="margin-top:16px;"><strong>Total: ${order.total} EGP</strong></p>
      <p>Payment Method: ${order.paymentMethod} | Status: ${order.paymentStatus}</p>
    </div>
  `;

  return sendEmail({ to: process.env.ORDER_NOTIFICATION_EMAIL, subject: `New Order — ${order.orderNumber}`, html });
};

module.exports = { sendEmail, sendPasswordResetEmail, sendVerificationEmail, sendOrderNotificationEmail };