export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'
export type ChannelRole = 'ADMIN' | 'MEMBER'

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  iconUrl: string | null
  ownerId: string
  myRole: WorkspaceRole
  createdAt: string
}

export interface WorkspaceMember {
  userId: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: WorkspaceRole
  joinedAt: string
}

export interface Channel {
  id: string
  workspaceId: string
  name: string
  description: string | null
  isPrivate: boolean
  isArchived: boolean
  createdBy: string
  myRole: ChannelRole | null
  createdAt: string
}

export interface ChannelMember {
  userId: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: ChannelRole
  lastReadAt: string | null
}

export interface ChatMessage {
  id: string
  channelId: string
  senderId: string
  senderUsername: string
  senderDisplayName: string | null
  senderAvatarUrl: string | null
  content: string
  isEdited: boolean
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface MessagePage {
  messages: ChatMessage[]
  hasMore: boolean
  nextCursor: string | null
}

export interface Attachment {
  attachmentId: string
  presignedUrl: string
  fileUrl: string
  fileName: string
  mimeType: string
  fileSize: number
}

export interface UserProfile {
  id: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  statusMessage: string | null
  statusEmoji: string | null
  isOnline: boolean
}
