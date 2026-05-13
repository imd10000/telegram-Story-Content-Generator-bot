import sharp from "sharp";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function sendPhoto(chatId, imageBuffer, caption = "") {
  const formData = new FormData();

  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append(
    "photo",
    new Blob([imageBuffer], { type: "image/png" }),
    "instagram-post.png"
  );

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
}

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

function escapeXml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createSvg({ title, body, source }) {
  return `
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1080" fill="#0a0a0f"/>

  <circle cx="120" cy="120" r="220" fill="#f0b429" opacity="0.12"/>
  <circle cx="980" cy="940" r="260" fill="#e8890c" opacity="0.12"/>

  <rect x="70" y="70" width="940" height="940" rx="42" fill="#13131f" stroke="#f0b429" stroke-opacity="0.35" stroke-width="3"/>

  <text x="540" y="180" text-anchor="middle" fill="#f0b429"
    font-size="42" font-weight="700" font-family="Arial">
    📸 InstaGen Pro
  </text>

  <text x="540" y="380" text-anchor="middle" fill="#ffffff"
    font-size="60" font-weight="800" font-family="Arial">
    ${escapeXml(title)}
  </text>

  <foreignObject x="130" y="450" width="820" height="300">
    <div xmlns="http://www.w3.org/1999/xhtml"
      style="color:#d8d8e8;font-size:40px;line-height:1.7;text-align:center;font-family:Arial;direction:rtl;">
      ${escapeXml(body)}
    </div>
  </foreignObject>

  <text x="540" y="910" text-anchor="middle" fill="#9090b0"
    font-size="28" font-family="Arial">
    المصدر: ${escapeXml(source || "مصدر موثوق")}
  </text>
</svg>`;
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
        model: "claude-haiku-4-5",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `
أنشئ محتوى مختصر لصورة إنستقرام عربية عن:
${userText}

أعد JSON فقط بدون شرح:
{
  "title": "عنوان قصير جدًا",
  "body": "نص قصير مناسب داخل الصورة لا يتجاوز سطرين أو ثلاثة",
  "caption": "كابشن قصير",
  "source": "مصدر مقترح"
}
`,
          },
        ],
      }),
    });

    const data = await claudeRes.json();

    if (!claudeRes.ok) {
      await sendMessage(chatId, `❌ خطأ من Claude:\n${data.error?.message}`);
      return res.status(200).json({ ok: false });
    }

    const raw = data.content?.[0]?.text || "{}";
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const content = JSON.parse(jsonText);

    const svg = createSvg({
      title: content.title,
      body: content.body,
      source: content.source,
    });

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    await sendPhoto(chatId, pngBuffer, content.caption || "");

    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendMessage(chatId, `❌ خطأ:\n${error.message}`);
    return res.status(200).json({ ok: false });
  }
}
