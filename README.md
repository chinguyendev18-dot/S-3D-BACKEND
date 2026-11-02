# S-3D Backend

Backend API dùng chung cho bốn ứng dụng trong hệ thống S-3D:

- `S-3D-FRONTEND`: website khách hàng, cổng `3000`.
- `S-3D-ADMIN`: trang quản trị, cổng `3001`.
- `S-3D-XUONG`: trang vận hành xưởng, cổng `3002`.
- `S-3D-APP`: ứng dụng Expo, Metro cổng `8081`.

## Khởi chạy

```bash
npm install            # cài thư viện + sinh Prisma Client
copy .env.example .env # rồi điền khoá Supabase / R2 / Firebase
npm run db:migrate     # tạo bảng (users, roles, workshop_profiles, audit_logs)
npm run db:seed        # vai trò, tài khoản mẫu, danh mục, nội dung, vận chuyển, mã giảm giá (một bước: npm run db:seed -- --only=catalog)
npm run start:dev
```

API mặc định: `http://localhost:4000/api/v1`. Kiểm tra: `GET /api/v1/health`. Tài liệu API: `http://localhost:4000/api/v1/docs`.

## Đăng nhập & phân quyền

Tài khoản nằm ở Supabase Auth; backend giữ hồ sơ, vai trò và quyền. Web và Admin, Xưởng gọi qua server của chính chúng
(token để trong cookie HttpOnly); App gọi thẳng và giữ token trong SecureStore.

Tài khoản mẫu (`npm run db:seed`, chỉ để thử — đổi mật khẩu hoặc khoá trước khi chạy thật):

| Email | Mật khẩu | Vai trò |
|---|---|---|
| `admin@s3d.local` | `admin123` | Quản trị hệ thống (Admin + Xưởng, toàn quyền) |
| `quanly@s3d.local` | `s3d123` | Quản lý cửa hàng |
| `cskh@s3d.local` | `s3d123` | Chăm sóc khách hàng |
| `noidung@s3d.local` | `s3d123` | Biên tập nội dung |
| `ketoan@s3d.local` | `s3d123` | Kế toán |
| `xuong@s3d.local` | `xuong123` | Tổ trưởng (Xưởng) |
| `kythuat@s3d.local` | `in3d123` | Kỹ thuật viên |
| `hauky@` / `qc@` / `donggoi@s3d.local` | `s3d123` | Hậu kỳ / Kiểm tra chất lượng / Đóng gói |
| `huy@s3d.local` | `s3d123` | Kỹ thuật viên (đã khoá) |
| `khach@s3d.local` | `s3d123` | Khách hàng (website, app) |

Mất quyền vào Admin: `npm run auth:create-admin -- --email ban@vidu.vn --password "matkhau-moi"`.

## Đăng nhập Google (web)

1. Google Cloud Console → APIs & Services → **OAuth consent screen** (External, tên S-3D, email hỗ trợ; khi còn Testing thì thêm Gmail thử vào Test users).
2. **Credentials → Create credentials → OAuth client ID** → Web application → Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` → lấy Client ID + Client secret.
3. Supabase → Authentication → **Sign In / Providers → Google** → Enable, dán Client ID + secret.
4. Supabase → Authentication → **URL Configuration → Redirect URLs** → thêm `http://localhost:3000/api/auth/oauth/callback` (khi chạy thật: tên miền thật).

Web gọi `POST /auth/oauth/start` rồi `/auth/oauth/exchange` (qua `S-3D-FRONTEND/src/app/api/auth/oauth`). Apple dùng cùng luồng khi bật provider Apple.

Đăng ký / quên mật khẩu gửi mã 6 số qua email của Supabase: dán mẫu trong `supabase/email-templates/`
(Confirm signup, Reset password) vào Supabase → Authentication → Emails → Templates, và cấu hình SMTP riêng (đã làm với Gmail).

## Tài liệu API và kiểu dữ liệu cho các app

- `/api/v1/docs`: Swagger UI (mỗi route ghi rõ cần quyền gì). `/api/v1/docs-json`: bản JSON.
- `npm run openapi` ghi `openapi.json` ở thư mục này. Các app sinh type từ file đó: `yarn api:types` (ở Admin, Web, Xưởng, App)
  → `src/types/backend-api.d.ts`; dùng qua `src/types/backend.ts`:
  `BackendData<"/auth/session", "get">`, `BackendBody<"/uploads", "post">`, `BackendSchema<"AuthUserDto">`.

## Upload file (Cloudflare R2)

1. App gọi `POST /uploads` `{ purpose, fileName, contentType, size }` → nhận `uploadUrl` (10 phút), `key`, `publicUrl`.
2. App `PUT` file thẳng lên `uploadUrl` với đúng `Content-Type`; R2 từ chối nếu khác kiểu hoặc khác dung lượng đã khai.
3. App gửi `key` kèm dữ liệu (ảnh sản phẩm, ảnh đổi trả…). File riêng tư mở bằng `GET /uploads/download?key=` (chủ file và nhân viên).

Loại file, ai được tải, dung lượng tối đa: `src/uploads/upload-purposes.ts`.

Hai bucket, vì R2 mở công khai cả bucket một lúc: `R2_PUBLIC_BUCKET` (`s3d-public`, bật Public Development URL hoặc Custom Domain,
link đặt vào `R2_PUBLIC_URL`) cho ảnh sản phẩm, blog, avatar; `R2_BUCKET` (`s3d-files`, **không bao giờ bật public**) cho mô hình,
file in, ảnh đổi trả. API token phải có quyền Object Read & Write trên cả hai. Cả hai bucket cần CORS cho phép `PUT` từ các trang web
(Settings → CORS policy). Khi chưa có `R2_PUBLIC_URL`, ảnh public đi qua `GET /api/v1/files/<key>` của backend.

## Realtime (socket.io)

Namespace `/realtime` trên cùng cổng với API. Trình duyệt không giữ access token, nên server web lấy **vé** một lần dùng, sống 60 giây:
Web `GET /api/realtime/token`, Admin `POST /api/realtime/ticket`, Xưởng `GET /api/realtime/token`; App gọi thẳng `POST /realtime/ticket`.
Mở socket: `io("<backend>/realtime", { auth: { token } })`. Sự kiện: `src/realtime/realtime.events.ts`.
Chạy nhiều server backend thì đặt `REALTIME_SECRET` giống nhau và thêm Redis adapter cho socket.io.

## Dữ liệu demo dùng chung (`prisma/seed-data/`)

Danh mục, sản phẩm (37) + thông số in, vật liệu, màu nhựa, cách tính giá, blog, chính sách, FAQ, vùng vận chuyển,
34 tỉnh thành, mã giảm giá và ảnh sản phẩm, gom từ dữ liệu giả của Web, Admin, App (31/10/2026). Các bước seed `catalog`, `content`,
`shipping`, `discounts` đọc từ đây (ảnh sản phẩm đưa lên bucket public của R2). Chạy lại bất cứ lúc nào: chỉ thêm dòng còn thiếu,
không ghi đè chỗ đã sửa trong Admin.
