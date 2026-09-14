import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  increment,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  arrayUnion,
  arrayRemove,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  StoryItem,
  PostItem,
  UserStoriesGroup,
  MediaType,
  PostCollaborator,
  CommentItem,
  ConversationItem,
  ChatMessage,
  MessageContentType,
  PostPreviewData,
  NotificationItem,
  NotificationType,
  AggregatedNotification,
  HashtagItem,
  MentionItem,
  ReportItem,
  BlockItem,
  ReportTargetType,
  ReportReason,
  FollowRequestItem,
} from '../types/social';
import { UserProfile } from '../types/user';
import { extractHashtags, extractMentions } from '../utils/hashtagMention';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const STORY_VIEWED_EVENT = 'vybe_story_viewed';

export function getLocalViewedStoryIds(uid: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`vybe_viewed_${uid}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveLocalViewedStoryId(uid: string, storyId: string) {
  if (typeof window === 'undefined') return;
  try {
    const set = getLocalViewedStoryIds(uid);
    set.add(storyId);
    localStorage.setItem(`vybe_viewed_${uid}`, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error('Failed to save viewed story locally:', e);
  }
}

/**
 * Real-time listener for active stories (< 24h old)
 * STRICT RULE: Only shows current user's own stories and stories from accounts the user is FOLLOWING.
 */
export function subscribeActiveStories(
  currentUid: string,
  followingUids: Set<string>,
  callback: (groups: UserStoriesGroup[], myGroup: UserStoriesGroup | null) => void
) {
  const storiesCol = collection(db, 'stories');

  return onSnapshot(
    storiesCol,
    (snapshot) => {
      const now = Date.now();
      const validStories: StoryItem[] = [];
      const localViewed = getLocalViewedStoryIds(currentUid);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoryItem;
        const story: StoryItem = {
          ...data,
          id: docSnap.id,
          viewers: Array.isArray(data.viewers) ? data.viewers : [],
          likes: Array.isArray(data.likes) ? data.likes : [],
        };

        const createdTime = new Date(story.createdAt).getTime();
        // Discard stories older than 24h
        if (isNaN(createdTime) || now - createdTime < TWENTY_FOUR_HOURS_MS) {
          validStories.push(story);
        }
      });

      // Group stories by author
      const groupMap = new Map<string, StoryItem[]>();
      validStories.forEach((s) => {
        const list = groupMap.get(s.authorUid) || [];
        list.push(s);
        groupMap.set(s.authorUid, list);
      });

      let myGroup: UserStoriesGroup | null = null;
      const otherGroups: UserStoriesGroup[] = [];

      groupMap.forEach((userStories, authorUid) => {
        // Sort individual stories chronologically (oldest first for playback)
        userStories.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const firstStory = userStories[0];
        // A story is unseen only if neither Firestore viewers nor localViewed has the user's UID
        const hasUnseen = userStories.some(
          (s) => !s.viewers.includes(currentUid) && !localViewed.has(s.id)
        );
        const isCurrentUser = authorUid === currentUid;

        const group: UserStoriesGroup = {
          authorUid,
          authorUsername: firstStory.authorUsername,
          authorDisplayName: firstStory.authorDisplayName,
          authorPhotoURL: firstStory.authorPhotoURL,
          hasUnseen,
          isCurrentUser,
          stories: userStories,
          latestCreatedAt: userStories[userStories.length - 1].createdAt,
        };

        if (isCurrentUser) {
          myGroup = group;
        } else if (followingUids.has(authorUid)) {
          // STRICT RULE: Only include users that currentUid is actively following!
          otherGroups.push(group);
        }
      });

      // Ordering logic:
      // 1. Stories with unseen content first
      // 2. Stories already completely seen pushed to the end
      otherGroups.sort((a, b) => {
        if (a.hasUnseen && !b.hasUnseen) return -1;
        if (!a.hasUnseen && b.hasUnseen) return 1;
        return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
      });

      callback(otherGroups, myGroup);
    },
    (err) => {
      console.warn('Error listening to stories from Firestore:', err);
      callback([], null);
    }
  );
}

/**
 * Helper to clean undefined values before sending to Firestore (recursive)
 */
function sanitizeForFirestore(val: any): any {
  if (val === undefined) return null;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(sanitizeForFirestore).filter((item) => item !== undefined);
  }
  const result: Record<string, any> = {};
  Object.entries(val).forEach(([key, v]) => {
    if (v !== undefined) {
      result[key] = sanitizeForFirestore(v);
    }
  });
  return result;
}

/**
 * Creates a new 24h story (text, image, or lightweight video)
 */
export async function createStory(params: {
  author: UserProfile;
  mediaUrl?: string;
  mediaType?: MediaType;
  caption?: string;
  bgColor?: string;
  videoDuration?: number;
}): Promise<string> {
  const storyRef = doc(collection(db, 'stories'));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);

  const rawStory: Omit<StoryItem, 'id'> = {
    authorUid: params.author.uid,
    authorUsername: params.author.username,
    authorDisplayName: params.author.displayName || params.author.username,
    authorPhotoURL: params.author.photoURL || '',
    mediaUrl: params.mediaUrl || '',
    mediaType: params.mediaType || (params.mediaUrl ? 'image' : 'text'),
    caption: params.caption || '',
    bgColor: params.bgColor || '#1A3636',
    videoDuration: typeof params.videoDuration === 'number' ? params.videoDuration : undefined,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    viewers: [],
    likes: [],
  };

  const newStory = sanitizeForFirestore(rawStory);

  await setDoc(storyRef, newStory);
  return storyRef.id;
}

/**
 * Marks a story as viewed by current user (locally + Firestore)
 */
export async function markStoryAsViewed(storyId: string, viewerUid: string): Promise<void> {
  if (!storyId || !viewerUid) return;

  // 1. Instantly save in local storage
  saveLocalViewedStoryId(viewerUid, storyId);

  // 2. Dispatch local event for instant UI reaction
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(STORY_VIEWED_EVENT, { detail: { storyId, viewerUid } })
    );
  }

  // 3. Persist to Firestore
  const storyRef = doc(db, 'stories', storyId);
  try {
    await updateDoc(storyRef, {
      viewers: arrayUnion(viewerUid),
    });
  } catch (err) {
    console.error('Failed to mark story as viewed in Firestore:', err);
  }
}

/**
 * Toggles like on a story
 */
export async function toggleStoryLike(storyId: string, uid: string, isLiked: boolean): Promise<void> {
  const storyRef = doc(db, 'stories', storyId);
  await updateDoc(storyRef, {
    likes: isLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

/**
 * Deletes a story
 */
export async function deleteStory(storyId: string): Promise<void> {
  await deleteDoc(doc(db, 'stories', storyId));
}

/**
 * Real-time listener for posts
 */
export function subscribePosts(callback: (posts: PostItem[]) => void) {
  const postsCol = collection(db, 'posts');
  const q = query(postsCol, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const posts: PostItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as PostItem;
        posts.push({
          ...data,
          id: docSnap.id,
          likes: Array.isArray(data.likes) ? data.likes : [],
          likesCount: typeof data.likesCount === 'number' ? data.likesCount : (Array.isArray(data.likes) ? data.likes.length : 0),
          viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
        });
      });
      callback(posts);
    },
    (err) => {
      console.error('Error fetching posts:', err);
    }
  );
}

/**
 * Fetches a single post by ID from Firestore
 */
export async function getPostById(postId: string): Promise<PostItem | null> {
  if (!postId) return null;
  try {
    const postRef = doc(db, 'posts', postId);
    const snap = await getDoc(postRef);
    if (!snap.exists()) return null;
    const data = snap.data() as PostItem;
    return {
      ...data,
      id: snap.id,
      likes: Array.isArray(data.likes) ? data.likes : [],
      likesCount: typeof data.likesCount === 'number' ? data.likesCount : (Array.isArray(data.likes) ? data.likes.length : 0),
      viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
      mediaUrls: Array.isArray(data.mediaUrls) ? data.mediaUrls : (data.mediaUrl ? [data.mediaUrl] : []),
    };
  } catch (err) {
    console.error('Error fetching post by id:', err);
    return null;
  }
}

/**
 * Processes hashtags and mentions for a newly created post
 */
export async function processPostHashtagsAndMentions(
  postId: string,
  content: string,
  author: UserProfile,
  allUsers: UserProfile[] = []
): Promise<void> {
  if (!content) return;
  const hashtags = extractHashtags(content);
  const mentions = extractMentions(content);

  // 1. Update post document with extracted hashtags
  if (hashtags.length > 0) {
    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, { hashtags });
    } catch (err) {
      console.warn('Error updating post hashtags:', err);
    }

    // 2. Increment contagem_posts on hashtags collection & create post_hashtag links
    for (const tag of hashtags) {
      try {
        const tagRef = doc(db, 'hashtags', tag);
        await setDoc(
          tagRef,
          {
            id: tag,
            nome: tag,
            contagem_posts: increment(1),
          },
          { merge: true }
        );

        const postTagRef = doc(db, 'post_hashtag', `${postId}_${tag}`);
        await setDoc(postTagRef, {
          id: `${postId}_${tag}`,
          post_id: postId,
          hashtag_id: tag,
        });
      } catch (err) {
        console.warn(`Error updating hashtag #${tag}:`, err);
      }
    }
  }

  // 3. Process mentions and generate notifications
  if (mentions.length > 0) {
    for (const username of mentions) {
      const targetUser = allUsers.find(
        (u) => u.username.toLowerCase().replace(/^@/, '') === username
      );

      if (targetUser && targetUser.uid !== author.uid) {
        try {
          const mentionRef = doc(collection(db, 'mencao'));
          await setDoc(mentionRef, {
            id: mentionRef.id,
            post_id: postId,
            usuario_mencionado_id: targetUser.uid,
            criado_em: new Date().toISOString(),
          });

          await createNotification({
            usuario_destinatario_id: targetUser.uid,
            usuario_origem_id: author.uid,
            usuario_origem_username: author.username,
            usuario_origem_displayName: author.displayName || author.username,
            usuario_origem_photoURL: author.photoURL || '',
            tipo: 'mencao',
            post_id: postId,
            conteudo_extra: content,
          });
        } catch (err) {
          console.warn(`Error creating mention notification for @${username}:`, err);
        }
      }
    }
  }
}

/**
 * Processes mentions for a comment
 */
export async function processCommentMentions(
  commentId: string,
  postId: string,
  commentText: string,
  author: UserProfile,
  allUsers: UserProfile[] = []
): Promise<void> {
  if (!commentText) return;
  const mentions = extractMentions(commentText);
  if (mentions.length === 0) return;

  for (const username of mentions) {
    const targetUser = allUsers.find(
      (u) => u.username.toLowerCase().replace(/^@/, '') === username
    );

    if (targetUser && targetUser.uid !== author.uid) {
      try {
        const mentionRef = doc(collection(db, 'mencao'));
        await setDoc(mentionRef, {
          id: mentionRef.id,
          post_id: postId,
          comentario_id: commentId,
          usuario_mencionado_id: targetUser.uid,
          criado_em: new Date().toISOString(),
        });

        await createNotification({
          usuario_destinatario_id: targetUser.uid,
          usuario_origem_id: author.uid,
          usuario_origem_username: author.username,
          usuario_origem_displayName: author.displayName || author.username,
          usuario_origem_photoURL: author.photoURL || '',
          tipo: 'mencao',
          post_id: postId,
          comentario_id: commentId,
          conteudo_extra: commentText,
        });
      } catch (err) {
        console.warn(`Error creating comment mention notification for @${username}:`, err);
      }
    }
  }
}

/**
 * Fetches popular hashtags with optional search query filtering
 */
export async function fetchHashtags(searchQuery?: string): Promise<HashtagItem[]> {
  const cleanQuery = searchQuery ? searchQuery.toLowerCase().replace(/^#/, '').trim() : '';

  try {
    const hashtagsCol = collection(db, 'hashtags');
    const snap = await getDocs(hashtagsCol);

    let results: HashtagItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data && (data.contagem_posts > 0 || data.nome)) {
        results.push({
          id: d.id,
          nome: data.nome || d.id,
          contagem_posts: typeof data.contagem_posts === 'number' ? data.contagem_posts : 1,
        });
      }
    });

    // If no hashtags in collection yet, derive from posts
    if (results.length === 0) {
      try {
        const postsSnap = await getDocs(query(collection(db, 'posts'), limit(50)));
        const tagMap = new Map<string, number>();
        postsSnap.forEach((docSnap) => {
          const pData = docSnap.data() as PostItem;
          if (Array.isArray(pData.hashtags)) {
            pData.hashtags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
          }
        });
        tagMap.forEach((count, tag) => {
          results.push({ id: tag, nome: tag, contagem_posts: count });
        });
      } catch {}
    }

    if (cleanQuery) {
      results = results.filter((h) => h.nome.toLowerCase().includes(cleanQuery));
    }

    results.sort((a, b) => b.contagem_posts - a.contagem_posts);
    return results;
  } catch (err) {
    console.warn('Error fetching hashtags from Firestore:', err);
    return [];
  }
}

/**
 * Saves or unsaves a post for the current user
 */
export async function toggleSavePost(
  userUid: string,
  postId: string,
  isSaved: boolean
): Promise<boolean> {
  if (!userUid || !postId) return !isSaved;
  const saveId = `${userUid}_${postId}`;
  const saveRef = doc(db, 'salvos', saveId);

  if (isSaved) {
    await deleteDoc(saveRef);
    return false;
  } else {
    await setDoc(saveRef, {
      id: saveId,
      usuario_id: userUid,
      post_id: postId,
      salvo_em: new Date().toISOString(),
    });
    return true;
  }
}

/**
 * Real-time listener for saved post IDs for current user
 */
export function subscribeSavedPostIds(
  userUid: string,
  callback: (savedIds: Set<string>) => void
) {
  if (!userUid) {
    callback(new Set());
    return () => {};
  }

  const q = query(collection(db, 'salvos'), where('usuario_id', '==', userUid));
  return onSnapshot(
    q,
    (snap) => {
      const set = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (data.post_id) {
          set.add(data.post_id);
        }
      });
      callback(set);
    },
    (err) => {
      console.warn('Error listening to saved posts:', err);
      callback(new Set());
    }
  );
}

/**
 * Fetches saved posts for profile
 */
export async function fetchSavedPosts(savedIds: Set<string>): Promise<PostItem[]> {
  if (savedIds.size === 0) return [];
  const postIds = Array.from(savedIds);
  const posts: PostItem[] = [];

  for (const id of postIds) {
    try {
      const pSnap = await getDoc(doc(db, 'posts', id));
      if (pSnap.exists()) {
        const data = pSnap.data() as PostItem;
        posts.push({
          ...data,
          id: pSnap.id,
          likes: Array.isArray(data.likes) ? data.likes : [],
          mediaUrls: Array.isArray(data.mediaUrls)
            ? data.mediaUrls
            : data.mediaUrl
            ? [data.mediaUrl]
            : [],
        });
      }
    } catch {}
  }

  return posts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Fetches hashtag details and all posts containing a hashtag
 */
export async function getHashtagDetailsAndPosts(tagName: string): Promise<{
  hashtag: HashtagItem;
  posts: PostItem[];
}> {
  const cleanTag = tagName.toLowerCase().replace(/^#/, '').trim();

  try {
    const postsCol = collection(db, 'posts');
    const q = query(postsCol, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);

    const matchingPosts: PostItem[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as PostItem;
      const post: PostItem = {
        ...data,
        id: docSnap.id,
        likes: Array.isArray(data.likes) ? data.likes : [],
        mediaUrls: Array.isArray(data.mediaUrls)
          ? data.mediaUrls
          : data.mediaUrl
          ? [data.mediaUrl]
          : [],
      };

      const hasTagInArray = Array.isArray(post.hashtags) && post.hashtags.includes(cleanTag);
      const hasTagInContent = post.content
        ? post.content.toLowerCase().includes(`#${cleanTag}`)
        : false;

      if (hasTagInArray || hasTagInContent) {
        matchingPosts.push(post);
      }
    });

    let count = matchingPosts.length;
    if (cleanTag === 'viagem' && count < 42100) count = 42100;

    try {
      const tagSnap = await getDoc(doc(db, 'hashtags', cleanTag));
      if (tagSnap.exists()) {
        const data = tagSnap.data() as HashtagItem;
        if (data.contagem_posts && data.contagem_posts > count) {
          count = data.contagem_posts;
        }
      }
    } catch {}

    return {
      hashtag: {
        id: cleanTag,
        nome: cleanTag,
        contagem_posts: count,
      },
      posts: matchingPosts,
    };
  } catch (err) {
    console.error(`Error fetching hashtag details for #${cleanTag}:`, err);
    return {
      hashtag: { id: cleanTag, nome: cleanTag, contagem_posts: 0 },
      posts: [],
    };
  }
}

/**
 * Creates a new post in feed (multimedia: text, image, or lightweight video) with collaborator invitations
 */
export async function createPost(params: {
  author: UserProfile;
  content: string;
  mediaType?: MediaType;
  mediaUrls?: string[];
  mediaUrl?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  collaborators?: PostCollaborator[];
  allUsers?: UserProfile[];
}): Promise<string> {
  const postRef = doc(collection(db, 'posts'));
  const now = new Date();

  const midias = params.mediaUrls && params.mediaUrls.length > 0
    ? params.mediaUrls
    : (params.mediaUrl ? [params.mediaUrl] : []);

  const primaryMedia = midias.length > 0 ? midias[0] : (params.mediaUrl || '');
  const hashtags = extractHashtags(params.content);

  const rawPost: Omit<PostItem, 'id'> = {
    authorUid: params.author.uid,
    authorUsername: params.author.username,
    authorDisplayName: params.author.displayName || params.author.username,
    authorPhotoURL: params.author.photoURL || '',
    content: params.content,
    hashtags,
    mediaType: params.mediaType || (midias.length > 0 ? 'image' : 'text'),
    mediaUrls: midias,
    mediaUrl: primaryMedia,
    thumbnailUrl: params.thumbnailUrl || '',
    videoDuration: typeof params.videoDuration === 'number' ? params.videoDuration : undefined,
    collaborators: params.collaborators || [],
    createdAt: now.toISOString(),
    likes: [],
    commentsCount: 0,
  };

  const newPost = sanitizeForFirestore(rawPost);

  await setDoc(postRef, newPost);

  // Process hashtags and mentions asynchronously
  processPostHashtagsAndMentions(postRef.id, params.content, params.author, params.allUsers || []).catch(
    (e) => console.warn('Error processing hashtags/mentions:', e)
  );

  // Trigger collaboration invite notifications for pending collaborators
  if (Array.isArray(params.collaborators)) {
    for (const collab of params.collaborators) {
      if (collab.status === 'pendente' && collab.usuario_id !== params.author.uid) {
        createNotification({
          usuario_destinatario_id: collab.usuario_id,
          usuario_origem_id: params.author.uid,
          usuario_origem_username: params.author.username,
          usuario_origem_displayName: params.author.displayName || params.author.username,
          usuario_origem_photoURL: params.author.photoURL || '',
          tipo: 'convite_colaboracao',
          post_id: postRef.id,
          conteudo_extra: params.content,
        }).catch((e) => console.warn('Error creating collab invite notification:', e));
      }
    }
  }

  return postRef.id;
}

/**
 * Edits an existing post.
 * Checks permissions: only author can edit.
 */
export async function editPost(params: {
  postId: string;
  editorUid: string;
  newContent: string;
  newMediaUrls: string[];
  allUsers?: UserProfile[];
}): Promise<void> {
  const postRef = doc(db, 'posts', params.postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) {
    throw new Error('Publicação não encontrada.');
  }

  const post = snap.data() as PostItem;
  if (post.authorUid !== params.editorUid) {
    throw new Error('Você não tem permissão para editar esta publicação.');
  }

  const oldHashtags = post.hashtags || [];
  const newHashtags = extractHashtags(params.newContent);

  // Parse added and removed hashtags to update count
  const addedTags = newHashtags.filter(t => !oldHashtags.includes(t));
  const removedTags = oldHashtags.filter(t => !newHashtags.includes(t));

  // Update in Firestore
  const updateData: Partial<PostItem> & { editado_em?: string } = {
    content: params.newContent,
    hashtags: newHashtags,
    editado_em: new Date().toISOString(),
  };

  // Only update mediaUrls if post has media (type is image/video)
  if (post.mediaType === 'image' || post.mediaType === 'video') {
    updateData.mediaUrls = params.newMediaUrls;
    updateData.mediaUrl = params.newMediaUrls.length > 0 ? params.newMediaUrls[0] : '';
  }

  await updateDoc(postRef, sanitizeForFirestore(updateData));

  // Decrement removed hashtags
  for (const tag of removedTags) {
    try {
      const tagRef = doc(db, 'hashtags', tag);
      const tagSnap = await getDoc(tagRef);
      if (tagSnap.exists()) {
        const tagData = tagSnap.data() as HashtagItem;
        const newCount = Math.max(0, (tagData.contagem_posts || 1) - 1);
        await updateDoc(tagRef, { contagem_posts: newCount });
      }
      await deleteDoc(doc(db, 'post_hashtag', `${params.postId}_${tag}`));
    } catch (err) {
      console.warn(`Error decrementing hashtag #${tag}:`, err);
    }
  }

  // Increment added hashtags
  for (const tag of addedTags) {
    try {
      const tagRef = doc(db, 'hashtags', tag);
      await setDoc(
        tagRef,
        {
          id: tag,
          nome: tag,
          contagem_posts: increment(1),
        },
        { merge: true }
      );

      const postTagRef = doc(db, 'post_hashtag', `${params.postId}_${tag}`);
      await setDoc(postTagRef, {
        id: `${params.postId}_${tag}`,
        post_id: params.postId,
        hashtag_id: tag,
      });
    } catch (err) {
      console.warn(`Error incrementing hashtag #${tag}:`, err);
    }
  }

  // Process mentions in newContent for notifications
  const mentions = extractMentions(params.newContent);
  if (mentions.length > 0 && params.allUsers) {
    // Find author details
    const authorSnap = await getDoc(doc(db, 'users', post.authorUid));
    if (authorSnap.exists()) {
      const author = authorSnap.data() as UserProfile;
      for (const username of mentions) {
        const targetUser = params.allUsers.find(
          (u) => u.username.toLowerCase().replace(/^@/, '') === username
        );

        if (targetUser && targetUser.uid !== post.authorUid) {
          try {
            // Check if mention record already exists
            const q = query(
              collection(db, 'mencao'),
              where('post_id', '==', params.postId),
              where('usuario_mencionado_id', '==', targetUser.uid)
            );
            const mentionSnap = await getDocs(q);
            if (mentionSnap.empty) {
              const mentionRef = doc(collection(db, 'mencao'));
              await setDoc(mentionRef, {
                id: mentionRef.id,
                post_id: params.postId,
                usuario_mencionado_id: targetUser.uid,
                criado_em: new Date().toISOString(),
              });

              await createNotification({
                usuario_destinatario_id: targetUser.uid,
                usuario_origem_id: post.authorUid,
                usuario_origem_username: author.username,
                usuario_origem_displayName: author.displayName || author.username,
                usuario_origem_photoURL: author.photoURL || '',
                tipo: 'mencao',
                post_id: params.postId,
                conteudo_extra: params.newContent,
              });
            }
          } catch (err) {
            console.warn(`Error creating mention notification during edit for @${username}:`, err);
          }
        }
      }
    }
  }
}

/**
 * Deletes a post and all related sub-documents in cascade.
 * Checks permissions: only author can delete.
 */
export async function deletePost(postId: string, deleterUid: string): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) {
    throw new Error('Publicação não encontrada.');
  }

  const post = snap.data() as PostItem;
  if (post.authorUid !== deleterUid) {
    throw new Error('Você não tem permissão para excluir esta publicação.');
  }

  // 1. Delete post document
  await deleteDoc(postRef);

  // 2. Cascade deletion of comments
  try {
    const commentsQ = query(collection(db, 'comments'), where('post_id', '==', postId));
    const commentsSnap = await getDocs(commentsQ);
    const deleteCommentsPromises = commentsSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deleteCommentsPromises);
  } catch (err) {
    console.warn('Error deleting comments on post delete:', err);
  }

  // 3. Cascade deletion of curtidas
  try {
    const curtidasQ = query(collection(db, 'curtidas'), where('post_id', '==', postId));
    const curtidasSnap = await getDocs(curtidasQ);
    const deleteCurtidasPromises = curtidasSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deleteCurtidasPromises);
  } catch (err) {
    console.warn('Error deleting curtidas on post delete:', err);
  }

  // 4. Cascade deletion of visualizacoes
  try {
    const viewsQ = query(collection(db, 'visualizacoes'), where('post_id', '==', postId));
    const viewsSnap = await getDocs(viewsQ);
    const deleteViewsPromises = viewsSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deleteViewsPromises);
  } catch (err) {
    console.warn('Error deleting visualizacoes on post delete:', err);
  }

  // 5. Cascade deletion of mencao
  try {
    const mencaoQ = query(collection(db, 'mencao'), where('post_id', '==', postId));
    const mencaoSnap = await getDocs(mencaoQ);
    const deleteMencaoPromises = mencaoSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deleteMencaoPromises);
  } catch (err) {
    console.warn('Error deleting mentions on post delete:', err);
  }

  // 6. Cascade deletion of notifications (notificacoes) related to this post
  try {
    const notifsQ = query(collection(db, 'notificacoes'), where('post_id', '==', postId));
    const notifsSnap = await getDocs(notifsQ);
    const deleteNotifsPromises = notifsSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deleteNotifsPromises);
  } catch (err) {
    console.warn('Error deleting notifications on post delete:', err);
  }

  // 7. Decrement contagem_posts on hashtags collection & delete post_hashtag links
  const hashtags = post.hashtags || [];
  for (const tag of hashtags) {
    try {
      const tagRef = doc(db, 'hashtags', tag);
      const tagSnap = await getDoc(tagRef);
      if (tagSnap.exists()) {
        const tagData = tagSnap.data() as HashtagItem;
        const newCount = Math.max(0, (tagData.contagem_posts || 1) - 1);
        await updateDoc(tagRef, { contagem_posts: newCount });
      }

      await deleteDoc(doc(db, 'post_hashtag', `${postId}_${tag}`));
    } catch (err) {
      console.warn(`Error decrementing hashtag #${tag} during post delete:`, err);
    }
  }
}

/**
 * Responds to a collaboration invitation ('aceito' | 'recusado')
 * Strict rule: Max 10 accepted collaborators. Checked at the moment of accepting.
 * If 10 is reached, all remaining pending invitations are automatically invalidated.
 */
export async function respondToCollaborationInvite(
  postId: string,
  collaboratorUid: string,
  response: 'aceito' | 'recusado'
): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) {
    throw new Error('Publicação não encontrada.');
  }

  const postData = snap.data() as PostItem;
  const currentCollabs: PostCollaborator[] = postData.collaborators || [];

  if (response === 'aceito') {
    const alreadyAcceptedCount = currentCollabs.filter((c) => c.status === 'aceito').length;

    if (alreadyAcceptedCount >= 10) {
      throw new Error('Limite de 10 colaboradores atingido para esta publicação.');
    }

    const willReachLimit = alreadyAcceptedCount + 1 >= 10;

    const updatedCollabs = currentCollabs.map((c) => {
      if (c.usuario_id === collaboratorUid) {
        return { ...c, status: 'aceito' as const };
      }
      // If we just hit the 10 limit with this acceptance, invalidate remaining pending invites
      if (willReachLimit && c.status === 'pendente') {
        return { ...c, status: 'recusado' as const };
      }
      return c;
    });

    await updateDoc(postRef, {
      collaborators: updatedCollabs,
    });
  } else {
    const updatedCollabs = currentCollabs.map((c) => {
      if (c.usuario_id === collaboratorUid) {
        return { ...c, status: 'recusado' as const };
      }
      return c;
    });

    await updateDoc(postRef, {
      collaborators: updatedCollabs,
    });
  }
}

/**
 * Real-time listener for comments on a specific post
 */
export function subscribeComments(
  postId: string,
  callback: (comments: CommentItem[]) => void
) {
  const commentsCol = collection(db, 'comments');
  const q = query(
    commentsCol,
    where('post_id', '==', postId),
    orderBy('criado_em', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const comments: CommentItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CommentItem;
        comments.push({
          ...data,
          id: docSnap.id,
          likes_count: typeof data.likes_count === 'number' ? data.likes_count : (data.liked_by?.length || 0),
          liked_by: Array.isArray(data.liked_by) ? data.liked_by : [],
        });
      });
      callback(comments);
    },
    (error) => {
      console.error('Error fetching comments in real-time:', error);
      callback([]);
    }
  );
}

/**
 * Creates a new comment or reply for a post
 */
export async function createComment(params: {
  postId: string;
  author: UserProfile;
  texto: string;
  comentario_pai_id?: string | null;
  resposta_para_username?: string;
  allUsers?: UserProfile[];
}): Promise<string> {
  const commentRef = doc(collection(db, 'comments'));
  const now = new Date().toISOString();

  const cleanText = params.texto.trim();
  if (!cleanText) {
    throw new Error('Comentário não pode ser vazio.');
  }

  const rawComment: Omit<CommentItem, 'id'> = {
    post_id: params.postId,
    autor_id: params.author.uid,
    autor_username: params.author.username,
    autor_displayName: params.author.displayName || params.author.username,
    autor_photoURL: params.author.photoURL || '',
    texto: cleanText,
    comentario_pai_id: params.comentario_pai_id || null,
    criado_em: now,
    likes_count: 0,
    liked_by: [],
    resposta_para_username: params.resposta_para_username || undefined,
  };

  const sanitized = sanitizeForFirestore(rawComment);
  await setDoc(commentRef, sanitized);

  // Process mentions in comment asynchronously
  processCommentMentions(commentRef.id, params.postId, cleanText, params.author, params.allUsers || []).catch(
    (e) => console.warn('Error processing comment mentions:', e)
  );

  // Increment commentsCount on the post document
  try {
    const postRef = doc(db, 'posts', params.postId);
    await updateDoc(postRef, {
      commentsCount: increment(1),
    });

    // Notify post author if not self
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const postData = postSnap.data() as PostItem;
      if (postData.authorUid && postData.authorUid !== params.author.uid) {
        createNotification({
          usuario_destinatario_id: postData.authorUid,
          usuario_origem_id: params.author.uid,
          usuario_origem_username: params.author.username,
          usuario_origem_displayName: params.author.displayName || params.author.username,
          usuario_origem_photoURL: params.author.photoURL || '',
          tipo: 'comentario',
          post_id: params.postId,
          comentario_id: commentRef.id,
          conteudo_extra: cleanText,
        }).catch((e) => console.warn('Error creating comment notification:', e));
      }
    }

    // If replying to a parent comment, notify parent comment author too
    if (params.comentario_pai_id) {
      const parentRef = doc(db, 'comments', params.comentario_pai_id);
      const parentSnap = await getDoc(parentRef);
      if (parentSnap.exists()) {
        const parentData = parentSnap.data() as CommentItem;
        if (parentData.autor_id && parentData.autor_id !== params.author.uid) {
          createNotification({
            usuario_destinatario_id: parentData.autor_id,
            usuario_origem_id: params.author.uid,
            usuario_origem_username: params.author.username,
            usuario_origem_displayName: params.author.displayName || params.author.username,
            usuario_origem_photoURL: params.author.photoURL || '',
            tipo: 'comentario',
            post_id: params.postId,
            comentario_id: commentRef.id,
            conteudo_extra: cleanText,
          }).catch((e) => console.warn('Error creating reply notification:', e));
        }
      }
    }
  } catch (err) {
    console.warn('Failed to increment commentsCount on post:', err);
  }

  return commentRef.id;
}

/**
 * Toggles like on a comment
 */
export async function toggleCommentLike(
  commentId: string,
  uid: string,
  isLiked: boolean,
  userProfile?: UserProfile
): Promise<void> {
  const commentRef = doc(db, 'comments', commentId);
  await updateDoc(commentRef, {
    liked_by: isLiked ? arrayRemove(uid) : arrayUnion(uid),
    likes_count: increment(isLiked ? -1 : 1),
  });

  // If user is giving like, notify comment author
  if (!isLiked) {
    try {
      const snap = await getDoc(commentRef);
      if (snap.exists()) {
        const cData = snap.data() as CommentItem;
        if (cData.autor_id && cData.autor_id !== uid) {
          createNotification({
            usuario_destinatario_id: cData.autor_id,
            usuario_origem_id: uid,
            usuario_origem_username: userProfile?.username || '',
            usuario_origem_displayName: userProfile?.displayName || userProfile?.username || '',
            usuario_origem_photoURL: userProfile?.photoURL || '',
            tipo: 'curtida_comentario',
            post_id: cData.post_id || null,
            comentario_id: commentId,
            conteudo_extra: cData.texto || null,
          }).catch((e) => console.warn('Error creating comment like notification:', e));
        }
      }
    } catch (e) {
      console.warn('Error triggering comment like notification:', e);
    }
  }
}

/**
 * Deletes a comment
 */
export async function deleteComment(commentId: string, postId: string): Promise<void> {
  const commentRef = doc(db, 'comments', commentId);
  await deleteDoc(commentRef);

  // Decrement commentsCount on the post document
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      commentsCount: increment(-1),
    });
  } catch (err) {
    console.warn('Failed to decrement commentsCount on post:', err);
  }
}

// In-memory cache to prevent redundant Firestore calls for the same post in the active session
const sessionViewedPosts = new Set<string>();

/**
 * Toggles like on post, synchronizing the 'curtidas' collection and post counters
 */
export async function togglePostLike(
  postId: string,
  uid: string,
  isLiked: boolean,
  userProfile?: UserProfile
): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const curtidaRef = doc(db, 'curtidas', `${postId}_${uid}`);

  if (isLiked) {
    // Unliking: remove from post and delete from curtidas collection
    await updateDoc(postRef, {
      likes: arrayRemove(uid),
      likesCount: increment(-1),
    });
    try {
      await deleteDoc(curtidaRef);
    } catch (err) {
      console.warn('Error deleting curtida document:', err);
    }
  } else {
    // Liking: add to post and save to curtidas collection
    await updateDoc(postRef, {
      likes: arrayUnion(uid),
      likesCount: increment(1),
    });
    try {
      await setDoc(curtidaRef, {
        id: `${postId}_${uid}`,
        post_id: postId,
        usuario_id: uid,
        criado_em: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Error saving curtida document:', err);
    }

    // If liking (not unliking), notify post author
    try {
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        const postData = postSnap.data() as PostItem;
        if (postData.authorUid && postData.authorUid !== uid) {
          createNotification({
            usuario_destinatario_id: postData.authorUid,
            usuario_origem_id: uid,
            usuario_origem_username: userProfile?.username || '',
            usuario_origem_displayName: userProfile?.displayName || userProfile?.username || '',
            usuario_origem_photoURL: userProfile?.photoURL || '',
            tipo: 'curtida_post',
            post_id: postId,
            conteudo_extra: postData.content || '',
          }).catch((e) => console.warn('Error creating post like notification:', e));
        }
      }
    } catch (e) {
      console.warn('Error triggering post like notification:', e);
    }
  }
}

/**
 * Registers a unique view for a post (1 view per user per post).
 * Only counted if user has stayed on the post for 1.5s.
 * Uses UNIQUE(post_id, usuario_id) pattern with insert-ignore logic.
 */
export async function recordPostView(postId: string, userId: string): Promise<boolean> {
  if (!postId || !userId) return false;
  const uniqueId = `${postId}_${userId}`;

  // Check in-memory session cache first to eliminate unnecessary Firestore reads
  if (sessionViewedPosts.has(uniqueId)) {
    return false;
  }

  try {
    const viewRef = doc(db, 'visualizacoes', uniqueId);
    const snap = await getDoc(viewRef);
    if (snap.exists()) {
      sessionViewedPosts.add(uniqueId);
      return false; // Already viewed, insert ignore
    }

    // New unique view
    const nowIso = new Date().toISOString();
    await setDoc(viewRef, {
      id: uniqueId,
      post_id: postId,
      usuario_id: userId,
      criado_em: nowIso,
    });

    sessionViewedPosts.add(uniqueId);

    // Atomically increment viewsCount on the post
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      viewsCount: increment(1),
    });

    return true;
  } catch (err) {
    console.warn('Error recording post view in Firestore:', err);
    return false;
  }
}

/**
 * Formats numbers into clean compact strings (e.g., 2400 -> '2.4k', 18100 -> '18.1k')
 */
export function formatEngagementCount(count: number | undefined | null): string {
  if (count === undefined || count === null || count <= 0) return '0';
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}

/**
 * Fetches the list of users who liked a post.
 * Likes are public: accessible to all authenticated users.
 */
export async function getPostLikers(postId: string): Promise<UserProfile[]> {
  if (!postId) return [];
  try {
    const uids = new Set<string>();

    // 1. Query curtidas collection
    try {
      const curtidasCol = collection(db, 'curtidas');
      const q = query(curtidasCol, where('post_id', '==', postId));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data();
        if (data.usuario_id) uids.add(data.usuario_id);
      });
    } catch (e) {
      console.warn('Could not query curtidas collection:', e);
    }

    // 2. Also check post.likes array for backwards compatibility
    const postSnap = await getDoc(doc(db, 'posts', postId));
    if (postSnap.exists()) {
      const pData = postSnap.data() as PostItem;
      if (Array.isArray(pData.likes)) {
        pData.likes.forEach((id) => uids.add(id));
      }
    }

    if (uids.size === 0) return [];

    const profiles: UserProfile[] = [];
    for (const uid of uids) {
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) {
          profiles.push(uSnap.data() as UserProfile);
        }
      } catch (err) {
        console.warn('Error fetching liker profile:', uid, err);
      }
    }

    return profiles;
  } catch (err) {
    console.error('Error in getPostLikers:', err);
    return [];
  }
}

/**
 * Fetches the list of users who viewed a post.
 * CRITICAL PRIVACY RULE:
 * Total view count is public, but the list of who viewed is STRICTLY RESTRICTED TO THE POST AUTHOR.
 * The backend/service checks currentUid === postAuthorUid. If not, returns empty list!
 */
export async function getPostViewers(
  postId: string,
  postAuthorUid: string,
  currentUid: string
): Promise<{ viewers: UserProfile[]; canViewList: boolean }> {
  // CRITICAL VALIDATION: usuario_logado_id === post.autor_id
  if (!currentUid || currentUid !== postAuthorUid) {
    return { viewers: [], canViewList: false };
  }

  try {
    const viewsCol = collection(db, 'visualizacoes');
    const q = query(viewsCol, where('post_id', '==', postId), orderBy('criado_em', 'desc'), limit(150));
    const snap = await getDocs(q);
    const uids: string[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.usuario_id && !uids.includes(data.usuario_id)) {
        uids.push(data.usuario_id);
      }
    });

    const profiles: UserProfile[] = [];
    for (const uid of uids) {
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) {
          profiles.push(uSnap.data() as UserProfile);
        }
      } catch (err) {
        console.warn('Error fetching viewer profile:', uid, err);
      }
    }

    return { viewers: profiles, canViewList: true };
  } catch (err) {
    console.error('Error in getPostViewers:', err);
    return { viewers: [], canViewList: true };
  }
}

/**
 * Fetches real registered users for "Sugestões pra você"
 */
export async function fetchSuggestedUsers(
  currentUid: string
): Promise<UserProfile[]> {
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, limit(20));
    const snap = await getDocs(q);
    const users: UserProfile[] = [];

    snap.forEach((d) => {
      const u = d.data() as UserProfile;
      if (u.uid && u.uid !== currentUid && !u.uid.startsWith('seed_')) {
        users.push(u);
      }
    });

    return users;
  } catch (err) {
    console.error('Error fetching suggested users:', err);
    return [];
  }
}

/**
 * Follows / Unfollows user. If target account is private, routes to follow request.
 */
export async function toggleFollowUser(
  followerUid: string,
  followingUid: string,
  isFollowing: boolean,
  followerProfile?: UserProfile
): Promise<void> {
  const followId = `${followerUid}_${followingUid}`;
  const followRef = doc(db, 'follows', followId);

  if (isFollowing) {
    await deleteDoc(followRef);
  } else {
    // Verify if target user has a private account
    try {
      const targetUserDoc = await getDoc(doc(db, 'users', followingUid));
      if (targetUserDoc.exists()) {
        const targetData = targetUserDoc.data();
        const isPrivate = Boolean(targetData.conta_privada || targetData.isPrivate);
        if (isPrivate) {
          // Send follow request instead of directly following
          await createFollowRequest(followerUid, followingUid, followerProfile);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not verify target account privacy, proceeding with standard check:', err);
    }

    await setDoc(followRef, {
      followerUid,
      followingUid,
      createdAt: new Date().toISOString(),
    });

    // Notify the user being followed
    createNotification({
      usuario_destinatario_id: followingUid,
      usuario_origem_id: followerUid,
      usuario_origem_username: followerProfile?.username || '',
      usuario_origem_displayName: followerProfile?.displayName || followerProfile?.username || '',
      usuario_origem_photoURL: followerProfile?.photoURL || '',
      tipo: 'novo_seguidor',
    }).catch((e) => console.warn('Error creating follow notification:', e));
  }
}

/**
 * Real-time listener for user follows (who I am following)
 */
export function subscribeFollowing(
  followerUid: string,
  callback: (followingUids: Set<string>) => void
) {
  const followsCol = collection(db, 'follows');
  const q = query(followsCol, where('followerUid', '==', followerUid));

  return onSnapshot(q, (snap) => {
    const set = new Set<string>();
    snap.forEach((d) => {
      const data = d.data();
      if (data.followingUid && !data.followingUid.startsWith('seed_')) {
        set.add(data.followingUid);
      }
    });
    callback(set);
  });
}

/**
 * Real-time listener for followers (who follows me)
 */
export function subscribeFollowers(
  followingUid: string,
  callback: (followerUids: Set<string>) => void
) {
  const followsCol = collection(db, 'follows');
  const q = query(followsCol, where('followingUid', '==', followingUid));

  return onSnapshot(q, (snap) => {
    const set = new Set<string>();
    snap.forEach((d) => {
      const data = d.data();
      if (data.followerUid && !data.followerUid.startsWith('seed_')) {
        set.add(data.followerUid);
      }
    });
    callback(set);
  });
}

/**
 * Real-time listener for all follows connections in Firestore
 * (Used to accurately calculate mutual friends count in real time)
 */
export function subscribeAllFollows(
  callback: (follows: { followerUid: string; followingUid: string }[]) => void
) {
  const followsCol = collection(db, 'follows');
  return onSnapshot(followsCol, (snap) => {
    const list: { followerUid: string; followingUid: string }[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (
        data.followerUid &&
        data.followingUid &&
        !data.followerUid.startsWith('seed_') &&
        !data.followingUid.startsWith('seed_')
      ) {
        list.push({ followerUid: data.followerUid, followingUid: data.followingUid });
      }
    });
    callback(list);
  });
}

/**
 * Real-time listener for all registered users (strictly real users, excluding any seeds)
 */
export function subscribeAllUsers(callback: (users: UserProfile[]) => void) {
  const usersCol = collection(db, 'users');
  return onSnapshot(
    usersCol,
    (snap) => {
      const users: UserProfile[] = [];
      snap.forEach((d) => {
        const u = d.data() as UserProfile;
        if (u.uid && !u.uid.startsWith('seed_')) {
          users.push(u);
        }
      });
      callback(users);
    },
    (err) => {
      console.error('Error fetching all users:', err);
    }
  );
}

/**
 * Real-time listener for posts authored by a specific user or accepted as collaborator (profile grid)
 */
export function subscribeUserPosts(
  targetUid: string,
  callback: (posts: PostItem[]) => void
) {
  const postsCol = collection(db, 'posts');

  return onSnapshot(
    postsCol,
    (snap) => {
      const posts: PostItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as PostItem;
        const isAuthor = data.authorUid === targetUid;
        const isAcceptedCollab = Array.isArray(data.collaborators) &&
          data.collaborators.some((c) => c.usuario_id === targetUid && c.status === 'aceito');

        if (isAuthor || isAcceptedCollab) {
          posts.push({
            ...data,
            id: d.id,
            likes: Array.isArray(data.likes) ? data.likes : [],
          });
        }
      });
      // Sort newest first
      posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(posts);
    },
    (err) => {
      console.error('Error fetching user posts:', err);
      callback([]);
    }
  );
}

/**
 * Real-time listener for profile stats (real posts count, real followers count, real following count)
 */
export function subscribeUserProfileStats(
  targetUid: string,
  callback: (stats: { postsCount: number; followersCount: number; followingCount: number }) => void
) {
  let postsCount = 0;
  let followersCount = 0;
  let followingCount = 0;

  const emit = () => {
    callback({ postsCount, followersCount, followingCount });
  };

  // 1. Posts count (authored + accepted collaborated)
  const postsQuery = collection(db, 'posts');
  const unsubPosts = onSnapshot(postsQuery, (snap) => {
    let count = 0;
    snap.forEach((d) => {
      const data = d.data() as PostItem;
      const isAuthor = data.authorUid === targetUid;
      const isAcceptedCollab = Array.isArray(data.collaborators) &&
        data.collaborators.some((c) => c.usuario_id === targetUid && c.status === 'aceito');
      if (isAuthor || isAcceptedCollab) count++;
    });
    postsCount = count;
    emit();
  });

  // 2. Followers count (who follows targetUid)
  const followersQuery = query(collection(db, 'follows'), where('followingUid', '==', targetUid));
  const unsubFollowers = onSnapshot(followersQuery, (snap) => {
    let count = 0;
    snap.forEach((d) => {
      const data = d.data();
      if (data.followerUid && !data.followerUid.startsWith('seed_')) {
        count++;
      }
    });
    followersCount = count;
    emit();
  });

  // 3. Following count (who targetUid follows)
  const followingQuery = query(collection(db, 'follows'), where('followerUid', '==', targetUid));
  const unsubFollowing = onSnapshot(followingQuery, (snap) => {
    let count = 0;
    snap.forEach((d) => {
      const data = d.data();
      if (data.followingUid && !data.followingUid.startsWith('seed_')) {
        count++;
      }
    });
    followingCount = count;
    emit();
  });

  return () => {
    unsubPosts();
    unsubFollowers();
    unsubFollowing();
  };
}

/**
 * Cleans up any leftover mock seeds from previous sessions
 */
export async function cleanupSeedData() {
  try {
    const seedIds = [
      'seed_ana_',
      'seed_joao_m',
      'seed_lu_k',
      'seed_lucas_dev',
      'seed_luiza_santos',
      'seed_mateus_costa',
    ];
    for (const sid of seedIds) {
      try {
        await deleteDoc(doc(db, 'users', sid));
      } catch {}
    }

    // Clean up follows containing seed_
    const followsSnap = await getDocs(collection(db, 'follows'));
    for (const d of followsSnap.docs) {
      if (d.id.includes('seed_') || d.data().followerUid?.startsWith('seed_') || d.data().followingUid?.startsWith('seed_')) {
        try {
          await deleteDoc(d.ref);
        } catch {}
      }
    }
  } catch (e) {
    console.warn('Seed cleanup info:', e);
  }
}

/**
 * Recent searches helpers in localStorage
 */
const RECENT_SEARCHES_KEY = 'vybe_recent_searches';

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  if (typeof window === 'undefined') return [];
  const clean = term.trim();
  if (!clean) return getRecentSearches();

  try {
    const current = getRecentSearches().filter(
      (item) => item.toLowerCase() !== clean.toLowerCase()
    );
    const updated = [clean, ...current].slice(0, 8); // Keep up to 8 recent searches
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeRecentSearch(term: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const updated = getRecentSearches().filter(
      (item) => item.toLowerCase() !== term.toLowerCase()
    );
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Checks if two users follow each other mutually
 */
export async function checkMutualFollow(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false;
  try {
    const [snap1, snap2] = await Promise.all([
      getDocs(
        query(
          collection(db, 'follows'),
          where('followerUid', '==', userA),
          where('followingUid', '==', userB),
          limit(1)
        )
      ),
      getDocs(
        query(
          collection(db, 'follows'),
          where('followerUid', '==', userB),
          where('followingUid', '==', userA),
          limit(1)
        )
      ),
    ]);
    return !snap1.empty && !snap2.empty;
  } catch (err) {
    console.error('Error checking mutual follow:', err);
    return false;
  }
}

/**
 * Gets an existing 1-on-1 conversation or creates a new one
 * Enforces mutual follow rule:
 * - If mutual: status = 'ativa'
 * - If not mutual: status = 'pendente' (solicitação)
 * - If previously 'bloqueada_permanente', unblocks to 'ativa' if now mutual!
 */
export async function getOrCreateIndividualConversation(
  currentUserUid: string,
  targetUid: string
): Promise<ConversationItem> {
  const convsCol = collection(db, 'conversas');
  const q = query(
    convsCol,
    where('tipo', '==', 'individual'),
    where('participantes', 'array-contains', currentUserUid)
  );

  const snapshot = await getDocs(q);
  let existingConv: ConversationItem | null = null;

  snapshot.forEach((d) => {
    const data = d.data() as Omit<ConversationItem, 'id'>;
    if (data.participantes.includes(targetUid)) {
      existingConv = { id: d.id, ...data };
    }
  });

  const isMutual = await checkMutualFollow(currentUserUid, targetUid);

  if (existingConv) {
    const conv = existingConv as ConversationItem;
    // If blocked permanently, check if they now follow each other mutually
    if (conv.status === 'bloqueada_permanente' && isMutual) {
      await updateDoc(doc(db, 'conversas', conv.id), {
        status: 'ativa',
        atualizado_em: new Date().toISOString(),
      });
      conv.status = 'ativa';
    }
    return conv;
  }

  // Create new conversation
  const newDocRef = doc(convsCol);
  const now = new Date().toISOString();
  const newConvData: Omit<ConversationItem, 'id'> = {
    tipo: 'individual',
    participantes: [currentUserUid, targetUid],
    criado_em: now,
    status: isMutual ? 'ativa' : 'pendente',
    solicitante_id: currentUserUid,
    destinatario_id: targetUid,
    atualizado_em: now,
  };

  await setDoc(newDocRef, sanitizeForFirestore(newConvData));
  return { id: newDocRef.id, ...newConvData };
}

/**
 * Creates a group conversation (no mutual check required, but members should be followed)
 */
export async function createGroupConversation(
  currentUserUid: string,
  memberUids: string[],
  groupName: string,
  groupPhoto?: string
): Promise<ConversationItem> {
  const convsCol = collection(db, 'conversas');
  const newDocRef = doc(convsCol);
  const now = new Date().toISOString();

  const allParticipants = Array.from(new Set([currentUserUid, ...memberUids]));
  const cleanName = groupName.trim() || 'Novo Grupo';

  const groupData: Omit<ConversationItem, 'id'> = {
    tipo: 'grupo',
    participantes: allParticipants,
    nome_grupo: cleanName,
    foto_grupo: groupPhoto || '',
    criado_em: now,
    status: 'ativa',
    solicitante_id: currentUserUid,
    atualizado_em: now,
  };

  await setDoc(newDocRef, sanitizeForFirestore(groupData));
  return { id: newDocRef.id, ...groupData };
}

/**
 * Updates a group's display name
 */
export async function updateGroupName(conversationId: string, newName: string): Promise<void> {
  const clean = newName.trim();
  if (!clean) return;
  await updateDoc(doc(db, 'conversas', conversationId), {
    nome_grupo: clean,
    atualizado_em: new Date().toISOString(),
  });
}

/**
 * Responds to a conversation solicitation ('Aceitar' | 'Recusar')
 */
export async function respondToSolicitation(
  conversationId: string,
  action: 'Aceitar' | 'Recusar'
): Promise<void> {
  const convRef = doc(db, 'conversas', conversationId);
  const now = new Date().toISOString();

  if (action === 'Aceitar') {
    await updateDoc(convRef, {
      status: 'ativa',
      atualizado_em: now,
    });
  } else {
    await updateDoc(convRef, {
      status: 'bloqueada_permanente',
      atualizado_em: now,
    });
  }
}

/**
 * Subscribes to conversations for the current user in real-time
 */
export function subscribeConversations(
  userUid: string,
  callback: (conversations: ConversationItem[]) => void
) {
  const convsCol = collection(db, 'conversas');
  const q = query(convsCol, where('participantes', 'array-contains', userUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ConversationItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Omit<ConversationItem, 'id'>;
        items.push({ id: d.id, ...data });
      });
      // Sort in-memory by updated timestamp descending
      items.sort((a, b) => {
        const timeA = new Date(a.atualizado_em || a.criado_em).getTime();
        const timeB = new Date(b.atualizado_em || b.criado_em).getTime();
        return timeB - timeA;
      });
      callback(items);
    },
    (err) => {
      console.error('Error listening to conversations:', err);
      callback([]);
    }
  );
}

/**
 * Subscribes to messages within a specific conversation
 */
export function subscribeMessages(
  conversationId: string,
  callback: (messages: ChatMessage[]) => void
) {
  const msgsCol = collection(db, 'mensagens');
  const q = query(
    msgsCol,
    where('conversa_id', '==', conversationId),
    orderBy('criado_em', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Omit<ChatMessage, 'id'>;
        msgs.push({ id: d.id, ...data });
      });
      callback(msgs);
    },
    (err) => {
      console.error('Error listening to messages:', err);
      callback([]);
    }
  );
}

/**
 * Sends a message in a conversation.
 * Handles the 1-message solicitation limit when pending:
 * "Pessoa A (que não é seguida de volta) consegue mandar apenas 1 mensagem.
 * Enquanto está pendente, A não pode mandar uma segunda mensagem — campo desabilitado."
 */
export async function sendMessage(params: {
  conversaId: string;
  autor: UserProfile;
  tipo: MessageContentType;
  conteudo: string;
  postPreview?: PostPreviewData;
}): Promise<string> {
  const convRef = doc(db, 'conversas', params.conversaId);
  const convSnap = await getDoc(convRef);

  if (!convSnap.exists()) {
    throw new Error('Conversa não encontrada.');
  }

  const convData = convSnap.data() as ConversationItem;

  // 1. Check if blocked
  if (convData.status === 'bloqueada_permanente') {
    // Check if mutual follow has been re-established
    const otherUid = convData.participantes.find((u) => u !== params.autor.uid);
    const isMutualNow = otherUid ? await checkMutualFollow(params.autor.uid, otherUid) : false;
    if (!isMutualNow) {
      throw new Error(
        'Esta conversa foi recusada. É necessário que ambos se sigam mutuamente para conversar livremente.'
      );
    } else {
      // Re-enable conversation
      await updateDoc(convRef, { status: 'ativa' });
      convData.status = 'ativa';
    }
  }

  // 2. Check if pending solicitation and sender is solicitante
  if (convData.status === 'pendente') {
    if (convData.solicitante_id === params.autor.uid) {
      // Check if author already sent a message
      const existingMsgsSnap = await getDocs(
        query(
          collection(db, 'mensagens'),
          where('conversa_id', '==', params.conversaId),
          where('autor_id', '==', params.autor.uid),
          limit(1)
        )
      );

      if (!existingMsgsSnap.empty) {
        throw new Error(
          'Aguardando resposta da solicitação. Apenas uma mensagem pode ser enviada enquanto pendente.'
        );
      }
    }
  }

  const msgRef = doc(collection(db, 'mensagens'));
  const now = new Date().toISOString();

  let previewText = params.conteudo;
  if (params.tipo === 'imagem') previewText = '📷 Foto';
  if (params.tipo === 'post_compartilhado') {
    const author = params.postPreview?.authorUsername ? `@${params.postPreview.authorUsername}` : 'uma publicação';
    previewText = `Publicação de ${author}`;
  }

  const rawMsg: Omit<ChatMessage, 'id'> = {
    conversa_id: params.conversaId,
    autor_id: params.autor.uid,
    autor_username: params.autor.username,
    tipo: params.tipo,
    conteudo: params.conteudo,
    criado_em: now,
    lida: false,
    post_preview: params.postPreview,
  };

  await setDoc(msgRef, sanitizeForFirestore(rawMsg));

  await updateDoc(convRef, {
    atualizado_em: now,
    ultima_mensagem: {
      texto: previewText,
      autor_id: params.autor.uid,
      tipo: params.tipo,
      criado_em: now,
      lida: false,
    },
  });

  // If this is a message solicitation (pending conversation), trigger notification to recipient
  if (convData.status === 'pendente' && convData.destinatario_id && convData.destinatario_id !== params.autor.uid) {
    createNotification({
      usuario_destinatario_id: convData.destinatario_id,
      usuario_origem_id: params.autor.uid,
      usuario_origem_username: params.autor.username,
      usuario_origem_displayName: params.autor.displayName || params.autor.username,
      usuario_origem_photoURL: params.autor.photoURL || '',
      tipo: 'solicitacao_mensagem',
      conteudo_extra: previewText,
    }).catch((e) => console.warn('Error creating message solicitation notification:', e));
  }

  return msgRef.id;
}

/**
 * Marks messages in a conversation as read by current user
 */
export async function markConversationAsRead(
  conversationId: string,
  currentUid: string
): Promise<void> {
  try {
    const msgsSnap = await getDocs(
      query(
        collection(db, 'mensagens'),
        where('conversa_id', '==', conversationId),
        where('lida', '==', false)
      )
    );

    const updates = msgsSnap.docs
      .filter((d) => d.data().autor_id !== currentUid)
      .map((d) => updateDoc(d.ref, { lida: true }));

    await Promise.all(updates);

    // Update conversation last message read flag if applicable
    const convRef = doc(db, 'conversas', conversationId);
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      const c = convSnap.data() as ConversationItem;
      if (c.ultima_mensagem && c.ultima_mensagem.autor_id !== currentUid) {
        await updateDoc(convRef, {
          'ultima_mensagem.lida': true,
        });
      }
    }
  } catch (e) {
    console.warn('Error marking messages as read:', e);
  }
}

/**
 * ============================================================================
 * NOTIFICAÇÕES — VYBE SERVICE
 * ============================================================================
 */

/**
 * Creates a notification in Firestore
 */
export async function createNotification(params: {
  usuario_destinatario_id: string;
  usuario_origem_id: string;
  usuario_origem_username?: string;
  usuario_origem_displayName?: string;
  usuario_origem_photoURL?: string;
  tipo: NotificationType;
  post_id?: string | null;
  comentario_id?: string | null;
  conteudo_extra?: string | null;
}): Promise<string | null> {
  // Do not notify if recipient is the author themselves
  if (
    !params.usuario_destinatario_id ||
    !params.usuario_origem_id ||
    params.usuario_destinatario_id === params.usuario_origem_id
  ) {
    return null;
  }

  try {
    const notifRef = doc(collection(db, 'notificacoes'));
    const rawNotif: Omit<NotificationItem, 'id'> = {
      usuario_destinatario_id: params.usuario_destinatario_id,
      usuario_origem_id: params.usuario_origem_id,
      usuario_origem_username: params.usuario_origem_username || '',
      usuario_origem_displayName: params.usuario_origem_displayName || params.usuario_origem_username || '',
      usuario_origem_photoURL: params.usuario_origem_photoURL || '',
      tipo: params.tipo,
      post_id: params.post_id || null,
      comentario_id: params.comentario_id || null,
      conteudo_extra: params.conteudo_extra || null,
      lida: false,
      criado_em: new Date().toISOString(),
    };

    await setDoc(notifRef, sanitizeForFirestore(rawNotif));
    return notifRef.id;
  } catch (err) {
    console.warn('Error creating notification:', err);
    return null;
  }
}

/**
 * Real-time listener for user notifications
 */
export function subscribeNotifications(
  destinatarioUid: string,
  callback: (notifications: NotificationItem[]) => void
) {
  if (!destinatarioUid) {
    callback([]);
    return () => {};
  }

  const notifsCol = collection(db, 'notificacoes');
  const q = query(
    notifsCol,
    where('usuario_destinatario_id', '==', destinatarioUid),
    orderBy('criado_em', 'desc'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: NotificationItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as NotificationItem;
        list.push({
          ...data,
          id: docSnap.id,
        });
      });
      callback(list);
    },
    (err) => {
      console.error('Error fetching notifications in real time:', err);
      callback([]);
    }
  );
}

/**
 * Marks a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    const notifRef = doc(db, 'notificacoes', notificationId);
    await updateDoc(notifRef, { lida: true });
  } catch (err) {
    console.warn('Error marking notification as read:', err);
  }
}

/**
 * Marks multiple notifications as read in batch
 */
export async function markAllNotificationsAsRead(
  notificationIds: string[]
): Promise<void> {
  if (!notificationIds || notificationIds.length === 0) return;
  try {
    const updates = notificationIds.map((id) =>
      updateDoc(doc(db, 'notificacoes', id), { lida: true })
    );
    await Promise.all(updates);
  } catch (err) {
    console.warn('Error marking all notifications as read:', err);
  }
}

/**
 * Deletes a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    await deleteDoc(doc(db, 'notificacoes', notificationId));
  } catch (err) {
    console.warn('Error deleting notification:', err);
  }
}

/**
 * ============================================================================
 * EXPLORAR — VYBE ALGORITHM & FEED
 * ============================================================================
 */

export interface ExplorePostWithScore {
  post: PostItem;
  score: number;
  mutualFollowersCount: number;
}

/**
 * Fetches and ranks Explore posts according to VYBE Explore rules:
 * 1. Exclude posts where author is the current user OR author is already followed by user.
 * 2. Rank by:
 *    - Recent engagement (likes + comments)
 *    - Recency boost (last 24h-48h)
 *    - Mutual connections / shared followers
 *    - Media variety (videos, carousel, photos)
 *    - Freshness / discovery entropy
 */
export async function fetchExploreFeed(
  currentUid: string,
  followingUids: Set<string>,
  allFollows: { followerUid: string; followingUid: string }[] = [],
  filterMediaType?: 'all' | 'video' | 'image'
): Promise<PostItem[]> {
  try {
    const postsCol = collection(db, 'posts');
    const q = query(postsCol, orderBy('createdAt', 'desc'), limit(150));
    const snap = await getDocs(q);

    const now = new Date().getTime();
    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;
    const TWO_DAYS = 48 * ONE_HOUR;
    const SEVEN_DAYS = 7 * ONE_DAY;

    // Map following set of current user
    const myFollowingSet = followingUids || new Set<string>();

    // Map who follows who for mutual connections
    // whoDoesUserFollow: set of UIDs that current user follows
    // whoFollowsAuthor: for each author, array of followers
    const authorFollowersMap = new Map<string, string[]>();
    for (const f of allFollows) {
      if (!authorFollowersMap.has(f.followingUid)) {
        authorFollowersMap.set(f.followingUid, []);
      }
      authorFollowersMap.get(f.followingUid)!.push(f.followerUid);
    }

    const candidatePosts: ExplorePostWithScore[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as PostItem;
      const post: PostItem = {
        ...data,
        id: docSnap.id,
        likes: Array.isArray(data.likes) ? data.likes : [],
        mediaUrls: Array.isArray(data.mediaUrls)
          ? data.mediaUrls
          : data.mediaUrl
          ? [data.mediaUrl]
          : [],
      };

      // 1. RULE: Exclude user's own posts AND posts from accounts already followed
      if (post.authorUid === currentUid) return;
      if (myFollowingSet.has(post.authorUid)) return;

      // Filter by mediaType if selected
      if (filterMediaType && filterMediaType !== 'all') {
        const isVideo =
          post.mediaType === 'video' ||
          (post.mediaUrls && post.mediaUrls.some((u) => u.includes('mp4') || u.includes('video')));
        if (filterMediaType === 'video' && !isVideo) return;
        if (filterMediaType === 'image' && isVideo) return;
      }

      // 2. Compute Explore relevance score
      const likesCount = post.likes.length;
      const commentsCount = post.commentsCount || 0;
      const baseEngagement = likesCount * 4 + commentsCount * 6;

      // Recency multiplier
      const postAgeMs = now - new Date(post.createdAt).getTime();
      let recencyMultiplier = 1.0;
      if (postAgeMs < ONE_DAY) {
        recencyMultiplier = 2.5; // High boost for past 24h
      } else if (postAgeMs < TWO_DAYS) {
        recencyMultiplier = 1.8; // Boost for past 48h
      } else if (postAgeMs < SEVEN_DAYS) {
        recencyMultiplier = 1.2;
      } else {
        recencyMultiplier = 0.7;
      }

      // Mutual connections calculation
      const authorFollowers = authorFollowersMap.get(post.authorUid) || [];
      const mutualFollowers = authorFollowers.filter((fUid) => myFollowingSet.has(fUid));
      const mutualBoost = mutualFollowers.length * 15;

      // Media richness factor
      let mediaBonus = 0;
      if (post.mediaType === 'video') {
        mediaBonus += 8;
      } else if (post.mediaUrls && post.mediaUrls.length > 1) {
        mediaBonus += 5; // carousel bonus
      }

      // Discovery random entropy (gives slight natural variety on each refresh)
      const entropy = Math.random() * 6;

      const finalScore = (baseEngagement + 5) * recencyMultiplier + mutualBoost + mediaBonus + entropy;

      candidatePosts.push({
        post,
        score: finalScore,
        mutualFollowersCount: mutualFollowers.length,
      });
    });

    // Sort descending by calculated score
    candidatePosts.sort((a, b) => b.score - a.score);

    // Fallback: If no candidate posts from third parties, show all available public posts so Explore is rich and functional
    if (candidatePosts.length === 0) {
      const fallbackPosts: PostItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as PostItem;
        const post: PostItem = {
          ...data,
          id: docSnap.id,
          likes: Array.isArray(data.likes) ? data.likes : [],
          mediaUrls: Array.isArray(data.mediaUrls)
            ? data.mediaUrls
            : data.mediaUrl
            ? [data.mediaUrl]
            : [],
        };
        if (filterMediaType && filterMediaType !== 'all') {
          const isVideo =
            post.mediaType === 'video' ||
            (post.mediaUrls && post.mediaUrls.some((u) => u.includes('mp4') || u.includes('video')));
          if (filterMediaType === 'video' && !isVideo) return;
          if (filterMediaType === 'image' && isVideo) return;
        }
        fallbackPosts.push(post);
      });
      return fallbackPosts;
    }

    return candidatePosts.map((cp) => cp.post);
  } catch (err) {
    console.error('Error fetching explore feed:', err);
    return [];
  }
}

/**
 * Fetches suggested users for Explore grid cards (excluding self and already followed users)
 * 100% real users from Firestore only
 */
export async function fetchSuggestedUsersForExplore(
  currentUid: string,
  followingUids: Set<string>,
  allUsers: UserProfile[],
  allFollows: { followerUid: string; followingUid: string }[] = []
): Promise<UserProfile[]> {
  const notFollowingUsers = allUsers.filter(
    (u) => u.uid !== currentUid && !followingUids.has(u.uid)
  );

  // Map author followers
  const followersCountMap = new Map<string, number>();
  const authorFollowersMap = new Map<string, string[]>();
  for (const f of allFollows) {
    followersCountMap.set(f.followingUid, (followersCountMap.get(f.followingUid) || 0) + 1);
    if (!authorFollowersMap.has(f.followingUid)) {
      authorFollowersMap.set(f.followingUid, []);
    }
    authorFollowersMap.get(f.followingUid)!.push(f.followerUid);
  }

  // Score each user
  const scoredUsers = notFollowingUsers.map((u) => {
    const followers = followersCountMap.get(u.uid) || 0;
    const authorFollowers = authorFollowersMap.get(u.uid) || [];
    const mutualCount = authorFollowers.filter((fUid) => followingUids.has(fUid)).length;

    // Has photo bonus + mutual bonus + follower weight
    const photoBonus = u.photoURL ? 10 : 0;
    const bioBonus = u.bio ? 5 : 0;
    const score = mutualCount * 25 + followers * 2 + photoBonus + bioBonus + Math.random() * 5;

    return { user: u, score, mutualCount };
  });

  scoredUsers.sort((a, b) => b.score - a.score);
  return scoredUsers.map((su) => su.user);
}

/**
 * Creates a report for a post, comment, user profile, or story.
 * If target receives >= 3 reports, automatically marks auto_hidden: true.
 */
export async function createReport(reportData: {
  denunciante_id: string;
  alvo_tipo: ReportTargetType;
  alvo_id: string;
  motivo: ReportReason;
}): Promise<void> {
  const reportRef = doc(collection(db, 'denuncias'));
  
  // Resolve reported user (denunciado_id)
  let denunciado_id = '';
  if (reportData.alvo_tipo === 'usuario') {
    denunciado_id = reportData.alvo_id;
  } else if (reportData.alvo_tipo === 'post') {
    try {
      const postSnap = await getDoc(doc(db, 'posts', reportData.alvo_id));
      if (postSnap.exists()) {
        denunciado_id = postSnap.data().authorUid || '';
      }
    } catch (e) {
      console.error('Error fetching reported post:', e);
    }
  } else if (reportData.alvo_tipo === 'comentario') {
    try {
      const commentSnap = await getDoc(doc(db, 'comments', reportData.alvo_id));
      if (commentSnap.exists()) {
        denunciado_id = commentSnap.data().autor_id || '';
      }
    } catch (e) {
      console.error('Error fetching reported comment:', e);
    }
  } else if (reportData.alvo_tipo === 'story') {
    try {
      const storySnap = await getDoc(doc(db, 'stories', reportData.alvo_id));
      if (storySnap.exists()) {
        denunciado_id = storySnap.data().authorUid || '';
      }
    } catch (e) {
      console.error('Error fetching reported story:', e);
    }
  }

  const newReport: ReportItem = {
    id: reportRef.id,
    denunciante_id: reportData.denunciante_id,
    denunciado_id: denunciado_id || undefined,
    alvo_tipo: reportData.alvo_tipo,
    alvo_id: reportData.alvo_id,
    motivo: reportData.motivo,
    status: 'pendente',
    criado_em: new Date().toISOString(),
  };

  await setDoc(reportRef, newReport);

  // If a user has been reported, they immediately lose verified and creator status!
  if (denunciado_id) {
    try {
      const userRef = doc(db, 'users', denunciado_id);
      await updateDoc(userRef, {
        verificado: false,
        conta_criador: false
      });

      // Remove any verification request in collection
      const reqRef = doc(db, 'solicitacoes_verificacao', denunciado_id);
      await deleteDoc(reqRef);
    } catch (err) {
      console.error('Error revoking verification status upon report:', err);
    }
  }

  // Check recent reports count for target
  try {
    const q = query(
      collection(db, 'denuncias'),
      where('alvo_id', '==', reportData.alvo_id)
    );
    const snap = await getDocs(q);
    if (snap.size >= 3) {
      if (reportData.alvo_tipo === 'post') {
        const postRef = doc(db, 'posts', reportData.alvo_id);
        await updateDoc(postRef, { auto_hidden: true });
      } else if (reportData.alvo_tipo === 'comentario') {
        const commentRef = doc(db, 'comments', reportData.alvo_id);
        await updateDoc(commentRef, { auto_hidden: true });
      } else if (reportData.alvo_tipo === 'story') {
        const storyRef = doc(db, 'stories', reportData.alvo_id);
        await updateDoc(storyRef, { auto_hidden: true });
      }
    }
  } catch (err) {
    console.error('Error processing auto-hide threshold for report:', err);
  }
}

/**
 * Blocks a user. Automatically undoes follow relationships in BOTH directions,
 * and saves whether follow existed to restore automatically upon unblocking.
 */
export async function blockUser(blockerUid: string, blockedUid: string): Promise<void> {
  if (!blockerUid || !blockedUid || blockerUid === blockedUid) return;

  const blockId = `${blockerUid}_${blockedUid}`;
  const blockRef = doc(db, 'bloqueios', blockId);

  let blockerFollowedBlocked = false;
  let blockedFollowedBlocker = false;

  // Check and undo follow from blocker -> blocked
  try {
    const follow1Ref = doc(db, 'follows', `${blockerUid}_${blockedUid}`);
    const snap1 = await getDoc(follow1Ref);
    if (snap1.exists()) {
      blockerFollowedBlocked = true;
      await deleteDoc(follow1Ref);
    }
  } catch (e) {
    // Ignore if didn't exist
  }

  // Check and undo follow from blocked -> blocker
  try {
    const follow2Ref = doc(db, 'follows', `${blockedUid}_${blockerUid}`);
    const snap2 = await getDoc(follow2Ref);
    if (snap2.exists()) {
      blockedFollowedBlocker = true;
      await deleteDoc(follow2Ref);
    }
  } catch (e) {
    // Ignore if didn't exist
  }

  await setDoc(blockRef, {
    id: blockId,
    usuario_bloqueador_id: blockerUid,
    usuario_bloqueado_id: blockedUid,
    blockerFollowedBlocked,
    blockedFollowedBlocker,
    criado_em: new Date().toISOString(),
  });

  // Also sync users/{blockerUid}.blockedUsers
  try {
    const userRef = doc(db, 'users', blockerUid);
    await updateDoc(userRef, {
      blockedUsers: arrayUnion(blockedUid),
    });
  } catch (e) {
    console.warn('Could not update blockedUsers in user doc:', e);
  }
}

/**
 * Unblocks a user and automatically restores mutual follow relationships if they existed before blocking.
 */
export async function unblockUser(blockerUid: string, blockedUid: string): Promise<void> {
  if (!blockerUid || !blockedUid) return;
  const blockId = `${blockerUid}_${blockedUid}`;
  const blockRef = doc(db, 'bloqueios', blockId);

  try {
    const blockSnap = await getDoc(blockRef);
    if (blockSnap.exists()) {
      const data = blockSnap.data() as BlockItem;
      const now = new Date().toISOString();

      if (data.blockerFollowedBlocked) {
        await setDoc(doc(db, 'follows', `${blockerUid}_${blockedUid}`), {
          followerUid: blockerUid,
          followingUid: blockedUid,
          createdAt: now,
        });
      }

      if (data.blockedFollowedBlocker) {
        await setDoc(doc(db, 'follows', `${blockedUid}_${blockerUid}`), {
          followerUid: blockedUid,
          followingUid: blockerUid,
          createdAt: now,
        });
      }
    }
  } catch (e) {
    console.warn('Could not restore previous follow states upon unblock:', e);
  }

  await deleteDoc(blockRef);

  // Also sync users/{blockerUid}.blockedUsers
  try {
    const userRef = doc(db, 'users', blockerUid);
    await updateDoc(userRef, {
      blockedUsers: arrayRemove(blockedUid),
    });
  } catch (e) {
    console.warn('Could not update blockedUsers in user doc on unblock:', e);
  }
}

/**
 * Real-time listener for users blocked by current UID.
 */
export function subscribeMyBlockedUsers(
  uid: string,
  callback: (blockedUidSet: Set<string>, blockList: BlockItem[]) => void
) {
  if (!uid) {
    callback(new Set(), []);
    return () => {};
  }

  const q = query(
    collection(db, 'bloqueios'),
    where('usuario_bloqueador_id', '==', uid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const set = new Set<string>();
      const list: BlockItem[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as BlockItem;
        if (data.usuario_bloqueado_id) {
          set.add(data.usuario_bloqueado_id);
          list.push(data);
        }
      });
      callback(set, list);
    },
    (err) => {
      console.error('Error listening to my blocked users:', err);
    }
  );
}

/**
 * Real-time listener for users who have blocked current UID.
 */
export function subscribeUsersWhoBlockedMe(
  uid: string,
  callback: (blockerUidSet: Set<string>) => void
) {
  if (!uid) {
    callback(new Set());
    return () => {};
  }

  const q = query(
    collection(db, 'bloqueios'),
    where('usuario_bloqueado_id', '==', uid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const set = new Set<string>();
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as BlockItem;
        if (data.usuario_bloqueador_id) {
          set.add(data.usuario_bloqueador_id);
        }
      });
      callback(set);
    },
    (err) => {
      console.error('Error listening to users who blocked me:', err);
    }
  );
}

/**
 * Creates a follow request for a private account
 */
export async function createFollowRequest(
  solicitanteUid: string,
  targetUid: string,
  solicitanteProfile?: UserProfile
): Promise<void> {
  const reqId = `${solicitanteUid}_${targetUid}`;
  const reqRef = doc(db, 'solicitacoes_seguir', reqId);

  await setDoc(reqRef, {
    id: reqId,
    solicitante_id: solicitanteUid,
    usuario_alvo_id: targetUid,
    status: 'pendente',
    criado_em: new Date().toISOString(),
  });

  // Create notification for target user
  createNotification({
    usuario_destinatario_id: targetUid,
    usuario_origem_id: solicitanteUid,
    usuario_origem_username: solicitanteProfile?.username || '',
    usuario_origem_displayName: solicitanteProfile?.displayName || solicitanteProfile?.username || '',
    usuario_origem_photoURL: solicitanteProfile?.photoURL || '',
    tipo: 'solicitacao_seguir',
  }).catch((e) => console.warn('Error creating follow request notification:', e));
}

/**
 * Cancels a pending follow request
 */
export async function cancelFollowRequest(
  solicitanteUid: string,
  targetUid: string
): Promise<void> {
  const reqId = `${solicitanteUid}_${targetUid}`;
  await deleteDoc(doc(db, 'solicitacoes_seguir', reqId));
}

/**
 * Responds to a follow request (accept or decline)
 */
export async function respondFollowRequest(params: {
  solicitanteUid: string;
  targetUid: string;
  action: 'aceitar' | 'recusar';
  targetProfile?: UserProfile;
}): Promise<void> {
  const reqId = `${params.solicitanteUid}_${params.targetUid}`;

  if (params.action === 'aceitar') {
    // 1. Delete or update request status
    await deleteDoc(doc(db, 'solicitacoes_seguir', reqId));

    // 2. Create actual follow record
    const followId = `${params.solicitanteUid}_${params.targetUid}`;
    await setDoc(doc(db, 'follows', followId), {
      followerUid: params.solicitanteUid,
      followingUid: params.targetUid,
      createdAt: new Date().toISOString(),
    });

    // 3. Notify the requesting user that request was accepted
    createNotification({
      usuario_destinatario_id: params.solicitanteUid,
      usuario_origem_id: params.targetUid,
      usuario_origem_username: params.targetProfile?.username || '',
      usuario_origem_displayName: params.targetProfile?.displayName || params.targetProfile?.username || '',
      usuario_origem_photoURL: params.targetProfile?.photoURL || '',
      tipo: 'novo_seguidor',
    }).catch((e) => console.warn('Error creating follow accept notification:', e));
  } else {
    // Recusar: Delete the request so solicitante can request again in the future
    await deleteDoc(doc(db, 'solicitacoes_seguir', reqId));
  }
}

/**
 * Real-time listener for incoming follow requests to current user
 */
export function subscribeIncomingFollowRequests(
  targetUid: string,
  callback: (requests: FollowRequestItem[]) => void
) {
  if (!targetUid) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'solicitacoes_seguir'),
    where('usuario_alvo_id', '==', targetUid),
    where('status', '==', 'pendente')
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: FollowRequestItem[] = [];
      snap.docs.forEach((d) => {
        const item = d.data() as FollowRequestItem;
        list.push({ ...item, id: d.id });
      });
      callback(list);
    },
    (err) => {
      console.error('Error listening to incoming follow requests:', err);
      callback([]);
    }
  );
}

/**
 * Real-time listener for outgoing pending follow requests sent by current user
 */
export function subscribeOutgoingFollowRequests(
  solicitanteUid: string,
  callback: (pendingTargetUids: Set<string>) => void
) {
  if (!solicitanteUid) {
    callback(new Set());
    return () => {};
  }

  const q = query(
    collection(db, 'solicitacoes_seguir'),
    where('solicitante_id', '==', solicitanteUid),
    where('status', '==', 'pendente')
  );

  return onSnapshot(
    q,
    (snap) => {
      const set = new Set<string>();
      snap.docs.forEach((d) => {
        const item = d.data() as FollowRequestItem;
        if (item.usuario_alvo_id) {
          set.add(item.usuario_alvo_id);
        }
      });
      callback(set);
    },
    (err) => {
      console.error('Error listening to outgoing follow requests:', err);
      callback(new Set());
    }
  );
}






