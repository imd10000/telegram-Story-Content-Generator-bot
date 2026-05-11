import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bot is running");
  }

  try {
    const update = req.body;
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text || "";

    if (!chatId) {
      return res.status(200).json({ ok: true });
    }

    if (text === "/start") {
      await sendMessage(
        chatId,
        "أهلًا 👋\nاكتب موضوع المحتوى، مثال:\n\nمعلومة صحية عن شرب الماء من مصادر موثوقة"
      );
      return res.status(200).json({ ok: true });
    }

    const prompt = `
أنت خبير محتوى إنستقرام عربي.

المطلوب:
أنشئ محتوى إنستقرام عن هذا الموضوع:
${text}

استخدم أسلوب واضح ومختصر.

أعد النتيجة بهذا الشكل فقط:

العنوان:
...

نص الصورة:
...

الكابشن:
...

الهاشتاقات:
...

المصدر المقترح:
...
`;

    const response = await client.responses.create({
      model: "gpt-5.5",
      input: prompt,
    });

    const output = response.output_text || "لم أستطع توليد المحتوى.";

    await sendMessage(chatId, output);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(200).json({ ok: false });
  }
}
