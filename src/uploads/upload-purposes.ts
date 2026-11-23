const MB = 1024 * 1024;

export type Visibility = 'private' | 'public';

/** File extension → content types a browser or phone may send for it. */
type FileTypes = Record<string, readonly string[]>;

const IMAGES: FileTypes = {
  jpeg: ['image/jpeg'],
  jpg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
};

const DOCUMENTS: FileTypes = { pdf: ['application/pdf'] };

/** Browsers know few 3D types and often send application/octet-stream: the extension decides. */
const BINARY = 'application/octet-stream';
const MODELS: FileTypes = {
  '3mf': ['model/3mf', BINARY],
  glb: ['model/gltf-binary', BINARY],
  gltf: ['model/gltf+json', 'application/json', BINARY],
  obj: ['model/obj', 'text/plain', BINARY],
  stl: ['model/stl', 'application/sla', 'application/vnd.ms-pki.stl', BINARY],
};

/**
 * What a shop downloads from MakerWorld / Printables… to print a model: slicer projects, meshes,
 * CAD, ready G-code, or the zip the site packs them in.
 */
const PRINT_FILES: FileTypes = {
  ...MODELS,
  '7z': ['application/x-7z-compressed', BINARY],
  amf: ['application/x-amf', 'application/xml', 'text/xml', BINARY],
  gcode: ['text/x-gcode', 'text/plain', BINARY],
  rar: ['application/vnd.rar', 'application/x-rar-compressed', BINARY],
  step: ['model/step', 'application/step', 'application/stp', BINARY],
  stp: ['model/step', 'application/step', 'application/stp', BINARY],
  zip: ['application/zip', 'application/x-zip-compressed', BINARY],
};

export interface UploadPurpose {
  label: string;
  maxBytes: number;
  /**
   * Who may upload: staff with one of these permissions, or any signed-in person ('anyone').
   * Customers' private files go under their own id (see uploads.service.ts).
   */
  allowed: 'anyone' | readonly string[];
  types: FileTypes;
  visibility: Visibility;
}

/**
 * What can be uploaded, by whom, and how big. A new kind of file is one more entry here; the
 * module that stores its key (product, return request…) decides when it is deleted.
 */
export const UPLOAD_PURPOSES = {
  avatar: {
    allowed: 'anyone',
    label: 'Ảnh đại diện',
    maxBytes: 5 * MB,
    types: IMAGES,
    visibility: 'public',
  },
  'blog-image': {
    allowed: ['admin.blog.manage'],
    label: 'Ảnh bài viết',
    maxBytes: 10 * MB,
    types: IMAGES,
    visibility: 'public',
  },
  'content-image': {
    allowed: ['admin.content.manage'],
    label: 'Ảnh trang thông tin',
    maxBytes: 10 * MB,
    types: IMAGES,
    visibility: 'public',
  },
  /** A photo of a MakerWorld / Printables model, copied to R2 so the shop never hotlinks their CDN. */
  'external-model-image': {
    allowed: ['admin.products.manage'],
    label: 'Ảnh mẫu ngoài',
    maxBytes: 10 * MB,
    types: IMAGES,
    visibility: 'public',
  },
  /** A file the workshop prints a MakerWorld / Printables model from: staff only, never customers. */
  'external-model-file': {
    allowed: ['admin.products.manage'],
    label: 'Tệp in mẫu ngoài',
    maxBytes: 300 * MB,
    types: PRINT_FILES,
    visibility: 'private',
  },
  /** A screenshot of a model's licence on MakerWorld / Printables…: the shop's proof it may sell prints. */
  'license-evidence': {
    allowed: ['admin.products.manage'],
    label: 'Ảnh chụp giấy phép mẫu',
    maxBytes: 10 * MB,
    types: { ...IMAGES, ...DOCUMENTS },
    visibility: 'private',
  },
  model: {
    allowed: 'anyone',
    label: 'Mô hình 3D',
    maxBytes: 100 * MB,
    types: MODELS,
    visibility: 'private',
  },
  'order-artwork': {
    allowed: 'anyone',
    label: 'File in của đơn hàng',
    maxBytes: 20 * MB,
    types: { ...IMAGES, ...DOCUMENTS },
    visibility: 'private',
  },
  /** The 3D model of a product in the shop: customers turn it around on the product page. */
  'product-model': {
    allowed: ['admin.products.manage'],
    label: 'Mô hình 3D sản phẩm',
    maxBytes: 100 * MB,
    types: MODELS,
    visibility: 'public',
  },
  'product-image': {
    allowed: ['admin.products.manage'],
    label: 'Ảnh sản phẩm',
    maxBytes: 10 * MB,
    types: IMAGES,
    visibility: 'public',
  },
  'return-photo': {
    allowed: 'anyone',
    label: 'Ảnh đổi trả',
    maxBytes: 10 * MB,
    types: IMAGES,
    visibility: 'private',
  },
  'support-attachment': {
    allowed: 'anyone',
    label: 'File đính kèm hỗ trợ',
    maxBytes: 10 * MB,
    types: { ...IMAGES, ...DOCUMENTS },
    visibility: 'private',
  },
} as const satisfies Record<string, UploadPurpose>;

export type UploadPurposeKey = keyof typeof UPLOAD_PURPOSES;

export const UPLOAD_PURPOSE_KEYS = Object.keys(
  UPLOAD_PURPOSES,
) as UploadPurposeKey[];
