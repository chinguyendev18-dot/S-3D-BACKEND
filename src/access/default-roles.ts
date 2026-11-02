import { PERMISSIONS, type AppScope } from './permissions';

/** Full access to everything, now and when new permissions are added; cannot be edited. */
export const SUPER_ADMIN = 'super_admin';

export interface RoleSeed {
  description: string;
  key: string;
  name: string;
  permissions: string[];
  scope: AppScope;
  sortOrder: number;
}

const of = (scope: AppScope) =>
  PERMISSIONS.filter((item) => item.scope === scope).map((item) => item.key);

const WORKSHOP_HANDS = [
  'workshop.orders.work',
  'workshop.printers.control',
  'workshop.materials.move',
];

/**
 * Roles the system starts with. Seeding adds the missing ones and never overwrites changes made
 * in the admin afterwards (except super_admin, which always has everything).
 */
export const DEFAULT_ROLES: RoleSeed[] = [
  {
    key: SUPER_ADMIN,
    name: 'Quản trị hệ thống',
    description:
      'Toàn quyền trên Admin và Xưởng, kể cả tài khoản và phân quyền.',
    scope: 'admin',
    permissions: PERMISSIONS.map((item) => item.key),
    sortOrder: 0,
  },
  {
    key: 'manager',
    name: 'Quản lý cửa hàng',
    description: 'Mọi việc trên Admin, trừ thêm tài khoản và phân quyền.',
    scope: 'admin',
    permissions: of('admin').filter(
      (key) => key !== 'admin.accounts.manage' && key !== 'admin.roles.manage',
    ),
    sortOrder: 1,
  },
  {
    key: 'sales',
    name: 'Chăm sóc khách hàng',
    description: 'Xử lý đơn hàng, khách hàng và tin nhắn liên hệ.',
    scope: 'admin',
    permissions: [
      'admin.dashboard.view',
      'admin.orders.manage',
      'admin.production.view',
      'admin.products.view',
      'admin.customers.manage',
      'admin.discounts.view',
    ],
    sortOrder: 2,
  },
  {
    key: 'content',
    name: 'Biên tập nội dung',
    description: 'Sản phẩm, mẫu thiết kế, blog và các trang thông tin.',
    scope: 'admin',
    permissions: [
      'admin.dashboard.view',
      'admin.products.manage',
      'admin.blog.manage',
      'admin.content.manage',
    ],
    sortOrder: 3,
  },
  {
    key: 'accountant',
    name: 'Kế toán',
    description: 'Xem đơn hàng, thống kê doanh thu và hoá đơn.',
    scope: 'admin',
    permissions: [
      'admin.dashboard.view',
      'admin.orders.view',
      'admin.customers.view',
      'admin.statistics.view',
    ],
    sortOrder: 4,
  },
  {
    key: 'workshop_lead',
    name: 'Tổ trưởng',
    description: 'Quản lý nhân viên, máy in, vật liệu và xem nhật ký cả xưởng.',
    scope: 'workshop',
    permissions: of('workshop'),
    sortOrder: 10,
  },
  {
    key: 'workshop_technician',
    name: 'Kỹ thuật viên',
    description: 'Làm đơn, điều khiển máy in, ghi nhập / xuất kho.',
    scope: 'workshop',
    permissions: WORKSHOP_HANDS,
    sortOrder: 11,
  },
  {
    key: 'workshop_post_processing',
    name: 'Hậu kỳ',
    description: 'Làm đơn, điều khiển máy in, ghi nhập / xuất kho.',
    scope: 'workshop',
    permissions: WORKSHOP_HANDS,
    sortOrder: 12,
  },
  {
    key: 'workshop_quality',
    name: 'Kiểm tra chất lượng',
    description: 'Làm đơn, điều khiển máy in, ghi nhập / xuất kho.',
    scope: 'workshop',
    permissions: WORKSHOP_HANDS,
    sortOrder: 13,
  },
  {
    key: 'workshop_packing',
    name: 'Đóng gói',
    description: 'Làm đơn, điều khiển máy in, ghi nhập / xuất kho.',
    scope: 'workshop',
    permissions: WORKSHOP_HANDS,
    sortOrder: 14,
  },
];
