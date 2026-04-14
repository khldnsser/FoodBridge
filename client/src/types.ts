export interface User {
  id: string;
  phone: string;
  name: string | null;
  photo: string | null;
  neighborhood: string | null;
  role: 'individual' | 'restaurant';
  dietary_prefs: string[];
  phone_verified: number;
  id_verified: number;
  id_doc_status: string;
  avg_rating: number;
  rating_count: number;
  total_shared: number;
  total_claimed: number;
  is_suspended: number;
  is_admin: number;
  profile_complete: number;
  created_at: string;
}

export interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  photos: string[];
  expiry_date: string;
  categories: string[];
  storage_condition: 'room_temperature' | 'refrigerated' | 'frozen';
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  neighborhood: string;
  dietary_tags: string[];
  status: 'active' | 'reserved' | 'claimed' | 'expired' | 'removed';
  created_at: string;
  distance?: number | null;
  user?: Partial<User>;
}

export interface Claim {
  id: string;
  listing_id: string;
  claimer_id: string;
  status: 'active' | 'cancelled' | 'completed';
  pickup_confirmed_lister: number;
  pickup_confirmed_claimer: number;
  rated_by_lister: number;
  rated_by_claimer: number;
  created_at: string;
  title?: string;
  photos?: string[];
  expiry_date?: string;
  claimer_name?: string;
  claimer_photo?: string | null;
  lister_name?: string;
  lister_photo?: string | null;
  is_lister?: boolean;
  other_user?: { name: string; photo: string | null };
}

export interface Message {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name: string;
  sender_photo: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read: number;
  created_at: string;
}

export interface Rating {
  id: string;
  claim_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  review: string;
  created_at: string;
  rater_name?: string;
  rater_photo?: string | null;
}

export type StorageCondition = 'room_temperature' | 'refrigerated' | 'frozen';

export const CATEGORIES = ['Dairy', 'Canned goods', 'Snacks', 'Bread & bakery', 'Boxed meals & pasta', 'Beverages', 'Other'] as const;
export const DIETARY_TAGS = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'] as const;
export const STORAGE_CONDITIONS: { value: StorageCondition; label: string; icon: string }[] = [
  { value: 'room_temperature', label: 'Room temperature', icon: '🌡️' },
  { value: 'refrigerated', label: 'Refrigerated', icon: '❄️' },
  { value: 'frozen', label: 'Frozen', icon: '🧊' },
];
