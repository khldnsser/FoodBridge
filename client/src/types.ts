export interface User {
  id: string;
  username: string;
  email: string;
  name: string | null;
  photo: string | null;
  neighborhood: string | null;
  role: 'individual' | 'restaurant';
  dietary_prefs: string[];
  id_verified: boolean;
  id_doc_url: string | null;
  id_doc_status: 'none' | 'pending' | 'approved' | 'rejected';
  avg_rating: number;
  rating_count: number;
  total_shared: number;
  total_claimed: number;
  is_suspended: boolean;
  is_admin: boolean;
  profile_complete: boolean;
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
  distance_km?: number | null;
  // pricing
  original_price?: number | null;
  listing_price?: number | null;
  // joined fields from search_listings_nearby RPC
  lister_name?: string | null;
  lister_photo?: string | null;
  lister_avg_rating?: number | null;
  lister_role?: string | null;
}

export interface Claim {
  id: string;
  listing_id: string;
  claimer_id: string;
  status: 'active' | 'cancelled' | 'completed';
  pickup_confirmed_lister: boolean;
  pickup_confirmed_claimer: boolean;
  rated_by_lister: boolean;
  rated_by_claimer: boolean;
  created_at: string;
  // joined fields
  listings?: Partial<Listing> & { users?: Partial<User> };
  users?: Partial<User>;
}

export interface Message {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  users?: { name: string | null; photo: string | null };
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
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
  users?: { name: string | null; photo: string | null };
}

export type StorageCondition = 'room_temperature' | 'refrigerated' | 'frozen';

export const CATEGORIES = ['Dairy', 'Canned goods', 'Snacks', 'Bread & bakery', 'Boxed meals & pasta', 'Beverages', 'Other'] as const;
export const DIETARY_TAGS = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'] as const;
export const STORAGE_CONDITIONS: { value: StorageCondition; label: string; icon: string }[] = [
  { value: 'room_temperature', label: 'Room temperature', icon: '🌡️' },
  { value: 'refrigerated', label: 'Refrigerated', icon: '❄️' },
  { value: 'frozen', label: 'Frozen', icon: '🧊' },
];
