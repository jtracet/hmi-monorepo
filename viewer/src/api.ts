export const API_ROOT = ''

export const api = (path: string) =>
    `${path.startsWith('/') ? '' : '/'}${path}`
