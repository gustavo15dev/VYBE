import React, { useState, useEffect, useRef, useTransition } from 'react';
import { UserProfile } from '../types/user';
import { HashtagItem } from '../types/social';
import { fetchHashtags } from '../services/socialService';
import { formatHashtagPostCount } from '../utils/hashtagMention';
import { Hash, User } from 'lucide-react';

interface TextWithAutocompleteProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  isTextarea?: boolean;
  allUsers?: UserProfile[];
  myFollowing?: Set<string>;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

export function TextWithAutocomplete({
  value,
  onChange,
  placeholder = '',
  rows = 3,
  maxLength,
  isTextarea = true,
  allUsers = [],
  myFollowing = new Set(),
  className = '',
  id,
  autoFocus = false,
}: TextWithAutocompleteProps) {
  const [triggerType, setTriggerType] = useState<'hashtag' | 'mention' | null>(null);
  const [triggerQuery, setTriggerQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  // Suggestions state
  const [hashtagSuggestions, setHashtagSuggestions] = useState<HashtagItem[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse text around cursor on selection / input change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPos(pos);
    checkTrigger(newValue, pos);
  };

  const handleSelectionOrClick = (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const pos = (e.target as HTMLInputElement).selectionStart || 0;
    setCursorPos(pos);
    checkTrigger(value, pos);
  };

  const checkTrigger = (text: string, pos: number) => {
    const textBeforeCursor = text.slice(0, pos);
    // Find the last word or token being typed before cursor
    // e.g. "tarde incrível com @ana" -> token is "@ana"
    const match = /(#[\w\u00C0-\u017F]*|@[\w.]*)$/.exec(textBeforeCursor);

    if (match) {
      const token = match[1];
      if (token.startsWith('#')) {
        setTriggerType('hashtag');
        setTriggerQuery(token.slice(1).toLowerCase());
        return;
      } else if (token.startsWith('@')) {
        setTriggerType('mention');
        setTriggerQuery(token.slice(1).toLowerCase());
        return;
      }
    }

    setTriggerType(null);
    setTriggerQuery('');
  };

  // Debounced search effect (~300ms)
  useEffect(() => {
    if (!triggerType) {
      setHashtagSuggestions([]);
      setUserSuggestions([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      if (triggerType === 'hashtag') {
        const tags = await fetchHashtags(triggerQuery);
        setHashtagSuggestions(tags);
      } else if (triggerType === 'mention') {
        const query = triggerQuery;
        let matched = allUsers.filter((u) => {
          const uname = u.username.toLowerCase().replace(/^@/, '');
          const dname = (u.displayName || '').toLowerCase();
          return uname.includes(query) || dname.includes(query);
        });

        // Prioritize users current user follows
        matched.sort((a, b) => {
          const aFollows = myFollowing.has(a.uid) ? 1 : 0;
          const bFollows = myFollowing.has(b.uid) ? 1 : 0;
          return bFollows - aFollows;
        });

        setUserSuggestions(matched.slice(0, 8));
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [triggerType, triggerQuery, allUsers, myFollowing]);

  // Insert selected hashtag or mention into text
  const applySuggestion = (selectedText: string) => {
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    // Replace the trailing trigger token before cursor
    const replacedBefore = textBeforeCursor.replace(/(#[\w\u00C0-\u017F]*|@[\w.]*)$/, selectedText + ' ');
    const newFullValue = replacedBefore + textAfterCursor;

    onChange(newFullValue);
    setTriggerType(null);
    setTriggerQuery('');

    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = replacedBefore.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTriggerType(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {isTextarea ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          value={value}
          onChange={handleTextChange}
          onClick={handleSelectionOrClick}
          onKeyUp={handleSelectionOrClick}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={className}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          id={id}
          type="text"
          value={value}
          onChange={handleTextChange}
          onClick={handleSelectionOrClick}
          onKeyUp={handleSelectionOrClick}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={className}
        />
      )}

      {/* Autocomplete Dropdown Overlay (Mockup 1) */}
      {triggerType && (hashtagSuggestions.length > 0 || userSuggestions.length > 0 || isSearching) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden text-left max-h-64 overflow-y-auto animate-in fade-in duration-150">
          <div className="px-3.5 py-2.5 bg-[#F8FAFC] border-b border-gray-100 text-xs font-semibold text-gray-500">
            {triggerType === 'hashtag' ? `Sugestões para #${triggerQuery}` : `Sugestões para @${triggerQuery}`}
          </div>

          {isSearching ? (
            <div className="p-4 text-center text-xs text-gray-400">Buscando...</div>
          ) : triggerType === 'hashtag' ? (
            <div>
              {hashtagSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applySuggestion(`#${item.nome}`)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[#F1F5F5] flex items-center gap-3 transition-colors cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-sm shrink-0">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">#{item.nome}</p>
                    <p className="text-[11px] text-gray-500 font-medium">
                      {formatHashtagPostCount(item.contagem_posts)} publicações
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {userSuggestions.map((u) => {
                const isFollowing = myFollowing.has(u.uid);
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => applySuggestion(`@${u.username}`)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#F1F5F5] flex items-center gap-3 transition-colors cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    {u.photoURL ? (
                      <img
                        src={u.photoURL}
                        alt={u.username}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3B6566] to-[#548687] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {u.displayName?.[0] || u.username[0] || 'U'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {u.displayName || `@${u.username}`}
                      </p>
                      <p className="text-[11px] text-gray-500 font-medium truncate">
                        @{u.username} {isFollowing && <span className="text-[#3B6566] font-semibold">• Seguindo</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
