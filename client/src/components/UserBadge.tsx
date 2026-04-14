import { ShieldCheck, Phone, Store, User } from 'lucide-react';
import type { User as UserType } from '../types';

interface Props {
  user: Partial<UserType>;
  size?: 'sm' | 'md';
}

export default function UserBadge({ user, size = 'sm' }: Props) {
  const cls = size === 'sm' ? 'badge text-[10px] px-1.5 py-0.5' : 'badge text-xs px-2 py-1';
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {user.role === 'restaurant' ? (
        <span className={`${cls} bg-orange-100 text-orange-700`}>
          <Store size={10} /> Business
        </span>
      ) : (
        <span className={`${cls} bg-gray-100 text-gray-600`}>
          <User size={10} /> Individual
        </span>
      )}
      {user.id_verified ? (
        <span className={`${cls} bg-brand-100 text-brand-700`}>
          <ShieldCheck size={10} /> ID Verified
        </span>
      ) : user.phone_verified ? (
        <span className={`${cls} bg-blue-100 text-blue-700`}>
          <Phone size={10} /> Phone Verified
        </span>
      ) : null}
    </div>
  );
}
