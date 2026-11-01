import type { AuthUser } from '../access/auth-user';
import { RateLimiter } from '../common/rate-limiter';
import type { StorageService } from '../storage/storage.service';
import { UploadsService, parseKey } from './uploads.service';

const person = (permissions: string[] = [], id = 'user-1'): AuthUser => ({
  active: true,
  avatarUrl: '',
  email: `${id}@s3d.local`,
  id,
  kind: permissions.length ? 'staff' : 'customer',
  lastLoginAt: null,
  name: id,
  permissions,
  phone: '',
  role: null,
});

function setup() {
  const storage = {
    describe: jest
      .fn()
      .mockResolvedValue({ contentType: 'image/png', size: 10 }),
    publicUrl: jest.fn((key: string) => `https://files.s3d.vn/${key}`),
    signDownload: jest.fn((key: string) =>
      Promise.resolve({ expiresAt: 'soon', url: `https://r2/${key}?signed` }),
    ),
    signUpload: jest.fn((key: string) =>
      Promise.resolve({ expiresAt: 'soon', url: `https://r2/${key}?put` }),
    ),
  };
  const service = new UploadsService(
    storage as unknown as StorageService,
    new RateLimiter(),
  );
  return { service, storage };
}

describe('UploadsService', () => {
  it('gives staff a public link for a product photo, signed for its type and size', async () => {
    const { service, storage } = setup();
    const ticket = await service.createUpload(
      person(['admin.products.manage']),
      {
        contentType: 'image/PNG',
        fileName: 'Đèn ngủ.PNG',
        purpose: 'product-image',
        size: 2048,
      },
    );
    expect(ticket.key).toMatch(
      /^public\/product-image\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/,
    );
    expect(ticket).toMatchObject({
      headers: { 'Content-Type': 'image/png' },
      method: 'PUT',
      publicUrl: `https://files.s3d.vn/${ticket.key}`,
      visibility: 'public',
    });
    expect(storage.signUpload).toHaveBeenCalledWith(
      ticket.key,
      'image/png',
      2048,
    );
  });

  it('keeps customers out of the catalogue uploads', async () => {
    const { service } = setup();
    await expect(
      service.createUpload(person(), {
        contentType: 'image/png',
        fileName: 'a.png',
        purpose: 'product-image',
        size: 10,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("puts a customer's model under their own id, privately", async () => {
    const { service } = setup();
    const ticket = await service.createUpload(person(), {
      contentType: 'application/octet-stream',
      fileName: 'mo-hinh.stl',
      purpose: 'model',
      size: 5_000_000,
    });
    expect(ticket.key).toMatch(/^private\/model\/user-1\/[0-9a-f-]{36}\.stl$/);
    expect(ticket.publicUrl).toBeNull();
  });

  it('refuses a type the purpose does not take, and a file too big', async () => {
    const { service } = setup();
    const upload = (fileName: string, contentType: string, size: number) =>
      service.createUpload(person(), {
        contentType,
        fileName,
        purpose: 'avatar',
        size,
      });
    await expect(upload('anh.exe', 'image/png', 10)).rejects.toMatchObject({
      messageCode: 'UPLOAD.TYPE_NOT_ALLOWED',
    });
    // A renamed file: the extension says png, the type says it is not.
    await expect(upload('anh.png', 'text/html', 10)).rejects.toMatchObject({
      messageCode: 'UPLOAD.TYPE_NOT_ALLOWED',
    });
    await expect(
      upload('anh.png', 'image/png', 6 * 1024 * 1024),
    ).rejects.toMatchObject({
      message: 'Ảnh đại diện tối đa 5 MB.',
      messageCode: 'UPLOAD.TOO_LARGE',
    });
  });

  it('opens a private file for its owner and staff only', async () => {
    const { service } = setup();
    const key = 'private/return-photo/user-1/1b2c.jpg';
    await expect(service.downloadLink(person(), key)).resolves.toMatchObject({
      url: `https://r2/${key}?signed`,
    });
    await expect(
      service.downloadLink(person(['admin.orders.view'], 'staff-1'), key),
    ).resolves.toBeTruthy();
    await expect(
      service.downloadLink(person([], 'user-2'), key),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('serves only public files through /files', async () => {
    const { service } = setup();
    await expect(
      service.publicLink('public/product-image/2026/10/a.png'),
    ).resolves.toContain('?signed');
    await expect(
      service.publicLink('private/model/user-1/a.stl'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('accepts a saved key only for its purpose, its owner, and once uploaded', async () => {
    const { service, storage } = setup();
    const key = 'private/model/user-1/a.stl';
    await expect(
      service.assertUploaded(person(), key, 'model'),
    ).resolves.toBeTruthy();
    await expect(
      service.assertUploaded(person(), key, 'return-photo'),
    ).rejects.toMatchObject({ messageCode: 'UPLOAD.INVALID_KEY' });
    await expect(
      service.assertUploaded(person([], 'user-2'), key, 'model'),
    ).rejects.toMatchObject({ messageCode: 'UPLOAD.INVALID_KEY' });

    storage.describe.mockResolvedValueOnce(null);
    await expect(
      service.assertUploaded(person(), key, 'model'),
    ).rejects.toMatchObject({
      messageCode: 'UPLOAD.MISSING',
    });
  });

  it('reads keys', () => {
    expect(parseKey('private/model/user-1/a.stl')).toEqual({
      owner: 'user-1',
      purpose: 'model',
      visibility: 'private',
    });
    expect(parseKey('public/unknown/a.png')).toBeNull();
    expect(parseKey('secret/model/a.png')).toBeNull();
  });
});
