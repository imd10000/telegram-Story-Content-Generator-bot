import { ImageResponse } from "@vercel/og";
import React from "react";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
    "post.png"
  );

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
}

async function loadFont() {
  const fontUrl =
    "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf";

  const res = await fetch(fontUrl);
  return await res.arrayBuffer();
}

function PostImage({ title, body, source }) {
  return React.createElement(
    "div",
    {
      style: {
        width: "1080px",
        height: "1080px",
        background: "#0a0a0f",
        color: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        fontFamily: "NotoArabic",
        direction: "rtl",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          background: "#13131f",
          border: "3px solid #f0b429",
          borderRadius: "48px",
          width: "100%",
          height: "100%",
          padding: "70px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            color: "#f0b429",
            fontSize: "34px",
            textAlign: "center",
          },
        },
        "InstaGen Pro"
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "64px",
            fontWeight: "800",
            lineHeight: 1.45,
            textAlign: "center",
          },
        },
        title
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "42px",
            lineHeight: 1.7,
            color: "#d8d8e8",
            textAlign: "center",
          },
        },
        body
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "26px",
            color: "#9090b0",
            textAlign: "center",
          },
        },
        `المصدر: ${source || "مصدر موثوق"}`
      )
    )
  );
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

أعد JSON فقط:
{
  "title": "عنوان قصير",
  "body": "نص قصير داخل الصورة",
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
      await sendMessage(chatId, `خطأ من Claude:\n${data.error?.message}`);
      return res.status(200).json({ ok: false });
    }

    const raw = data.content?.[0]?.text || "{}";
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const content = JSON.parse(jsonText);

    const fontData = await loadFont();

    const image = new ImageResponse(
      React.createElement(PostImage, {
        title: content.title,
        body: content.body,
        source: content.source,
      }),
      {
        width: 1080,
        height: 1080,
        fonts: [
          {
            name: "NotoArabic",
            data: fontData,
            style: "normal",
          },
        ],
      }
    );

    const imageBuffer = Buffer.from(await image.arrayBuffer());

    await sendPhoto(chatId, imageBuffer, content.caption || "");

    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendMessage(chatId, `خطأ:\n${error.message}`);
    return res.status(200).json({ ok: false });
  }
}
