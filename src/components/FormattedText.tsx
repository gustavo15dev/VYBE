import React from 'react';
import { UserProfile } from '../types/user';

interface FormattedTextProps {
  text: string;
  allUsers?: UserProfile[];
  onHashtagClick?: (tag: string) => void;
  onUserClick?: (username: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onSelectUser?: (uid: string) => void;
  className?: string;
}

export function FormattedText({
  text,
  allUsers = [],
  onHashtagClick,
  onUserClick,
  onSelectHashtag,
  onSelectUser,
  className = '',
}: FormattedTextProps) {
  if (!text) return null;

  const handleHashtag = onSelectHashtag || onHashtagClick;

  const handleUser = (username: string) => {
    if (onSelectUser) {
      const foundUser = allUsers.find(
        (u) => u.username.toLowerCase().replace(/^@/, '') === username
      );
      if (foundUser) {
        onSelectUser(foundUser.uid);
        return;
      }
    }
    if (onUserClick) {
      onUserClick(username);
    }
  };

  // Regex to match #hashtag or @username tokens
  const tokenRegex = /(#[\w\u00C0-\u017F]+|@[\w.]+)/g;
  const parts = text.split(tokenRegex);

  // Set of valid lowercased usernames for quick lookup
  const userMap = new Map<string, UserProfile>();
  allUsers.forEach((u) => {
    userMap.set(u.username.toLowerCase().replace(/^@/, ''), u);
  });

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('#')) {
          const tag = part.slice(1).toLowerCase();
          return (
            <span
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                if (handleHashtag) {
                  handleHashtag(tag);
                }
              }}
              className="text-[#548687] font-semibold hover:underline cursor-pointer inline-block"
            >
              {part}
            </span>
          );
        }

        if (part.startsWith('@')) {
          const username = part.slice(1).toLowerCase();
          const targetUser = userMap.get(username);

          if (targetUser || onUserClick || onSelectUser) {
            return (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUser(username);
                }}
                className="text-[#548687] font-semibold hover:underline cursor-pointer inline-block"
              >
                {part}
              </span>
            );
          }
        }

        // Normal plain text or un-linkable mention
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
}
