const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bot is running");
  }

  const update = req.body;
  const chatId = update.message?.chat?.id;
  const text = update.message?.text || "";

  if (chatId) {
    await sendMessage(chatId, `وصلتني رسالتك ✅\n\nنص الرسالة: ${text}`);
  }

  return res.status(200).json({ ok: true });
}
