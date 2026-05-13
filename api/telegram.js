import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

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

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildHtml({ title, body, source }) {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    width: 1080px;
    height: 1080px;
    font-family: 'Cairo', Arial, sans-serif;
    background: #0a0a0f;
    color: #ffffff;
  }

  .canvas {
    width: 1080px;
    height: 1080px;
    padding: 70px;
    background:
      radial-gradient(circle at 10% 10%, rgba(240,180,41,.22), transparent 28%),
      radial-gradient(circle at 90% 90%, rgba(232,137,12,.18), transparent 30%),
      #0a0a0f;
  }

  .card {
    width: 100%;
    height: 100%;
    border-radius: 52px;
    background: linear-gradient(145deg, #13131f, #090910);
    border: 3px solid rgba(240,180,41,.45);
    padding: 70px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 30px 80px rgba(0,0,0,.55);
  }

  .brand {
    text-align: center;
    color: #f0b429;
    font-size: 34px;
    font-weight: 900;
    letter-spacing: .5px;
  }

  .label {
    display: inline-block;
    margin: 0 auto;
    padding: 12px 28px;
    border-radius: 999px;
    background: rgba(240,180,41,.12);
    border: 1px solid rgba(240,180,41,.35);
    color: #f0b429;
    font-size: 28px;
    font-weight: 800;
  }

  .title {
    text-align: center;
    font-size: 66px;
    font-weight: 900;
    line-height: 1.35;
    color: #ffffff;
    margin-top: 20px;
  }

  .body {
    text-align: center;
    font-size: 42px;
    font-weight: 600;
    line-height: 1.75;
    color: #dddded;
  }

  .source {
    text-align: center;
    font-size: 27px;
    color: #9090b0;
    border-top: 1px solid rgba(240,180,41,.25);
    padding-top: 30px;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="card">
      <div class="brand">InstaGen Pro</div>
      <div class="label">معلومة مختصرة</div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="body">${escapeHtml(body)}</div>
      <div class="source">المصدر: ${escapeHtml(source || "مصدر موثوق")}</div>
    </div>
  </div>
</body>
</html>
`;
}

async function generateImage(content) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_URL),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(buildHtml(content), { waitUntil: "networkidle0" });

    return await page.screenshot({
      type: "png",
      fullPage: false,
    });
  } finally {
    await browser.close();
  }
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
أنشئ محتوى عربي قصير مناسب لصورة إنستقرام عن:
${userText}

أعد JSON فقط بدون أي شرح:
{
  "title": "عنوان قصير جدًا",
  "body": "نص عربي مختصر داخل الصورة لا يتجاوز 20 كلمة",
  "caption": "كابشن قصير مناسب للنشر",
  "source": "مصدر مقترح"
}
`,
          },
        ],
      }),
    });

    const data = await claudeRes.json();

    if (!claudeRes.ok) {
      await sendMessage(chatId, `خطأ من Claude:\n${data.error?.message}`);
      return res.status(200).json({ ok: false });
    }

    const raw = data.content?.[0]?.text || "{}";
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const content = JSON.parse(jsonText);

    const imageBuffer = await generateImage(content);

    await sendPhoto(chatId, imageBuffer, content.caption || "");

    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendMessage(chatId, `خطأ:\n${error.message}`);
    return res.status(200).json({ ok: false });
  }
}
