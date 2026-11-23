/**
 * The licences models on MakerWorld, Printables and Thingiverse carry, and whether the shop may
 * print one and sell the print. "Sell the print" is commercial use: NC licences and the sites'
 * personal-use "Standard Digital File License" forbid it, even when the shop calls it a print
 * service. When in doubt a licence is blocked: a wrong "allowed" costs more than a missed model.
 */

export const LICENSE_VERDICTS = ['allowed', 'limited', 'blocked'] as const;
export type LicenseVerdict = (typeof LICENSE_VERDICTS)[number];

export const MODEL_SOURCES = [
  'makerworld',
  'printables',
  'thingiverse',
] as const;
export type ModelSource = (typeof MODEL_SOURCES)[number];

/**
 * What a check rests on: the model's own licence, a commercial membership bought from the
 * creator (MakerWorld sells these per creator, for all their models), or written permission.
 */
export const CHECK_BASES = ['license', 'membership', 'permission'] as const;
export type CheckBasis = (typeof CHECK_BASES)[number];

/**
 * Boxes the person checking must tick. Each licence condition becomes one, so the shop has said
 * it will meet it (credit the creator, print unmodified…) before the model can be sold.
 */
export const ACKNOWLEDGEMENTS = {
  attribution: 'Ghi tên tác giả và link mẫu gốc trên trang sản phẩm',
  membership_active: 'Shop đang có gói quyền thương mại của tác giả này',
  no_modification: 'Chỉ in đúng mẫu gốc, không sửa, không ghép, không tách lại',
  permission_written:
    'Tác giả đã cho phép bán bản in bằng văn bản (tin nhắn, email)',
  seen_on_source: 'Đã mở trang gốc và xem đúng giấy phép đang hiện',
  share_alike: 'Nếu sửa mẫu, bản sửa cũng phải để giấy phép giống bản gốc',
} as const;
export type Acknowledgement = keyof typeof ACKNOWLEDGEMENTS;

/** A condition of the licence that the shop has to keep while it sells the print. */
export type LicenseRequirement =
  'attribution' | 'no_modification' | 'share_alike';

export interface LicenseDef {
  code: string;
  label: string;
  verdict: LicenseVerdict;
  requires: readonly LicenseRequirement[];
  /** The sites that offer it, for the admin's list. */
  sources: readonly ModelSource[];
  /** Why, in a sentence the admin shows next to the verdict. */
  note: string;
}

const ALL: readonly ModelSource[] = MODEL_SOURCES;

export const LICENSES: readonly LicenseDef[] = [
  {
    code: 'cc0',
    label: 'CC0 (Public Domain Dedication)',
    note: 'Tác giả bỏ mọi quyền: được in bán, không cần điều kiện.',
    requires: [],
    sources: ALL,
    verdict: 'allowed',
  },
  {
    code: 'public_domain',
    label: 'Public Domain',
    note: 'Mẫu thuộc phạm vi công cộng: được in bán.',
    requires: [],
    sources: ['thingiverse'],
    verdict: 'allowed',
  },
  {
    code: 'cc_by',
    label: 'CC BY (Ghi công)',
    note: 'Được in bán, phải ghi tên tác giả.',
    requires: ['attribution'],
    sources: ALL,
    verdict: 'allowed',
  },
  {
    code: 'cc_by_sa',
    label: 'CC BY-SA (Ghi công, chia sẻ tương tự)',
    note: 'Được in bán, phải ghi tên tác giả; bản sửa phải để cùng giấy phép.',
    requires: ['attribution', 'share_alike'],
    sources: ALL,
    verdict: 'allowed',
  },
  {
    code: 'cc_by_nd',
    label: 'CC BY-ND (Ghi công, không sửa)',
    note: 'Được in bán bản nguyên gốc, phải ghi tên tác giả. Không được sửa mẫu.',
    requires: ['attribution', 'no_modification'],
    sources: ALL,
    verdict: 'limited',
  },
  {
    code: 'printables_commercial',
    label: 'Printables – Commercial Use',
    note: 'Printables cho phép bán bản in. Đọc điều khoản giấy phép trên trang mẫu.',
    requires: [],
    sources: ['printables'],
    verdict: 'allowed',
  },
  {
    code: 'printables_commercial_nd',
    label: 'Printables – Commercial Use, No Derivatives',
    note: 'Được bán bản in nguyên gốc, không được sửa mẫu.',
    requires: ['no_modification'],
    sources: ['printables'],
    verdict: 'limited',
  },
  {
    code: 'cc_by_nc',
    label: 'CC BY-NC (Phi thương mại)',
    note: 'NC = cấm dùng thương mại: không được in bán.',
    requires: [],
    sources: ALL,
    verdict: 'blocked',
  },
  {
    code: 'cc_by_nc_sa',
    label: 'CC BY-NC-SA (Phi thương mại)',
    note: 'NC = cấm dùng thương mại: không được in bán.',
    requires: [],
    sources: ALL,
    verdict: 'blocked',
  },
  {
    code: 'cc_by_nc_nd',
    label: 'CC BY-NC-ND (Phi thương mại)',
    note: 'NC = cấm dùng thương mại: không được in bán.',
    requires: [],
    sources: ALL,
    verdict: 'blocked',
  },
  {
    code: 'standard_digital',
    label: 'Standard Digital File License',
    note: 'Chỉ cho dùng cá nhân: in thuê để bán là dùng thương mại, không được.',
    requires: [],
    sources: ['makerworld', 'printables'],
    verdict: 'blocked',
  },
  {
    code: 'standard_digital_community',
    label: 'Standard Digital File License – Community Use',
    note: 'Bản "Community Use" vẫn không cho bán bản in.',
    requires: [],
    sources: ['makerworld'],
    verdict: 'blocked',
  },
  {
    code: 'all_rights_reserved',
    label: 'All Rights Reserved',
    note: 'Tác giả giữ mọi quyền: không được in bán.',
    requires: [],
    sources: ALL,
    verdict: 'blocked',
  },
  {
    code: 'other',
    label: 'Giấy phép khác (GPL, BSD…)',
    note: 'Chưa có trong danh sách: chưa cho bán. Xin phép tác giả hoặc hỏi luật sư.',
    requires: [],
    sources: ALL,
    verdict: 'blocked',
  },
];

const BY_CODE = new Map(LICENSES.map((item) => [item.code, item]));

export function findLicense(code: string) {
  return BY_CODE.get(code);
}

export interface CheckInput {
  basis: CheckBasis;
  licenseCode: string;
  acknowledgements: readonly string[];
  /** YYYY-MM-DD, for a membership. */
  membershipUntil?: string | null;
  evidenceKey?: string | null;
  note?: string;
  creatorName?: string;
}

export interface CheckResult {
  verdict: LicenseVerdict;
  /** The boxes this check needed, in the order the admin shows them. */
  required: Acknowledgement[];
}

/** Ticks a check needs: always "seen it", then what the basis and the licence ask. */
export function requiredAcknowledgements(
  basis: CheckBasis,
  license: LicenseDef,
): Acknowledgement[] {
  if (basis === 'membership') return ['seen_on_source', 'membership_active'];
  if (basis === 'permission') return ['seen_on_source', 'permission_written'];
  if (license.verdict === 'blocked') return ['seen_on_source'];
  return ['seen_on_source', ...license.requires];
}

/** "2026-11-23" in Vietnam: a membership "until" date is read as a day there. */
export function todayInVietnam(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * The verdict of one check, or the Vietnamese reason it cannot be saved. A blocked licence can be
 * recorded (so nobody checks the same model again) but never becomes sellable; allowing one needs
 * a screenshot of the licence as proof, and every condition ticked.
 */
export function evaluateCheck(
  input: CheckInput,
  today = todayInVietnam(),
): { ok: true; result: CheckResult } | { ok: false; message: string } {
  const license = findLicense(input.licenseCode);
  if (!license)
    return { message: 'Giấy phép không có trong danh sách.', ok: false };

  const required = requiredAcknowledgements(input.basis, license);
  const missing = required.filter(
    (key) => !input.acknowledgements.includes(key),
  );
  if (missing.length) {
    return {
      message: `Cần xác nhận: ${missing.map((key) => ACKNOWLEDGEMENTS[key]).join('; ')}.`,
      ok: false,
    };
  }

  let verdict: LicenseVerdict = license.verdict;
  if (input.basis === 'membership') {
    const until = input.membershipUntil ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      return { message: 'Nhập ngày gói quyền thương mại hết hạn.', ok: false };
    }
    if (until < today) {
      return { message: 'Gói quyền thương mại đã hết hạn.', ok: false };
    }
    verdict = 'allowed';
  } else if (input.basis === 'permission') {
    if (!input.note?.trim()) {
      return {
        message:
          'Ghi lại tác giả cho phép thế nào (qua đâu, ngày nào, phạm vi).',
        ok: false,
      };
    }
    verdict = 'allowed';
  }

  if (verdict !== 'blocked') {
    if (!input.evidenceKey) {
      return {
        message: 'Thêm ảnh chụp giấy phép (hoặc lời cho phép) làm bằng chứng.',
        ok: false,
      };
    }
    if (
      license.requires.includes('attribution') &&
      !input.creatorName?.trim()
    ) {
      return {
        message: 'Giấy phép này cần ghi tên tác giả: nhập tên tác giả.',
        ok: false,
      };
    }
  }

  return { ok: true, result: { required, verdict } };
}

/** Days after which a check is old: creators can change a licence after publishing. */
export const RECHECK_AFTER_DAYS = 90;

export interface SellableState {
  sellable: boolean;
  /** Why not, or what to watch; "" when there is nothing to say. */
  reason: string;
  recheckDue: boolean;
}

/** Whether a model may be printed for sale today, from its latest check. */
export function sellableState(
  latest: {
    verdict: LicenseVerdict;
    basis: CheckBasis;
    membershipUntil: string | null;
    checkedAt: Date;
  },
  now = new Date(),
): SellableState {
  const ageDays = (now.getTime() - latest.checkedAt.getTime()) / 86_400_000;
  const recheckDue = ageDays > RECHECK_AFTER_DAYS;
  if (latest.verdict === 'blocked') {
    return {
      reason: 'Giấy phép không cho in bán.',
      recheckDue,
      sellable: false,
    };
  }
  if (
    latest.basis === 'membership' &&
    (!latest.membershipUntil || latest.membershipUntil < todayInVietnam(now))
  ) {
    return {
      reason: 'Gói quyền thương mại đã hết hạn: gia hạn rồi kiểm tra lại.',
      recheckDue: true,
      sellable: false,
    };
  }
  return {
    reason: recheckDue
      ? `Đã quá ${RECHECK_AFTER_DAYS} ngày từ lần kiểm tra trước: nên xem lại giấy phép.`
      : '',
    recheckDue,
    sellable: true,
  };
}
