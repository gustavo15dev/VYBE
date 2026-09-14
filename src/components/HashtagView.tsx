import React, { useState, useEffect } from 'react';
import { Hash, Loader2, Heart, MessageSquare, Play, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { PostItem, HashtagItem } from '../types/social';
import { getHashtagDetailsAndPosts } from '../services/socialService';
import { formatHashtagPostCount } from '../utils/hashtagMention';

interface HashtagViewProps {
  tagName: string;
  onBack?: () => void;
  onOpenPost?: (post: PostItem) => void;
  onSelectUser?: (uid: string) => void;
}

export function HashtagView({
  tagName,
  onBack,
  onOpenPost,
  onSelectUser,
}: HashtagViewProps) {
  const [loading, setLoading] = useState(true);
  const [hashtagData, setHashtagData] = useState<HashtagItem | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);

  const cleanTag = tagName.toLowerCase().replace(/^#/, '');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getHashtagDetailsAndPosts(cleanTag)
      .then(({ hashtag, posts: fetchedPosts }) => {
        if (isMounted) {
          setHashtagData(hashtag);
          setPosts(fetchedPosts);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading hashtag page:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanTag]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Top back navigation bar if provided */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
      )}

      {/* Hashtag Header Banner Card (Mockup 2) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-2xs flex flex-col sm:flex-row items-center sm:items-start gap-5">
        {/* Soft rounded teal hashtag badge icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#E1EEEE] text-[#426F70] flex items-center justify-center font-bold text-2xl sm:text-3xl shrink-0 shadow-2xs">
          <Hash className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            #{cleanTag}
          </h1>
          <p className="text-sm sm:text-base font-semibold text-gray-500">
            {formatHashtagPostCount(hashtagData?.contagem_posts || posts.length)} publicações
          </p>
        </div>
      </div>

      {/* Grid of Hashtag Posts */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#426F70]" />
          <p className="text-xs font-medium">Carregando publicações...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-gray-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
            <Hash className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-800">Nenhuma publicação ainda</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Seja o primeiro a publicar usando a hashtag <span className="font-semibold text-gray-700">#{cleanTag}</span>!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {posts.map((post) => {
            const isVideo =
              post.mediaType === 'video' ||
              (post.mediaUrls && post.mediaUrls.some((u) => u.includes('mp4') || u.includes('video')));
            const displayMedia = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : post.mediaUrl;

            return (
              <div
                key={post.id}
                onClick={() => onOpenPost?.(post)}
                className="group relative aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-gray-200/80 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
              >
                {displayMedia ? (
                  isVideo ? (
                    <div className="w-full h-full relative bg-black">
                      <video
                        src={displayMedia}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center">
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={displayMedia}
                      alt={post.content || 'Midia do post'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )
                ) : (
                  <div className="w-full h-full p-4 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-between">
                    <p className="text-xs font-medium text-gray-800 line-clamp-4">
                      {post.content}
                    </p>
                    <div className="text-[10px] text-gray-400 font-semibold">
                      @{post.authorUsername}
                    </div>
                  </div>
                )}

                {/* Hover overlay with likes and comments */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4 text-white font-bold text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 fill-white" />
                    <span>{post.likesCount || post.likes.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 fill-white" />
                    <span>{post.commentsCount || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
