/** "Đèn ngủ mèo ôm trăng" → "den-ngu-meo-om-trang" (the admin makes slugs the same way). */
export function slugify(value: string, maxLength = 80) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** Adds -2, -3… until `taken` says the slug is free. */
export async function freeSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>,
  fallback = 'muc',
) {
  const root = slugify(base) || fallback;
  let candidate = root;
  for (let suffix = 2; await taken(candidate); suffix += 1)
    candidate = `${root}-${suffix}`;
  return candidate;
}
