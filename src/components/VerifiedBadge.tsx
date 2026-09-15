import React from 'react';
import { UserProfile } from '../types/user';

interface VerifiedBadgeProps {
  verified?: boolean;
  uid?: string;
  allUsers?: UserProfile[];
  className?: string;
  size?: number;
  color?: string;
}

export function VerifiedBadge({
  verified,
  uid,
  allUsers,
  className = '',
  size = 14,
  color = '#3897F0',
}: VerifiedBadgeProps) {
  let isVerified = verified;

  if (!isVerified && uid && allUsers) {
    const foundUser = allUsers.find((u) => u.uid === uid);
    if (foundUser) {
      isVerified = foundUser.verificado;
    }
  }

  if (!isVerified) return null;

  return (
    <svg
      id={`verified-badge-${uid || 'general'}`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none align-middle drop-shadow-[0_1px_1px_rgba(56,151,240,0.2)] ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
      }}
      aria-label="Perfil Verificado"
      role="img"
    >
      <title>Perfil Verificado</title>
      {/* 12-point star rosette medallion */}
      <polygon
        points="50.00,13.00 62.04,5.08 68.50,17.96 82.88,17.12 82.04,31.50 94.92,37.96 87.00,50.00 94.92,62.04 82.04,68.50 82.88,82.88 68.50,82.04 62.04,94.92 50.00,87.00 37.96,94.92 31.50,82.04 17.12,82.88 17.96,68.50 5.08,62.04 13.00,50.00 5.08,37.96 17.96,31.50 17.12,17.12 31.50,17.96 37.96,5.08"
        fill={color}
      />
      {/* Crisp, solid white checkmark */}
      <path
        d="M 35.25 47.75 L 44.5 57.0 L 65.25 36.25 L 71.75 42.75 L 44.5 70.0 L 28.75 54.25 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

