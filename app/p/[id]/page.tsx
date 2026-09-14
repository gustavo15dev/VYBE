'use client';

import React, { useEffect } from 'react';

interface PageProps {
  params: {
    id: string;
  };
}

export default function PublicPostPageRoute({ params }: PageProps) {
  const postId = params?.id;

  useEffect(() => {
    if (typeof window !== 'undefined' && postId) {
      if (window.location.pathname !== `/p/${postId}`) {
        window.location.href = `/p/${postId}`;
      }
    }
  }, [postId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FAFA] text-gray-700">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-[#548687] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium">Carregando publicação...</p>
      </div>
    </div>
  );
}
