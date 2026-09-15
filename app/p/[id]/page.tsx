import React from 'react';

export default function PostPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1>Post {params.id}</h1>
      <p>Redirecionando para o aplicativo...</p>
      <script dangerouslySetInnerHTML={{ __html: `window.location.href = "/?post=" + "${params.id}";` }} />
    </div>
  );
}
