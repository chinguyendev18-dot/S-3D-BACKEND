import { ConfigService } from '@nestjs/config';

import { StorageService } from './storage.service';

const storage = (env: Record<string, string>) =>
  new StorageService(new ConfigService(env));

describe('StorageService', () => {
  it('keeps public files in the public bucket and the rest in the private one', () => {
    const service = storage({
      R2_BUCKET: 's3d-files',
      R2_PUBLIC_BUCKET: 's3d-public',
    });
    expect(service.bucketFor('public/product-image/2026/11/a.png')).toBe(
      's3d-public',
    );
    expect(service.bucketFor('private/model/user-1/a.stl')).toBe('s3d-files');
  });

  it('uses one bucket for everything when no public bucket is set', () => {
    const service = storage({ R2_BUCKET: 's3d-files' });
    expect(service.bucketFor('public/avatar/2026/11/a.png')).toBe('s3d-files');
  });

  it('links public files to the public domain, or through this server until there is one', () => {
    expect(
      storage({ R2_PUBLIC_URL: 'https://files.s-3d.vn/' }).publicUrl(
        'public/avatar/2026/11/a b.png',
      ),
    ).toBe('https://files.s-3d.vn/public/avatar/2026/11/a%20b.png');
    expect(
      storage({ PORT: '4000' }).publicUrl('public/avatar/2026/11/a.png'),
    ).toBe('http://localhost:4000/api/v1/files/public/avatar/2026/11/a.png');
  });
});
