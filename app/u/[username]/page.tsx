import React from 'react';

export default function ProfilePage({ params }: { params: { username: string } }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1>Perfil de {params.username}</h1>
      <p>Redirecionando para o aplicativo...</p>
      <script dangerouslySetInnerHTML={{ __html: `window.location.href = "/?profile=" + "${params.username}";` }} />
    </div>
  );
}
