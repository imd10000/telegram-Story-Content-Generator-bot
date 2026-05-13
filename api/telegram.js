const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

async function sendPhoto(chatId, imageBuffer, caption = "") {
  const formData = new FormData();

  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append(
    "photo",
    new Blob([imageBuffer], { type: "image/png" }),
    "nano-banana-post.png"
  );

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
}

async function createPromptWithClaude(userText) {
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `
حوّل طلب المستخدم التالي إلى Prompt إنجليزي واضح لتوليد صورة إنستقرام احترافية.

طلب المستخدم:
${userText}

المطلوب:
- Square 1:1 Instagram social media post
- Clean premium visual design
- Suitable for Arabic/Gulf audience
- Use visual elements that represent the topic
- Do not generate long Arabic text inside the image
- Leave clean empty space for future Arabic text overlay
- Modern, professional, high-quality
- No watermark
- Return the prompt only, without explanation
`,
        },
      ],
    }),
  });

  const data = await claudeRes.json();

  if (!claudeRes.ok) {
    throw new Error(data.error?.message || "Claude API error");
  }

  return data.content?.[0]?.text || userText;
}

async function generateImageWithGemini(prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    }),
  });

  const data = await geminiRes.json();

  if (!geminiRes.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }

  const parts = data.candidates?.[0]?.content?.parts || [];

  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart) {
    throw new Error("Gemini did not return an image");
  }

  const base64 = imagePart.inlineData.data;
  return Buffer.from(base64, "base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bot is running");
  }

  const chatId = req.body?.message?.chat?.id;
  const userText = req.body?.message?.text || "";

  if (!chatId) {
    return res.status(200).json({ ok: true });
  }

  try {
    await sendMessage(chatId, "🎨 جاري تصميم الصورة عبر Nano Banana...");

    const imagePrompt = await createPromptWithClaude(userText);

    const imageBuffer = await generateImageWithGemini(imagePrompt);

    await sendPhoto(chatId, imageBuffer, "تم توليد الصورة ✅");

    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendMessage(chatId, `❌ خطأ:\n${error.message}`);
    return res.status(200).json({
      ok: false,
      error: error.message,
    });
  }
}
