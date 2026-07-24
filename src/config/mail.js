const parseFrom = (raw) => {
  const match = /^(.*)<(.+)>$/.exec(raw || "");
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  return { name: "Sports Hub", email: raw || "noreply@sportshub.com" };
};

module.exports = {
  brevoApiKey: process.env.BREVO_API_KEY,
  from: parseFrom(process.env.EMAIL_FROM),
};