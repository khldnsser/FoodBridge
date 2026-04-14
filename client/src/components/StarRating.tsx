import { Star } from 'lucide-react';

interface DisplayProps {
  rating: number;
  count?: number;
  size?: number;
}

export function StarDisplay({ rating, count, size = 14 }: DisplayProps) {
  return (
    <div className="flex items-center gap-1">
      <Star size={size} className="text-yellow-400 fill-yellow-400" />
      <span className="text-sm font-medium text-gray-700">{rating > 0 ? rating.toFixed(1) : '—'}</span>
      {count !== undefined && <span className="text-xs text-gray-400">({count})</span>}
    </div>
  );
}

interface PickerProps {
  value: number;
  onChange: (v: number) => void;
}

export function StarPicker({ value, onChange }: PickerProps) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} className="p-1">
          <Star
            size={32}
            className={s <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  );
}
