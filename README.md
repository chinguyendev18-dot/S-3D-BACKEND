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
npm run db:seed        # vai trò mặc định + tài khoản mẫu
npm run start:dev
```

API mặc định: `http://localhost:4000/api/v1`. Kiểm tra: `GET /api/v1/health`.

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
