/**
 * Every permission the apps check. Admin permissions open pages and actions of S-3D-ADMIN,
 * workshop permissions those of S-3D-XUONG. Roles are lists of these keys.
 */
export type AppScope = 'admin' | 'workshop';

export interface PermissionDef {
  group: string;
  key: string;
  label: string;
  scope: AppScope;
}

export const PERMISSION_GROUPS: Record<string, string> = {
  accounts: 'Tài khoản & phân quyền',
  blog: 'Blog',
  content: 'Trang thông tin',
  customers: 'Khách hàng & liên hệ',
  dashboard: 'Tổng quan',
  discounts: 'Mã giảm giá',
  orders: 'Đơn hàng',
  production: 'Sản xuất',
  products: 'Sản phẩm',
  statistics: 'Thống kê',
  'workshop.activity': 'Nhật ký xưởng',
  'workshop.materials': 'Vật liệu',
  'workshop.orders': 'Đơn tại xưởng',
  'workshop.printers': 'Máy in',
  'workshop.staff': 'Nhân viên xưởng',
};

export const PERMISSIONS: readonly PermissionDef[] = [
  {
    scope: 'admin',
    group: 'dashboard',
    key: 'admin.dashboard.view',
    label: 'Xem trang tổng quan',
  },
  {
    scope: 'admin',
    group: 'orders',
    key: 'admin.orders.view',
    label: 'Xem đơn hàng, vận chuyển',
  },
  {
    scope: 'admin',
    group: 'orders',
    key: 'admin.orders.manage',
    label: 'Tạo, xác nhận, huỷ, hoàn tiền đơn; sửa phí vận chuyển',
  },
  {
    scope: 'admin',
    group: 'production',
    key: 'admin.production.view',
    label: 'Xem tiến độ sản xuất',
  },
  {
    scope: 'admin',
    group: 'production',
    key: 'admin.production.manage',
    label: 'Chuyển đơn xuống xưởng, đổi bước sản xuất',
  },
  {
    scope: 'admin',
    group: 'products',
    key: 'admin.products.view',
    label: 'Xem sản phẩm, danh mục, bảng size',
  },
  {
    scope: 'admin',
    group: 'products',
    key: 'admin.products.manage',
    label: 'Thêm, sửa, xoá sản phẩm và danh mục',
  },
  {
    scope: 'admin',
    group: 'customers',
    key: 'admin.customers.view',
    label: 'Xem khách hàng, tin nhắn liên hệ',
  },
  {
    scope: 'admin',
    group: 'customers',
    key: 'admin.customers.manage',
    label: 'Sửa khách hàng, xử lý liên hệ',
  },
  {
    scope: 'admin',
    group: 'discounts',
    key: 'admin.discounts.view',
    label: 'Xem mã giảm giá',
  },
  {
    scope: 'admin',
    group: 'discounts',
    key: 'admin.discounts.manage',
    label: 'Tạo, sửa, tắt mã giảm giá',
  },
  {
    scope: 'admin',
    group: 'statistics',
    key: 'admin.statistics.view',
    label: 'Xem thống kê doanh thu, hoá đơn',
  },
  {
    scope: 'admin',
    group: 'blog',
    key: 'admin.blog.view',
    label: 'Xem bài viết blog',
  },
  {
    scope: 'admin',
    group: 'blog',
    key: 'admin.blog.manage',
    label: 'Viết, sửa, xoá bài và chuyên mục',
  },
  {
    scope: 'admin',
    group: 'content',
    key: 'admin.content.view',
    label: 'Xem điều khoản, chính sách, FAQ',
  },
  {
    scope: 'admin',
    group: 'content',
    key: 'admin.content.manage',
    label: 'Sửa điều khoản, chính sách, FAQ, liên hệ',
  },
  {
    scope: 'admin',
    group: 'accounts',
    key: 'admin.accounts.view',
    label: 'Xem tài khoản nhân viên, nhật ký tài khoản',
  },
  {
    scope: 'admin',
    group: 'accounts',
    key: 'admin.accounts.manage',
    label: 'Thêm, sửa, khoá tài khoản nhân viên',
  },
  {
    scope: 'admin',
    group: 'accounts',
    key: 'admin.roles.manage',
    label: 'Tạo, sửa vai trò và quyền',
  },
  {
    scope: 'workshop',
    group: 'workshop.orders',
    key: 'workshop.orders.work',
    label: 'Nhận đơn, chuyển bước, bàn giao vận chuyển',
  },
  {
    scope: 'workshop',
    group: 'workshop.printers',
    key: 'workshop.printers.control',
    label: 'Gán đơn, bắt đầu / tạm dừng / huỷ lệnh in',
  },
  {
    scope: 'workshop',
    group: 'workshop.printers',
    key: 'workshop.printers.manage',
    label: 'Thêm, sửa, xoá máy in',
  },
  {
    scope: 'workshop',
    group: 'workshop.materials',
    key: 'workshop.materials.move',
    label: 'Nhập kho, xuất dùng, kiểm kho',
  },
  {
    scope: 'workshop',
    group: 'workshop.materials',
    key: 'workshop.materials.manage',
    label: 'Thêm, sửa, xoá vật liệu',
  },
  {
    scope: 'workshop',
    group: 'workshop.staff',
    key: 'workshop.staff.manage',
    label: 'Thêm, sửa, cho nghỉ nhân viên; đặt lại mật khẩu',
  },
  {
    scope: 'workshop',
    group: 'workshop.activity',
    key: 'workshop.activity.view_all',
    label: 'Xem nhật ký của cả xưởng',
  },
  {
    scope: 'workshop',
    group: 'workshop.activity',
    key: 'workshop.activity.export',
    label: 'Xuất nhật ký ra CSV',
  },
];

export const PERMISSION_KEYS = PERMISSIONS.map((item) => item.key);
const KNOWN = new Set(PERMISSION_KEYS);

export const isPermission = (key: string) => KNOWN.has(key);

export const permissionScope = (key: string): AppScope | undefined =>
  PERMISSIONS.find((item) => item.key === key)?.scope;

/**
 * What a list of permissions really grants: unknown keys dropped, and every "manage" also
 * granting its "view" (managing a page you cannot open makes no sense).
 */
export function effectivePermissions(keys: readonly string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    if (!KNOWN.has(key)) continue;
    out.add(key);
    if (key.endsWith('.manage')) {
      const view = `${key.slice(0, -'.manage'.length)}.view`;
      if (KNOWN.has(view)) out.add(view);
    }
  }
  return PERMISSION_KEYS.filter((key) => out.has(key));
}

/** Whether these permissions open the app at all: any permission of its scope. */
export const canUseApp = (permissions: readonly string[], app: AppScope) =>
  permissions.some((key) => key.startsWith(`${app}.`));
