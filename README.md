# 🎬 FILME

**Make realistic CGV Photoplay premium phototickets right in your browser — free, no signup.**

Loved the phototicket you got at the cinema, or want to design your own? Just upload a poster and FILME fills in the movie, theater, and seat details, then exports a high-resolution image. No install, no account.

👉 **[Try it live](https://filme-web.vercel.app/)**  ·  🇰🇷 [한국어 README](./README.ko.md)

<!-- TODO: add a main-screen screenshot or demo GIF (docs/screenshot.png) -->

## ✨ Features

- **4 design moods** — pick a vibe from `Minimal`, `Criterion`, `35mm`, or `Editorial`. The first three are portrait; Editorial is landscape.
- **Poster upload & manual crop** — drop in any image and crop it to the ticket ratio.
- **Ticket-screenshot OCR** — upload a screenshot of a real phototicket and AI reads the title, date, and seat to auto-fill the form.
- **Movie search (KOBIS)** — look up titles via the Korean Film Council Open API.
- **Bring-your-own logos** — upload your own theater-chain (CGV, etc.) and format (IMAX, 4DX, …) logos. No logos are bundled, to avoid copyright issues.
- **High-resolution download** — export a print-grade JPEG instantly.

## 🪄 How it works

1. **Pick a mood** — choose a ticket design at the top.
2. **Add a poster** — upload an image and set the crop. Have a real ticket screenshot? Drop it in and let OCR fill the form in one shot.
3. **Fill in details** — search the movie title and add the date, screen, seat, and logos. The preview updates live.
4. **Download** — save the finished ticket as a high-res JPEG.

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
| `AI_GATEWAY_API_KEY` | ✅ (for OCR) | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key; `VERCEL_OIDC_TOKEN` works in deployed envs |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ⬜ | Rate limiting (recommended in production; skipped locally if unset) |

`bun run build` / `bun run start` for production.

## 🏗 Tech stack

- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **Ticket rendering**: DOM (JSX/CSS) captured with `html-to-image`; `react-easy-crop` for poster cropping
- **OCR / AI**: GPT-4o mini vision via `ai` SDK v6 + Vercel AI Gateway, Zod schemas, Upstash rate limiting
- **Movie data**: KOBIS Open API
- **Package manager**: Bun

## 📄 License

[MIT](./LICENSE)
