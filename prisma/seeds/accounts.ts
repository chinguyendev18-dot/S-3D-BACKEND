/**
 * Sample accounts for every role, so each app can be tried. The workshop accounts keep the names
 * and passwords the workshop's demo used. Only for trying things out: change their passwords or
 * lock them before going live.
 */
import { ensureAccount, type AccountSeed } from '../seed-tools';

const ALL_SKILLS = [
  'In FDM',
  'In Resin',
  'Cắt lớp (slicing)',
  'Hậu kỳ',
  'Sơn tay',
  'Kiểm tra chất lượng',
  'Đóng gói',
  'Bảo trì máy',
];

export const SAMPLE_ACCOUNTS: AccountSeed[] = [
  {
    email: 'admin@s3d.local',
    kind: 'staff',
    name: 'Quản trị S-3D',
    password: 'admin123',
    roleKey: 'super_admin',
  },
  {
    email: 'quanly@s3d.local',
    kind: 'staff',
    name: 'Quản lý cửa hàng',
    password: 's3d123',
    roleKey: 'manager',
  },
  {
    email: 'cskh@s3d.local',
    kind: 'staff',
    name: 'Nhân viên CSKH',
    password: 's3d123',
    roleKey: 'sales',
  },
  {
    email: 'noidung@s3d.local',
    kind: 'staff',
    name: 'Biên tập nội dung',
    password: 's3d123',
    roleKey: 'content',
  },
  {
    email: 'ketoan@s3d.local',
    kind: 'staff',
    name: 'Kế toán',
    password: 's3d123',
    roleKey: 'accountant',
  },
  {
    email: 'xuong@s3d.local',
    kind: 'staff',
    name: 'Tổ trưởng xưởng',
    password: 'xuong123',
    phone: '0901 234 567',
    roleKey: 'workshop_lead',
    workshop: {
      joinedDaysAgo: 720,
      shift: 'Ca hành chính',
      skills: ALL_SKILLS,
    },
  },
  {
    email: 'kythuat@s3d.local',
    kind: 'staff',
    name: 'Kỹ thuật viên in',
    password: 'in3d123',
    phone: '0912 345 678',
    roleKey: 'workshop_technician',
    workshop: {
      joinedDaysAgo: 410,
      shift: 'Ca sáng',
      skills: ['In FDM', 'In Resin', 'Cắt lớp (slicing)', 'Bảo trì máy'],
    },
  },
  {
    email: 'hauky@s3d.local',
    kind: 'staff',
    name: 'Nguyễn Thu Hà',
    password: 's3d123',
    phone: '0938 456 789',
    roleKey: 'workshop_post_processing',
    workshop: {
      joinedDaysAgo: 260,
      shift: 'Ca chiều',
      skills: ['Hậu kỳ', 'Sơn tay'],
    },
  },
  {
    email: 'qc@s3d.local',
    kind: 'staff',
    name: 'Trần Quốc Bảo',
    password: 's3d123',
    phone: '0977 567 890',
    roleKey: 'workshop_quality',
    workshop: {
      joinedDaysAgo: 190,
      shift: 'Ca sáng',
      skills: ['Kiểm tra chất lượng', 'Đóng gói'],
    },
  },
  {
    email: 'donggoi@s3d.local',
    kind: 'staff',
    name: 'Lê Hoàng Nam',
    password: 's3d123',
    phone: '0965 678 901',
    roleKey: 'workshop_packing',
    workshop: { joinedDaysAgo: 95, shift: 'Ca chiều', skills: ['Đóng gói'] },
  },
  {
    active: false,
    email: 'huy@s3d.local',
    kind: 'staff',
    name: 'Phạm Gia Huy',
    password: 's3d123',
    phone: '0889 789 012',
    roleKey: 'workshop_technician',
    workshop: {
      joinedDaysAgo: 330,
      note: 'Đã nghỉ việc',
      shift: 'Ca tối',
      skills: ['In FDM', 'Bảo trì máy'],
    },
  },
  {
    email: 'khach@s3d.local',
    kind: 'customer',
    name: 'Khách hàng demo',
    password: 's3d123',
  },
];

export async function seedAccounts() {
  for (const account of SAMPLE_ACCOUNTS) {
    const result = await ensureAccount(account);
    console.log(
      `  ${result.status.padEnd(12)} ${account.email.padEnd(22)} ${account.roleKey ?? 'khách hàng'}`,
    );
  }
  console.log(
    'Tài khoản mẫu chỉ để thử: đổi mật khẩu hoặc khoá chúng trước khi chạy thật.',
  );
}
