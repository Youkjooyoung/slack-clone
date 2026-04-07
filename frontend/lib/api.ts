import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  pendingQueue = []
}

function getStoredAuth(): { accessToken?: string; refreshToken?: string } | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|; )auth-storage=([^;]*)/)
  if (!match) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as {
      state?: { accessToken?: string; refreshToken?: string }
    }
    return parsed?.state ?? null
  } catch {
    return null
  }
}

function updateStoredTokens(accessToken: string, refreshToken: string) {
  if (typeof document === 'undefined') return
  const match = document.cookie.match(/(?:^|; )auth-storage=([^;]*)/)
  if (!match) return
  try {
    const obj = JSON.parse(decodeURIComponent(match[1])) as {
      state?: Record<string, unknown>
    }
    obj.state = { ...obj.state, accessToken, refreshToken }
    const encoded = encodeURIComponent(JSON.stringify(obj))
    document.cookie = `auth-storage=${encoded}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
  } catch {
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const auth = getStoredAuth()
  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const auth = getStoredAuth()
      const refreshToken = auth?.refreshToken

      if (!refreshToken) return Promise.reject(error)

      const { data } = await axios.post<{
        success: boolean
        data: { accessToken: string; refreshToken: string }
      }>(`${BASE_URL}/api/auth/refresh`, { refreshToken })

      const newAccessToken = data.data.accessToken
      const newRefreshToken = data.data.refreshToken

      updateStoredTokens(newAccessToken, newRefreshToken)

      flushQueue(null, newAccessToken)
      original.headers.Authorization = `Bearer ${newAccessToken}`
      return api(original)
    } catch (err) {
      flushQueue(err, null)
      if (typeof document !== 'undefined') {
        document.cookie = 'auth-storage=; path=/; max-age=0'
        window.location.href = '/auth/login'
      }
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
}

export interface SignUpPayload {
  email: string
  password: string
  username: string
  avatarUrl?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export const authApi = {
  signUp: (payload: SignUpPayload) =>
    api.post<ApiResponse<TokenResponse>>('/api/auth/signup', payload),

  login: (payload: LoginPayload) =>
    api.post<ApiResponse<TokenResponse>>('/api/auth/login', payload),

  logout: () =>
    api.post<ApiResponse<null>>('/api/auth/logout'),
}

// ─── User ────────────────────────────────────────────────────────────────────

export const userApi = {
  getMe: () => api.get<ApiResponse<import('@/types').UserProfile>>('/api/users/me'),
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspaceApi = {
  create: (payload: { name: string; slug: string; description?: string; iconUrl?: string }) =>
    api.post<ApiResponse<import('@/types').Workspace>>('/api/workspaces', payload),

  getMyWorkspaces: () =>
    api.get<ApiResponse<import('@/types').Workspace[]>>('/api/workspaces'),

  getOne: (workspaceId: string) =>
    api.get<ApiResponse<import('@/types').Workspace>>(`/api/workspaces/${workspaceId}`),

  update: (workspaceId: string, payload: { name: string; description?: string; iconUrl?: string }) =>
    api.put<ApiResponse<import('@/types').Workspace>>(`/api/workspaces/${workspaceId}`, payload),

  delete: (workspaceId: string) =>
    api.delete<ApiResponse<null>>(`/api/workspaces/${workspaceId}`),

  invite: (workspaceId: string, email: string) =>
    api.post<ApiResponse<import('@/types').WorkspaceMember>>(
      `/api/workspaces/${workspaceId}/members`,
      { email }
    ),

  getMembers: (workspaceId: string) =>
    api.get<ApiResponse<import('@/types').WorkspaceMember[]>>(
      `/api/workspaces/${workspaceId}/members`
    ),

  removeMember: (workspaceId: string, userId: string) =>
    api.delete<ApiResponse<null>>(`/api/workspaces/${workspaceId}/members/${userId}`),
}

// ─── Channel ─────────────────────────────────────────────────────────────────

export const channelApi = {
  create: (
    workspaceId: string,
    payload: { name: string; description?: string; isPrivate: boolean }
  ) =>
    api.post<ApiResponse<import('@/types').Channel>>(
      `/api/workspaces/${workspaceId}/channels`,
      payload
    ),

  getChannels: (workspaceId: string) =>
    api.get<ApiResponse<import('@/types').Channel[]>>(
      `/api/workspaces/${workspaceId}/channels`
    ),

  getOne: (workspaceId: string, channelId: string) =>
    api.get<ApiResponse<import('@/types').Channel>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}`
    ),

  update: (workspaceId: string, channelId: string, payload: { name: string; description?: string }) =>
    api.put<ApiResponse<import('@/types').Channel>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}`,
      payload
    ),

  delete: (workspaceId: string, channelId: string) =>
    api.delete<ApiResponse<null>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}`
    ),

  join: (workspaceId: string, channelId: string) =>
    api.post<ApiResponse<import('@/types').ChannelMember>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/members`
    ),

  getMembers: (workspaceId: string, channelId: string) =>
    api.get<ApiResponse<import('@/types').ChannelMember[]>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/members`
    ),

  leave: (workspaceId: string, channelId: string) =>
    api.delete<ApiResponse<null>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/members/me`
    ),
}

// ─── Message ─────────────────────────────────────────────────────────────────

// ─── File ────────────────────────────────────────────────────────────────────

export const fileApi = {
  requestUpload: (payload: { fileName: string; mimeType: string; fileSize: number }) =>
    api.post<ApiResponse<import('@/types').Attachment>>('/api/files/upload', payload),
}

// ─── Message ─────────────────────────────────────────────────────────────────

export const messageApi = {
  getMessages: (workspaceId: string, channelId: string, cursor?: string) =>
    api.get<ApiResponse<import('@/types').MessagePage>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/messages`,
      { params: cursor ? { cursor } : {} }
    ),

  editMessage: (messageId: string, content: string) =>
    api.put<ApiResponse<import('@/types').ChatMessage>>(
      `/api/messages/${messageId}`,
      { content }
    ),

  deleteMessage: (messageId: string) =>
    api.delete<ApiResponse<null>>(`/api/messages/${messageId}`),

  markAsRead: (workspaceId: string, channelId: string) =>
    api.post<ApiResponse<null>>(
      `/api/workspaces/${workspaceId}/channels/${channelId}/read`
    ),
}
