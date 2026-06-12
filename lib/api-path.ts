const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const apiPath = (path: string) => `${BASE}${path}`;
