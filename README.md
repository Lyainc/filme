# 🎬 FILME

**Make realistic CGV Photoplay premium phototickets right in your browser — free, no signup.**

Loved the phototicket you got at the cinema, or want to design your own? Start with a poster, a ticket screenshot, or a blank ticket, then export a high-resolution image. No install, no account.

👉 **[Try it live](https://filme-web.vercel.app/)**  ·  🇰🇷 [한국어 README](./README.ko.md)

## ✨ Features

- **Mobile first editor** — cream light UI with Pretendard. PC uses the same compact mobile screen.
- **6 design moods** — `Minimal`, `Criterion`, `35mm`, `Editorial`, `Stub`, and `35mm Wide`; four are portrait and two are landscape.
- **Optional poster & manual crop** — upload and crop a poster, or build a posterless ticket.
- **Ticket-screenshot OCR** — upload a screenshot of a real phototicket and AI reads the title, date, and seat to auto-fill the form.
- **Movie search (KOBIS)** — look up titles via the Korean Film Council Open API.
- **Bring-your-own logos** — upload your own theater-chain (CGV, etc.) and format (IMAX, 4DX, …) logos. No logos are bundled, to avoid copyright issues.
- **High-resolution download** — export a print-grade JPEG instantly.

## 🪄 How it works

1. **Pick a mood** — choose a ticket design on the landing screen or in the editor.
2. **Choose a starting point** — upload a poster, scan a real ticket screenshot with OCR, or enter details without a poster.
3. **Fill in details** — search the movie title and add the date, screen, seat, and logos. The preview updates live.
4. **Download** — save the finished ticket as a high-res JPEG.

> 💡 For physical prints, the **CGV Premium** kiosk is recommended — the exported image is tuned for it. Megabox and Lotte Cinema kiosks work too.

## 🛠 Self-hosting

Requires [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env.local   # then fill in the keys below
bun run dev                  # http://localhost:3000
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `KOBIS_API_KEY` | ✅ | Movie search ([get a key here](https://www.kobis.or.kr/kobisopenapi/homepg/main/main.do)) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ (for OCR) | [Google AI Studio](https://aistudio.google.com/apikey) key (Gemini vision) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Production | Rate limiting; local development skips it when unset, while production OCR and ticket sharing fail closed without it |

Use `bun run build` / `bun run start` for production. `bun run typecheck`, `bun run lint`, and `bun run test` mirror the repository checks.

## 🏗 Tech stack

- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **Ticket rendering**: DOM (JSX/CSS) captured with `html-to-image`; `react-image-crop` for poster and stamp cropping
- **OCR / AI**: Gemini 3.1 Flash Lite vision via `ai` SDK v6 + `@ai-sdk/google` (direct Google AI Studio), Zod schemas, Upstash rate limiting
- **Movie data**: KOBIS Open API
- **Package manager**: Bun
- **Testing**: `bun run test` with happy-dom + `@testing-library/react` for interaction tests

## 📄 License

[MIT](./LICENSE)
