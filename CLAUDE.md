# S-3D-BACKEND — API dùng chung

NestJS 11 · TypeScript · class-validator · Jest. npm (có `package-lock.json`). Cổng 4000, tiền tố `api/v1`.

Hiện mới là khung ban đầu (`AppController`: `GET /api/v1`, `GET /api/v1/health`). Các app khác
**chưa** gọi backend: Admin dùng API giả lập trong trình duyệt, App giữ dữ liệu trong bộ nhớ,
Web có API route riêng (`/api/meshy`, `/api/custom-orders`), Xưởng lưu file JSON.

## Lệnh

```bash
npm run start:dev   # http://localhost:4000/api/v1
npm run verify      # typecheck + lint + test + build — chạy trước khi báo xong
npm test            # jest (unit) · test/app.e2e-spec.ts (e2e)
```

## Cấu hình (`.env`, mẫu ở `.env.example`)

`PORT`, `API_PREFIX`, `CLIENT_ORIGINS` (CORS; mặc định 3000 web, 3001 admin, 3002 xưởng, 8081 Metro).
`ValidationPipe` toàn cục: whitelist + forbidNonWhitelisted — mọi DTO cần decorator class-validator.

## Quy ước

- Mỗi miền một module Nest (`src/<tên>/<tên>.module.ts`, controller, service, `dto/`), đăng ký trong `AppModule`.
- Comment tiếng Anh. Prettier theo `.prettierrc`.
- Khi thêm endpoint thay thế dữ liệu demo của app nào, ghi rõ trong CLAUDE.md của app đó.
