import React from 'react';
import { Check } from 'lucide-react';
import { UserProfile } from '../types/user';

interface VerifiedBadgeProps {
  verified?: boolean;
  uid?: string;
  allUsers?: UserProfile[];
  className?: string;
  size?: number;
}

export function VerifiedBadge({ verified, uid, allUsers, className = '', size = 14 }: VerifiedBadgeProps) {
  let isVerified = verified;

  if (!isVerified && uid && allUsers) {
    const foundUser = allUsers.find((u) => u.uid === uid);
    if (foundUser) {
      isVerified = foundUser.verificado;
    }
  }

  if (!isVerified) return null;

  return (
    <span
      id={`verified-badge-${uid || 'general'}`}
      className={`inline-flex items-center justify-center rounded-full bg-[#548687] text-white shrink-0 select-none align-middle ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }}
      title="Perfil Verificado"
    >
      <Check strokeWidth={4} style={{ width: `${size * 0.6}px`, height: `${size * 0.6}px` }} />
    </span>
  );
}
