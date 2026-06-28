import type {
  ApplicationStatus,
  ApplicationStatusUpdate,
  AuthResponse,
  CertificationInput,
  CompanyInput,
  ConnectionRequestInput,
  JobApplyInput,
  JobInput,
  JobUpdate,
  LicenseInput,
  LoginInput,
  PaymentSheetParams,
  SubscriptionStatus,
  PortfolioPhotoInput,
  PostCommentInput,
  PostInput,
  RegisterInput,
  SetSkillsInput,
  SetTradesInput,
  UserSettingsInput,
  WorkHistoryInput,
  WorkerProfileInput,
  WorkplaceVerifyInput,
} from '@blubranch/shared';
import { Platform } from 'react-native';

// Pick a base URL that works for the platform you're testing on.
// - iOS simulator: http://localhost:4000
// - Android emulator: http://10.0.2.2:4000
// - Real device on LAN: set EXPO_PUBLIC_API_URL in .env
function defaultBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Public base URL of the API — used to build https share links that resolve to
// the OpenGraph preview page (GET /share/post/:id).
export function apiBaseUrl(): string {
  return defaultBaseUrl();
}

// Transparent token refresh. The auth layer registers a handler that swaps an
// expired access token (15m TTL) for a fresh one using the stored refresh
// token; `request()` calls it on a 401 and retries once. A single in-flight
// promise is shared so a burst of concurrent 401s triggers only one refresh.
let refreshHandler: (() => Promise<string | null>) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setRefreshHandler(fn: (() => Promise<string | null>) | null): void {
  refreshHandler = fn;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.body && !(init.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${defaultBaseUrl()}${path}`, { ...init, headers });

  // On a 401, the access token has likely expired mid-session. Transparently
  // refresh once and retry so a long flow (e.g. onboarding) doesn't dead-end
  // with "Valid bearer token required". Skip /auth/* to avoid refresh recursion
  // and skip the retry itself (allowRefresh=false) so a still-401 can't loop.
  if (
    res.status === 401 &&
    allowRefresh &&
    accessToken &&
    refreshHandler &&
    !path.startsWith('/auth/')
  ) {
    if (!refreshInFlight) {
      refreshInFlight = refreshHandler().finally(() => {
        refreshInFlight = null;
      });
    }
    const newToken = await refreshInFlight;
    if (newToken) return request<T>(path, init, false);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? data?.error ?? res.statusText, data?.issues);
  }
  return data as T;
}

// ── Auth ────────────────────────────────────────────────────────
export const auth = {
  register: (input: RegisterInput) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: LoginInput) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  refresh: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  sendPhoneCode: (phone: string) =>
    request<{ sent: boolean; devCode?: string }>('/auth/verify-phone/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyPhoneCode: (phone: string, code: string) =>
    request<{ verified: boolean }>('/auth/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  checkEmail: (email: string) =>
    request<{ available: boolean }>('/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  sendVerificationEmail: (email: string) =>
    request<{ sent: boolean; devCode?: string }>('/auth/send-verification-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyEmailCode: (email: string, code: string) =>
    request<{ verified: boolean }>('/auth/verify-email-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
};

// ── Profile ─────────────────────────────────────────────────────
export const me = {
  get: () => request<MeResponse>('/users/me'),
  updatePhoto: (profilePhotoUrl: string) =>
    request<{ profilePhotoUrl: string | null }>('/users/me/photo', {
      method: 'PUT',
      body: JSON.stringify({ profilePhotoUrl }),
    }),
  updateWorkerProfile: (input: WorkerProfileInput) =>
    request<unknown>('/users/me/worker-profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  setTrades: (input: SetTradesInput) =>
    request<{ id: number; name: string; slug: string }[]>('/users/me/trades', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  setSkills: (input: SetSkillsInput) =>
    request<{ id: number; name: string }[]>('/users/me/skills', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  addCertification: (input: CertificationInput) =>
    request<unknown>('/users/me/certifications', { method: 'POST', body: JSON.stringify(input) }),
  addPortfolioPhoto: (input: PortfolioPhotoInput) =>
    request<unknown>('/users/me/portfolio-photos', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  addWorkHistory: (input: WorkHistoryInput) =>
    request<unknown>('/users/me/work-history', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateSettings: (input: UserSettingsInput) =>
    request<unknown>('/users/me/settings', { method: 'PUT', body: JSON.stringify(input) }),
  addLicense: (input: LicenseInput) =>
    request<LicenseRecord>('/users/me/licenses', { method: 'POST', body: JSON.stringify(input) }),
  addWorkplace: (input: WorkplaceVerifyInput) =>
    request<WorkplaceRecord>('/users/me/workplaces', { method: 'POST', body: JSON.stringify(input) }),
};

// ── Public profile ──────────────────────────────────────────────
export const users = {
  get: (id: string) => request<PublicProfile>(`/users/${id}`),
  getBySlug: (slug: string) => request<PublicProfile>(`/u/${slug}`),
};

// ── Reference ───────────────────────────────────────────────────
export const reference = {
  trades: () => request<{ id: number; name: string; slug: string }[]>('/reference/trades'),
  skills: (tradeId?: number) =>
    request<{ id: number; name: string; tradeId: number | null }[]>(
      `/reference/skills${tradeId ? `?tradeId=${tradeId}` : ''}`,
    ),
  benefits: () => request<{ id: number; name: string }[]>('/reference/benefits'),
};

// ── Upload ──────────────────────────────────────────────────────
export async function uploadImage(uri: string, filename = 'upload.jpg'): Promise<string> {
  const form = new FormData();
  // React Native's FormData accepts the {uri,name,type} shape.
  form.append('file', {
    uri,
    name: filename,
    type: 'image/jpeg',
  } as unknown as Blob);
  const res = await request<{ url: string }>('/upload/image', { method: 'POST', body: form });
  return res.url;
}

// ── Response shapes (loose — mirrors API output) ────────────────
export interface LicenseRecord {
  id: string;
  type: string;
  number: string;
  issuingState: string;
  expiresAt: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  verificationMethod: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface WorkplaceRecord {
  id: string;
  companyName: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  location: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  verificationMethod: string | null;
  verifiedAt: string | null;
  verificationEmail: string | null;
  createdAt: string;
}

export interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: 'worker' | 'employer' | 'admin';
  authProvider: string;
  profilePhotoUrl: string | null;
  isVerified: boolean;
  emailVerified?: boolean;
  workerProfile: WorkerProfileFields | null;
  settings: {
    openToWork: boolean;
    showHourlyRate: boolean;
    showUnion: boolean;
    financialTips: boolean;
    jobAlerts: boolean;
    notifyMessages: boolean;
    notifyConnectionRequests: boolean;
    notifyApplicationStatus: boolean;
    notifyJobMatch: boolean;
    notifyProfileViews: boolean;
    notifyProfileNudges: boolean;
    notifyPostLikes: boolean;
    notifyPostComments: boolean;
    notifyMentions: boolean;
  } | null;
  trades: { id: number; name: string; slug: string }[];
  skills: { id: number; name: string; tradeId: number | null }[];
  certifications: {
    id: string;
    name: string;
    certificationNumber: string | null;
    isVerified: boolean;
  }[];
  portfolioPhotos: { id: string; photoUrl: string; caption: string | null; sortOrder: number }[];
  workHistory: {
    id: string;
    companyName: string;
    title: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
  }[];
  licenses: LicenseRecord[];
  workPlaces: WorkplaceRecord[];
}

export interface WorkerProfileFields {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  experienceLevel:
    | 'years_0_2'
    | 'years_3_5'
    | 'years_6_10'
    | 'years_11_15'
    | 'years_16_20'
    | 'years_20_plus';
  hourlyRate: string | number | null;
  city: string;
  state: string;
  zipCode: string;
  travelRadiusMiles: number;
  jobAvailability: 'open' | 'actively_looking' | 'not_looking';
  unionName: string | null;
  licenseNumber: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  currentStartDate: string | null;
  currentEndDate: string | null;
}

export interface PublicProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  role: string;
  isVerified: boolean;
  workerProfile: WorkerProfileFields | null;
  trades: { id: number; name: string; slug: string }[];
  skills: { id: number; name: string }[];
  certifications: {
    id: string;
    name: string;
    certificationNumber: string | null;
    isVerified: boolean;
  }[];
  portfolioPhotos: { id: string; photoUrl: string; caption: string | null }[];
  workHistory: {
    id: string;
    companyName: string;
    title: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
  }[];
  endorsements: {
    id: string;
    endorserId: string;
    endorserTitle: string;
    content: string;
  }[];
  stats: { connections: number; posts: number; endorsements: number; rating: number };
}

// ── Phase 3: jobs / companies / feed / posts ────────────────────

export interface JobSummary {
  id: string;
  title: string;
  payMin: number;
  payMax: number;
  jobType: 'full_time' | 'part_time' | 'contract' | 'temp_to_hire';
  workSetting: 'commercial' | 'residential' | 'industrial' | 'mixed';
  city: string;
  state: string;
  zipCode: string;
  experienceLevel: string;
  openingsCount: number;
  planTier: 'basic' | 'pro' | 'unlimited';
  isFeatured: boolean;
  isUrgent: boolean;
  createdAt: string;
  expiresAt: string;
  company: { id: string; name: string; logoUrl: string | null };
  trade: { id: number; name: string; slug: string };
  distanceMiles: number | null;
}

export interface JobDetail extends JobSummary {
  description: string;
  status: 'draft' | 'open' | 'closed' | 'expired';
  benefits: { id: number; name: string }[];
  applicantCount: number;
  myApplication: {
    id: string;
    status: 'applied' | 'reviewed' | 'shortlisted' | 'hired' | 'rejected';
    appliedAt: string;
  } | null;
}

export interface CompanyFields {
  id: string;
  employerId: string;
  name: string;
  industry: string | null;
  sizeRange: 'size_1_10' | 'size_11_50' | 'size_51_200' | 'size_201_500' | 'size_500_plus';
  website: string | null;
  description: string | null;
  contactEmail: string;
  logoUrl: string | null;
  establishedYear: number | null;
  rating: string | number | null;
}

export interface SearchJobsParams {
  trade?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  type?: JobSummary['jobType'];
  setting?: JobSummary['workSetting'];
  search?: string;
  sort?: 'nearest' | 'newest' | 'pay_highest';
  page?: number;
  limit?: number;
}

export interface SearchJobsResult {
  page: number;
  limit: number;
  total: number;
  results: JobSummary[];
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  appliedAt: string;
  job: {
    id: string;
    title: string;
    city: string;
    state: string;
    payMin: number;
    payMax: number;
    status: string;
    company: { id: string; name: string; logoUrl: string | null };
    trade: { id: number; name: string; slug: string };
  };
}

export interface EmployerJob {
  id: string;
  title: string;
  status: string;
  city: string;
  state: string;
  payMin: number;
  payMax: number;
  applicantCount: number;
  expiresAt: string;
  createdAt: string;
  company: { id: string; name: string };
  trade: { id: number; name: string; slug: string };
}

export interface ApplicantSummary {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  appliedAt: string;
  worker: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
    isVerified: boolean;
    headline: string | null;
    city: string | null;
    state: string | null;
    experienceLevel: string | null;
    trades: { id: number; name: string; slug: string }[];
  };
}

export interface FeedPost {
  id: string;
  content: string;
  createdAt: string;
  photos: { id: string; photoUrl: string; sortOrder: number }[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
    headline: string | null;
    unionName: string | null;
  };
  topComments?: {
    id: string;
    content: string;
    user: { firstName: string; lastName: string; profilePhotoUrl: string | null };
  }[];
}

export interface FeedJobItem {
  id: string;
  title: string;
  payMin: number;
  payMax: number;
  city: string;
  state: string;
  jobType: JobSummary['jobType'];
  workSetting: JobSummary['workSetting'];
  isFeatured: boolean;
  isUrgent: boolean;
  createdAt: string;
  company: { id: string; name: string };
  trade: { name: string; slug: string };
  distanceMiles: number | null;
}

export type FeedItem =
  | { kind: 'post'; data: FeedPost }
  | { kind: 'job'; data: FeedJobItem };

export interface FeedResponse {
  page: number;
  limit: number;
  items: FeedItem[];
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const jobs = {
  search: (params: SearchJobsParams = {}) =>
    request<SearchJobsResult>(
      `/jobs${buildQueryString(params as Record<string, string | number | boolean | undefined>)}`,
    ),
  get: (id: string) => request<JobDetail>(`/jobs/${id}`),
  create: (input: JobInput) =>
    request<JobDetail>('/jobs', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: JobUpdate) =>
    request<JobDetail>(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) =>
    request<void>(`/jobs/${id}`, { method: 'DELETE' }),
  apply: (id: string, input: JobApplyInput = {}) =>
    request<{ id: string; status: ApplicationStatus }>(`/jobs/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  applications: (id: string) =>
    request<ApplicantSummary[]>(`/jobs/${id}/applications`),
  setApplicationStatus: (jobId: string, applicationId: string, input: ApplicationStatusUpdate) =>
    request<ApplicantSummary>(`/jobs/${jobId}/applications/${applicationId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  myApplications: () => request<MyApplication[]>('/users/me/applications'),
  myJobs: () => request<EmployerJob[]>('/users/me/jobs'),
  bookmark: (id: string) =>
    request<{ bookmarked: boolean }>(`/jobs/${id}/bookmark`, { method: 'POST' }),
  unbookmark: (id: string) =>
    request<void>(`/jobs/${id}/bookmark`, { method: 'DELETE' }),
  savedJobs: () => request<JobSummary[]>('/users/me/saved-jobs'),
};

export const companies = {
  myCompany: () => request<CompanyFields | null>('/users/me/company'),
  get: (id: string) => request<CompanyFields>(`/companies/${id}`),
  create: (input: CompanyInput) =>
    request<CompanyFields>('/companies', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: CompanyInput) =>
    request<CompanyFields>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
};

export const payments = {
  // One-time Payment Sheet bootstrap for a Basic/Pro draft job.
  jobIntent: (jobId: string) =>
    request<PaymentSheetParams>(`/payments/jobs/${jobId}/intent`, { method: 'POST' }),
  // Server-side verification backstop — publishes the job if the PI succeeded.
  confirmJob: (jobId: string) =>
    request<{ published: boolean; status: string }>(`/payments/jobs/${jobId}/confirm`, {
      method: 'POST',
    }),
  // Unlimited subscription bootstrap (first invoice payment).
  subscriptionIntent: () =>
    request<PaymentSheetParams>('/payments/subscription/intent', { method: 'POST' }),
  confirmSubscription: () =>
    request<{ active: boolean; status: string }>('/payments/subscription/confirm', {
      method: 'POST',
    }),
  subscriptionStatus: () => request<SubscriptionStatus>('/payments/subscription'),
  cancelSubscription: () =>
    request<{ canceledAtPeriodEnd: boolean }>('/payments/subscription/cancel', { method: 'POST' }),
};

export const feed = {
  get: (page = 1, limit = 20) =>
    request<FeedResponse>(`/feed?page=${page}&limit=${limit}`),
};

export const posts = {
  create: (input: PostInput) =>
    request<FeedPost>('/posts', { method: 'POST', body: JSON.stringify(input) }),
  get: (id: string) => request<FeedPost>(`/posts/${id}`),
  remove: (id: string) => request<{ deleted: boolean }>(`/posts/${id}`, { method: 'DELETE' }),
  archive: (id: string, archived = true) =>
    request<{ archived: boolean }>(`/posts/${id}/archive`, {
      method: 'PUT',
      body: JSON.stringify({ archived }),
    }),
  like: (id: string) => request<{ liked: boolean }>(`/posts/${id}/like`, { method: 'POST' }),
  unlike: (id: string) => request<{ liked: boolean }>(`/posts/${id}/like`, { method: 'DELETE' }),
  comments: (id: string) =>
    request<
      Array<{
        id: string;
        content: string;
        createdAt: string;
        user: { id: string; firstName: string; lastName: string; profilePhotoUrl: string | null };
      }>
    >(`/posts/${id}/comments`),
  comment: (id: string, input: PostCommentInput) =>
    request<unknown>(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify(input) }),
};

// ── Connections ─────────────────────────────────────────────────

export interface ConnectionUser {
  id: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  isVerified: boolean;
  headline: string | null;
  city: string | null;
  state: string | null;
  trade: string | null;
}

export interface ConnectionItem {
  connectionId: string;
  connectedAt: string;
  user: ConnectionUser;
}

export interface PendingInvite {
  connectionId: string;
  createdAt: string;
  user: ConnectionUser;
}

export interface ConnectionsListResponse {
  items: ConnectionItem[];
  total: number;
  page: number;
  limit: number;
}

export type NetworkSuggestion = ConnectionUser & { score: number };

export interface TaggableUser {
  id: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
}

export const connections = {
  list: (params?: { search?: string; sort?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.sort) q.set('sort', params.sort);
    if (params?.page) q.set('page', String(params.page));
    return request<ConnectionsListResponse>(`/connections?${q.toString()}`);
  },
  pending: () => request<PendingInvite[]>('/connections/pending'),
  request: (input: ConnectionRequestInput) =>
    request<{ id: string }>('/connections/request', { method: 'POST', body: JSON.stringify(input) }),
  accept: (id: string) =>
    request<{ id: string }>(`/connections/${id}/accept`, { method: 'PUT' }),
  decline: (id: string) =>
    request<void>(`/connections/${id}`, { method: 'DELETE' }),
  remove: (id: string) =>
    request<void>(`/connections/${id}`, { method: 'DELETE' }),
  suggestions: () => request<NetworkSuggestion[]>('/network/suggestions'),
  // People within 3 branches (degrees) the user can @-tag, name-filtered.
  tagSuggestions: (q?: string) =>
    request<{ items: TaggableUser[] }>(`/tag-suggestions?q=${encodeURIComponent(q ?? '')}`),
};

// ── Messages ──────────────────────────────────────────────────────

export interface ConversationPreview {
  id: string;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    readAt: string | null;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export const messages = {
  conversations: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{ conversations: ConversationPreview[] }>(`/conversations?${q.toString()}`);
  },
  thread: (conversationId: string, params?: { cursor?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.cursor) q.set('cursor', params.cursor);
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{ messages: MessageItem[]; nextCursor?: string }>(
      `/conversations/${conversationId}/messages?${q.toString()}`,
    );
  },
  send: (conversationId: string, content: string) =>
    request<{ message: MessageItem }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  startConversation: (recipientId: string, content: string) =>
    request<{ conversation: { id: string }; message: MessageItem }>('/messages', {
      method: 'POST',
      body: JSON.stringify({ recipientId, content }),
    }),
  markRead: (conversationId: string) =>
    request<{ readCount: number }>(`/conversations/${conversationId}/read`, { method: 'PUT' }),
  unreadCount: () => request<{ unreadCount: number }>('/messages/unread-count'),
};

export const notifications = {
  list: (params?: { page?: number; unreadOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.unreadOnly) q.set('unreadOnly', 'true');
    return request<{ notifications: NotificationItem[]; total: number }>(`/notifications?${q.toString()}`);
  },
  unreadCount: () => request<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (id: string) =>
    request<{ notification: NotificationItem }>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () =>
    request<{ readCount: number }>('/notifications/read-all', { method: 'PUT' }),
  registerDevice: (token: string, platform: 'ios' | 'android' | 'web') =>
    request<unknown>('/devices/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),
  removeDevice: (token: string) =>
    request<void>(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  updatePreferences: (prefs: {
    notifyMessages?: boolean;
    notifyConnectionRequests?: boolean;
    notifyApplicationStatus?: boolean;
    notifyJobMatch?: boolean;
    notifyProfileViews?: boolean;
    notifyProfileNudges?: boolean;
    notifyPostLikes?: boolean;
    notifyPostComments?: boolean;
    notifyMentions?: boolean;
  }) =>
    request<unknown>('/settings/notifications', { method: 'PUT', body: JSON.stringify(prefs) }),
};

// ── Search ──────────────────────────────────────────────────────

export interface SearchResult<T> {
  tab: string;
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface RecentSearch {
  id: string;
  query: string;
  createdAt: string;
}

export const search = {
  query: <T = unknown>(params: {
    q: string;
    tab?: string;
    page?: number;
    jobType?: string;
    payMin?: number;
    openToWork?: boolean;
    union?: boolean;
  }) => {
    const qs = new URLSearchParams();
    qs.set('q', params.q);
    if (params.tab) qs.set('tab', params.tab);
    if (params.page) qs.set('page', String(params.page));
    if (params.jobType) qs.set('jobType', params.jobType);
    if (params.payMin) qs.set('payMin', String(params.payMin));
    if (params.openToWork) qs.set('openToWork', 'true');
    if (params.union) qs.set('union', 'true');
    return request<SearchResult<T>>(`/search?${qs.toString()}`);
  },
  recent: () => request<RecentSearch[]>('/search/recent'),
  deleteRecent: (id: string) =>
    request<void>(`/search/recent/${id}`, { method: 'DELETE' }),
};
