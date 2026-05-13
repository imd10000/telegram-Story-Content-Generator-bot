const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
  const userText = update.message?.text || "";

  if (!chatId) {
    return res.status(200).json({ ok: true });
  }

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: `أنشئ محتوى إنستقرام عربي قصير واحترافي عن:\n${userText}\n\nأعد النتيجة بهذا الشكل:\nالعنوان:\nنص الصورة:\nالكابشن:\nالهاشتاقات:\nالمصدر المقترح:`,
          },
        ],
      }),
    });

    const data = await claudeRes.json();

    if (!claudeRes.ok) {
      await sendMessage(
        chatId,
        `❌ خطأ من Claude API:\n${data.error?.message || JSON.stringify(data)}`
      );
      return res.status(200).json({ ok: false });
    }

    const output =
      data.content?.[0]?.text || "لم أستطع توليد المحتوى.";

    await sendMessage(chatId, output);

    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendMessage(chatId, `❌ خطأ في السيرفر:\n${error.message}`);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
