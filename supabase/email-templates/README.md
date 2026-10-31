# Mẫu email của Supabase Auth

Web và app hỏi **mã 6 số**, nên mẫu email phải có `{{ .Token }}` (mẫu mặc định của Supabase chỉ có đường link).
Dán từng file vào Supabase → **Authentication → Emails → Templates**:

| Mẫu trên Supabase | Subject | Body (Source) |
|---|---|---|
| Confirm signup | `Mã xác nhận tài khoản S-3D` | `confirm-signup.html` |
| Reset password | `Mã đặt lại mật khẩu S-3D` | `reset-password.html` |

Kèm theo:
- **Authentication → Sign In / Providers → Email**: *Email OTP Length* = `6`; *Email OTP Expiration* = `3600` giây (mẫu ghi "hết hạn sau 1 giờ").
- Gửi bằng SMTP riêng (**Authentication → Emails → SMTP Settings**). Gmail: host `smtp.gmail.com`, port `587`,
  username là địa chỉ Gmail, password là mật khẩu ứng dụng 16 ký tự viết liền.

Màu theo nhận diện S-3D (navy `#101827`, lime `#C7FF61`). Chỉ dùng HTML bảng + style inline để hiển thị đúng trên Gmail / Outlook.
