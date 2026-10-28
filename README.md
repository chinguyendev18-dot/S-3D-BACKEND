# S-3D Backend

Backend API dùng chung cho bốn ứng dụng trong hệ thống S-3D:

- `S-3D-FRONTEND`: website khách hàng, cổng `3000`.
- `S-3D-ADMIN`: trang quản trị, cổng `3001`.
- `S-3D-XUONG`: trang vận hành xưởng, cổng `3002`.
- `S-3D-APP`: ứng dụng Expo, Metro cổng `8081`.

## Khởi chạy

```bash
npm install
copy .env.example .env
npm run start:dev
```

API mặc định: `http://localhost:4000/api/v1`.

Kiểm tra kết nối: `GET http://localhost:4000/api/v1/health`.

## Cấu trúc ban đầu

```text
src/
  app.controller.ts  # Endpoint gốc và health check
  app.module.ts      # Module gốc
  main.ts            # Bootstrap, CORS, validation và API prefix
test/
  app.e2e-spec.ts    # Kiểm tra kết nối cơ bản
```

Chưa có module nghiệp vụ, xác thực hoặc kết nối cơ sở dữ liệu.
