import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

  try {
    const update = req.body;

    const chatId = update.message?.chat?.id;
    const text = update.message?.text || "";

    if (!chatId) {
      return res.status(200).json({ ok: true });
    }

    await sendMessage(chatId, "⏳ جاري توليد المحتوى...");

    const prompt = `
أنت خبير محتوى إنستقرام عربي.

أنشئ محتوى احترافي عن:
${text}

المطلوب:
1- عنوان جذاب
2- نص قصير للصورة
3- كابشن احترافي
4- هاشتاقات مناسبة
5- ذكر مصدر موثوق
`;

    const response = await client.responses.create({
      model: "gpt-5.5",
      input: prompt,
    });

    const output = response.output_text;

    await sendMessage(chatId, output);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error(error);

    return res.status(200).json({
      ok: false,
      error: error.message,
    });
  }
}
