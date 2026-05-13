import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  return fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("OK");
    }

    const body = req.body;

    const message = body.message;

    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text || "";

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `أنشئ محتوى إنستقرام عربي قصير واحترافي عن:\n${userText}`,
        },
      ],
    });

    const aiText =
      response.content?.[0]?.text ||
      "لم أتمكن من توليد المحتوى.";

    await sendMessage(chatId, aiText);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error(error);

    return res.status(200).json({
      ok: false,
      error: error.message,
    });
  }
}
