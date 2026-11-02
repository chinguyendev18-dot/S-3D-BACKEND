# S-3D-BACKEND — API dùng chung

NestJS 11 · TypeScript · class-validator · Jest · Prisma 7 (adapter-pg) · Supabase Auth. npm (có `package-lock.json`).
Cổng 4000, tiền tố `api/v1`.

Đã có: **đăng nhập + phân quyền** cho cả 4 app; hạ tầng dùng chung (GĐ1: OpenAPI, phân trang, upload R2, realtime, seed);
**danh mục & nội dung** (GĐ2: sản phẩm, danh mục, cỡ, vùng in, vật liệu/màu/giá in, mẫu, blog, chính sách/FAQ, vận chuyển, mã giảm giá).
Đơn hàng, giỏ, khách hàng… vẫn là dữ liệu demo ở từng app (GĐ3).

## Lệnh

```bash
npm run start:dev          # http://localhost:4000/api/v1
npm run verify             # typecheck + lint + test + build + ghi lại openapi.json — chạy trước khi báo xong
npm run openapi            # build + ghi openapi.json (rồi `yarn api:types` ở Admin, Web, Xưởng, App) — chạy khi đổi route / DTO
npm test                   # jest: *.spec.ts cạnh code (unit) · test/*.e2e-spec.ts (không cần mạng)
npm run db:migrate         # prisma migrate deploy (dùng DIRECT_URL, cổng 5432)
npm run db:seed            # các bước seed (SEED_SAMPLE_ACCOUNTS=false: bỏ tài khoản mẫu); một bước: npm run db:seed -- --only=roles
npm run auth:create-admin -- --email a@b.vn --password "..." [--name "Tên"]   # tạo / lấy lại Quản trị hệ thống
```

`npm install` tự chạy `prisma generate` (client sinh ra ở `src/generated/prisma`, không commit).
Migration mới: sửa `prisma/schema.prisma`, sinh SQL bằng `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
vào `prisma/migrations/<thời gian>_<tên>/migration.sql`, rồi `npm run db:migrate`. Bảng mới trong `public` **phải bật RLS**
như migration đầu (Supabase mở schema public qua Data API bằng publishable key).

## Cấu hình (`.env`, mẫu ở `.env.example`)

`PORT`, `API_PREFIX`, `CLIENT_ORIGINS` (CORS; mặc định 3000 web, 3001 admin, 3002 xưởng, 8081 Metro), `DATABASE_URL` (pooler 6543, khi chạy),
`DIRECT_URL` (5432, cho migrate), `SUPABASE_*`, `R2_*`, `FIREBASE_*`. `DATABASE_SSL=false` để tắt TLS tới Postgres.
`TRUST_PROXY` (ai được báo IP khách, mặc định loopback), `PUBLIC_API_URL` (link file công khai khi chưa có `R2_PUBLIC_URL`),
`API_DOCS` (trang /api/v1/docs; mặc định bật trừ production), `REALTIME_SECRET` (ký vé socket; cần khi chạy nhiều server).
Không in / chép khoá ra ngoài file `.env`.

## Cấu trúc

- `src/access/` — danh sách quyền (`permissions.ts`), vai trò mặc định (`default-roles.ts`), `AuthGuard` (mọi route cần token trừ `@Public()`),
  `PermissionsGuard` (`@RequirePermissions`, `@RequireAnyPermission`, `@RequireApp('admin'|'workshop')`), `UserContextService` (hồ sơ + quyền, cache 30 giây).
- `src/auth/` — `/auth/*`: login (`app`: shop | admin | workshop), register, verify-email (mã 6 số: account | forgotpassword),
  resend-otp, send-reset-password, reset-password, refresh, logout, session, profile, change-password, google|apple (ID token, cho app),
  oauth/start + oauth/exchange (Google / Apple qua Supabase OAuth + PKCE, cho web; `redirectTo` phải thuộc CLIENT_ORIGINS). Giới hạn số lần thử trong bộ nhớ.
- `src/roles/` — `/permissions`, `/roles` (CRUD). `src/accounts/` — `/accounts` (tài khoản nhân viên, cho Admin) và `/workshop/staff` (cho Xưởng).
- `src/audit/` — bảng `audit_logs` + `GET /audit-logs`. `src/common/` — dạng trả về `{ success, data, message?, messageCode? }`, lỗi
  `{ success: false, statusCode, message, messageCode, details? }` (message tiếng Việt), validation, rate limit.
- `src/openapi/` — Swagger: `/api/v1/docs` (UI), `/api/v1/docs-json`; `npm run openapi` ghi `openapi.json` (commit cùng code).
  Plugin Swagger trong `nest-cli.json` tự đọc field của mọi file `*.dto.ts` (kể cả comment) — chỉ chạy khi `nest build`.
- `src/storage/` — `StorageService` (R2: link ký upload / tải, `describe`, `remove`). `src/uploads/` — `POST /uploads` (link PUT lên R2,
  ký luôn kiểu + dung lượng), `GET /uploads/download?key=`, `GET /files/<key>` (file public khi chưa có domain R2). Khoá `public/...` nằm ở
  `R2_PUBLIC_BUCKET` (bucket mở công khai), còn lại ở `R2_BUCKET` (không bao giờ bật public). Loại file theo
  `upload-purposes.ts`; khoá `public/<purpose>/<yyyy>/<mm>/<uuid>.<ext>` hoặc `private/<purpose>/<userId>/<uuid>.<ext>`.
- `src/realtime/` — socket.io namespace `/realtime` (cùng cổng). Mở bằng vé 60 giây dùng một lần (`POST /realtime/ticket`, app gửi
  `auth: { token }` hoặc `?token=`); phòng `user:<id>` và `app:<shop|admin|workshop>`; kiểm tra lại mỗi phút (khoá tài khoản → ngắt).
  Sự kiện và payload: `realtime.events.ts`.
- `src/catalog/` — `/products/categories`, `/products` (khách: chỉ hàng đang bán; ai có `admin.products.view`: tất cả), `/products/:id`
  (id hoặc slug, kèm biến thể màu × chiều cao), `/print-areas` (bàn in của máy), `/print-options` (vật liệu, màu nhựa, đơn giá;
  `PUT` thay cả bộ). Giá: `pricing.ts` (chuyển từ Web/Admin); `product-view.ts` trả một dạng cho cả Web (productColors, sizes, variants,
  template) và Admin (status, colors = mã màu, longDescription, model…). Ảnh/mô hình lưu key R2 (`StorageService.toStored` / `mediaUrl`).
- `src/content/` — `/blog-categories` (+ `/:id/blog-posts`), `/blog-posts`,
  `/legal-documents` (chính sách: mỗi dòng một mục; `faq`: mỗi dòng một câu hỏi).
- `src/shipping/` — `/countries`, `/shipping/zones` (sửa cần `admin.orders.manage`). `src/discounts/` — `/discounts` (`admin.discounts.*`).
- `prisma/` — schema, migrations, `seed.ts` (các bước: roles, accounts, catalog, content, shipping, discounts), `seeds/` (mỗi bước một file), `seed-data/` (dữ liệu demo gom từ 3 app:
  catalog, content, shipping, discounts + ảnh sản phẩm; kiểu ở `seed-data/index.ts`), `create-admin.ts`.

## Phân quyền

- Tài khoản = Supabase Auth (`auth.users`) + hàng `users` (cùng id): `kind` customer | staff, `roleId`, `active`.
- Quyền là khoá `admin.<mục>.view|manage`, `admin.roles.manage`, `workshop.<mục>.<việc>`; "manage" tự kèm "view".
  `super_admin` luôn có mọi quyền (cả quyền thêm sau này) và không sửa được. Vào app nào cần ít nhất một quyền của app đó.
- Luật chống tự nâng quyền: không ai giao vai trò / quyền mình không có, không sửa người có quyền cao hơn, không tự khoá / đổi vai trò mình,
  luôn còn ≥1 Quản trị hệ thống và ≥1 tổ trưởng xưởng đang hoạt động. Khoá tài khoản = ban trên Supabase (không refresh được nữa).
- Token: access token Supabase (ES256), kiểm tra tại chỗ bằng JWKS (`auth.getClaims`), không gọi mạng mỗi request.
- Email OTP dùng mailer của Supabase: mẫu email "Confirm signup" và "Reset password" phải có `{{ .Token }}`; mailer mặc định chỉ gửi tới thành viên project → cần SMTP riêng khi chạy thật.

## Quy ước

- Mỗi miền một module Nest (`src/<tên>/<tên>.module.ts`, controller, service, `dto/`), đăng ký trong `AppModule`.
- Endpoint mới mặc định cần đăng nhập; gắn quyền bằng decorator của `src/access/decorators.ts` (tự hiện trong tài liệu API).
- Mỗi route ghi kiểu trả về bằng `@ApiData(Dto)` / `@ApiPage(Dto)` (`src/openapi/api-data.decorator.ts`); DTO trả về là class trong
  `dto/*.dto.ts`. Sau khi đổi: `npm run openapi`.
- Danh sách: query kế thừa `PageQueryDto`, đọc bằng `pageArgs(query, [cột cho phép sắp xếp], '-createdAt')`, trả `toPage(items, total, args)`.
- File: app upload qua `POST /uploads` rồi gửi `key`; module lưu key gọi `UploadsService.assertUploaded(user, key, purpose)` trước khi lưu.
- Đẩy realtime: inject `RealtimeService` → `toUser(id, 'order:updated', …)` / `toApp('admin', …)`. Không có hàng đợi: lưu DB trước.
- Module có dữ liệu demo: thêm bước vào `STEPS` của `prisma/seed.ts`, đọc từ `prisma/seed-data` (đừng chép lại dữ liệu từ app).
- Comment tiếng Anh, thông báo lỗi tiếng Việt. Prettier theo `.prettierrc`.
- Khi thêm endpoint thay thế dữ liệu demo của app nào, ghi rõ trong CLAUDE.md của app đó.
