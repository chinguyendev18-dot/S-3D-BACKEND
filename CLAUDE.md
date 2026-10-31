# S-3D-BACKEND — API dùng chung

NestJS 11 · TypeScript · class-validator · Jest · Prisma 7 (adapter-pg) · Supabase Auth. npm (có `package-lock.json`).
Cổng 4000, tiền tố `api/v1`.

Đã có: **đăng nhập + phân quyền** cho cả 4 app. Các phần khác (sản phẩm, đơn...) vẫn là dữ liệu demo ở từng app.

## Lệnh

```bash
npm run start:dev          # http://localhost:4000/api/v1
npm run verify             # typecheck + lint + test + build — chạy trước khi báo xong
npm test                   # jest: *.spec.ts cạnh code (unit) · test/*.e2e-spec.ts (không cần mạng)
npm run db:migrate         # prisma migrate deploy (dùng DIRECT_URL, cổng 5432)
npm run db:seed            # vai trò mặc định + tài khoản mẫu (SEED_SAMPLE_ACCOUNTS=false: chỉ vai trò)
npm run auth:create-admin -- --email a@b.vn --password "..." [--name "Tên"]   # tạo / lấy lại Quản trị hệ thống
```

`npm install` tự chạy `prisma generate` (client sinh ra ở `src/generated/prisma`, không commit).
Migration mới: sửa `prisma/schema.prisma`, sinh SQL bằng `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
vào `prisma/migrations/<thời gian>_<tên>/migration.sql`, rồi `npm run db:migrate`. Bảng mới trong `public` **phải bật RLS**
như migration đầu (Supabase mở schema public qua Data API bằng publishable key).

## Cấu hình (`.env`, mẫu ở `.env.example`)

`PORT`, `API_PREFIX`, `CLIENT_ORIGINS` (CORS; mặc định 3000 web, 3001 admin, 3002 xưởng, 8081 Metro), `DATABASE_URL` (pooler 6543, khi chạy),
`DIRECT_URL` (5432, cho migrate), `SUPABASE_*`, `R2_*`, `FIREBASE_*`. `DATABASE_SSL=false` để tắt TLS tới Postgres.
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
- `prisma/` — schema, migrations, `seed.ts`, `create-admin.ts`.

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
- Endpoint mới mặc định cần đăng nhập; gắn quyền bằng decorator của `src/access/decorators.ts`.
- Comment tiếng Anh, thông báo lỗi tiếng Việt. Prettier theo `.prettierrc`.
- Khi thêm endpoint thay thế dữ liệu demo của app nào, ghi rõ trong CLAUDE.md của app đó.
