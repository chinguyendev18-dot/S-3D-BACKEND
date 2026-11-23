import { parseModelUrl } from './model-url';

describe('parseModelUrl', () => {
  it.each([
    [
      'https://makerworld.com/en/models/1363398-ams-flipper#profileId-3067475',
      'makerworld',
      '1363398',
      'https://makerworld.com/en/models/1363398',
    ],
    [
      'makerworld.com/vi/models/55289',
      'makerworld',
      '55289',
      'https://makerworld.com/en/models/55289',
    ],
    [
      'https://makerworld.com/zh-tw/models/92486?from=search',
      'makerworld',
      '92486',
      'https://makerworld.com/en/models/92486',
    ],
    [
      'https://www.printables.com/model/3161-3d-benchy',
      'printables',
      '3161',
      'https://www.printables.com/model/3161',
    ],
    [
      'https://www.printables.com/cs/model/3161',
      'printables',
      '3161',
      'https://www.printables.com/model/3161',
    ],
    [
      'https://www.thingiverse.com/thing:763622/files',
      'thingiverse',
      '763622',
      'https://www.thingiverse.com/thing:763622',
    ],
  ])('reads %s', (input, source, externalId, url) => {
    expect(parseModelUrl(input)).toEqual({ externalId, source, url });
  });

  it.each([
    'https://makerworld.com/en/@someone',
    'https://evil-makerworld.com/en/models/1',
    'https://makerworld.com.example.org/en/models/1',
    'https://3dsieutoc.vn/cua-hang/makerworld/1231',
    'không phải link',
  ])('refuses %s', (input) => {
    expect(parseModelUrl(input)).toBeNull();
  });
});
