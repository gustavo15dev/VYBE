import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  registerWithEmail,
  loginWithEmailOrUsername,
  loginWithGoogle,
  completeGoogleProfile,
  isUsernameAvailable,
} from '../services/authService';
import {
  AtSign,
  Lock,
  Mail,
  User as UserIcon,
  Calendar,
  Globe,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

const COUNTRIES = [
  'Brasil',
  'Portugal',
  'Angola',
  'Moçambique',
  'Cabo Verde',
  'Estados Unidos',
  'Espanha',
  'Argentina',
  'Chile',
  'México',
  'Canadá',
  'Reino Unido',
  'França',
  'Alemanha',
  'Itália',
  'Japão',
  'Outro',
];

interface AuthModalProps {
  onSuccess?: () => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export function AuthModal({ showToast }: AuthModalProps) {
  const { needsProfileCompletion, pendingGoogleUser, refreshProfile } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regCountry, setRegCountry] = useState('Brasil');

  // Complete profile state (for Google Auth first-time users)
  const [compUsername, setCompUsername] = useState('');
  const [compBirthDate, setCompBirthDate] = useState('');
  const [compCountry, setCompCountry] = useState('Brasil');

  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Handle checking username availability for registration
  const checkUsername = async (u: string) => {
    const clean = u.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setRegUsername(clean);
    if (clean.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const avail = await isUsernameAvailable(clean);
      setUsernameStatus(avail ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  };

  // Check username availability when finishing google profile
  const handleGoogleUsernameChange = async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setCompUsername(clean);
    if (clean.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const avail = await isUsernameAvailable(clean);
      setUsernameStatus(avail ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithEmailOrUsername(loginIdentifier, loginPassword);
      if (showToast) showToast('Bem-vindo(a) de volta à VYBE!', 'success');
    } catch (err: any) {
      console.error(err);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-email'
      ) {
        setErrorMessage('Credenciais incorretas. Verifique seu e-mail/usuário e senha.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('O provedor de E-mail/Senha ainda não foi ativado no Firebase Console.');
      } else {
        setErrorMessage(err.message || 'Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = regUsername.toLowerCase().trim();
    if (!regFullName.trim() || !cleanUser || !regEmail.trim() || !regPassword || !regBirthDate || !regCountry) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (cleanUser.length < 3) {
      setErrorMessage('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }

    if (usernameStatus === 'taken') {
      setErrorMessage('Este nome de usuário já está em uso por outro membro. Escolha outro.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWithEmail({
        displayName: regFullName.trim(),
        username: cleanUser,
        email: regEmail.trim(),
        password: regPassword,
        birthDate: regBirthDate,
        country: regCountry,
      });
      if (showToast) showToast('Conta criada com sucesso no banco de dados da VYBE!', 'success');
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('Este e-mail já está cadastrado. Tente fazer login na aba "Entrar".');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('Senha fraca. Use pelo menos 6 caracteres.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('O cadastro por E-mail/Senha não está ativado no Firebase Console.');
      } else {
        setErrorMessage(err.message || 'Erro ao cadastrar conta. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);
    try {
      const res = await loginWithGoogle();
      if (!res.needsProfileCompletion) {
        if (showToast) showToast('Login com Google realizado com sucesso!', 'success');
      } else {
        if (showToast) showToast('Conectado com Google! Agora complete seu perfil.', 'info');
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação do Google foi fechada antes da conclusão.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMessage('O navegador bloqueou a janela pop-up do Google. Por favor, permita pop-ups nesta página.');
      } else {
        setErrorMessage(err.message || 'Falha ao conectar com o Google. Tente novamente.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleCompleteGoogleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;
    setErrorMessage(null);

    const cleanUser = compUsername.toLowerCase().trim();
    if (!cleanUser || !compBirthDate || !compCountry) {
      setErrorMessage('Por favor, preencha todos os campos do seu perfil.');
      return;
    }

    if (cleanUser.length < 3) {
      setErrorMessage('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }

    if (usernameStatus === 'taken') {
      setErrorMessage('Este nome de usuário já está em uso por outro membro. Escolha outro.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeGoogleProfile(pendingGoogleUser, {
        username: cleanUser,
        birthDate: compBirthDate,
        country: compCountry,
      });
      if (showToast) showToast('Perfil configurado e salvo no banco de dados!', 'success');
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao salvar perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFA] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E2ECEC] shadow-lg shadow-black/5 p-6 sm:p-8 relative overflow-hidden">
        {/* Decorative subtle background tint */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#E1EEEE] rounded-full blur-2xl opacity-60 pointer-events-none" />

        {/* Logo */}
        <div className="flex flex-col items-center mb-6 relative">
          <img
            src="/logo.png"
            alt="VYBE Logo"
            className="h-10 sm:h-12 w-auto object-contain mb-2"
          />
          <p className="text-xs sm:text-sm text-gray-500 font-medium text-center">
            A sua nova rede social moderna, autêntica e sem filtros
          </p>
        </div>

        {errorMessage && (
          <div
            id="auth-error-alert"
            className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* View: Needs Google Profile Completion (First-time onboarding) */}
        {needsProfileCompletion ? (
          <div>
            <div className="mb-5 bg-[#F4F9F9] p-4 rounded-2xl border border-[#DCEAEA]">
              <div className="flex items-center gap-2 text-[#376263] font-semibold text-sm mb-1">
                <Sparkles className="w-4 h-4 text-[#548687]" />
                <span>Quase lá! Complete seu perfil</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Você se autenticou com o Google! Agora escolha como quer ser chamado(a) na VYBE.
              </p>
            </div>

            <form onSubmit={handleCompleteGoogleProfile} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Nome de usuário (@)
                  </label>
                  {usernameStatus === 'checking' && (
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> checando...
                    </span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> disponível
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> em uso
                    </span>
                  )}
                </div>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-complete-username"
                    type="text"
                    required
                    value={compUsername}
                    onChange={(e) => handleGoogleUsernameChange(e.target.value)}
                    placeholder="seunome"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Data de Nascimento
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-complete-birthdate"
                    type="date"
                    required
                    value={compBirthDate}
                    onChange={(e) => setCompBirthDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  País
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    id="select-complete-country"
                    value={compCountry}
                    onChange={(e) => setCompCountry(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors appearance-none"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                id="btn-complete-profile"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-[#548687] hover:bg-[#457273] text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Configurando seu perfil...</span>
                  </>
                ) : (
                  <span>Concluir e entrar na VYBE</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div>
            {/* Google Sign In Button (Instant 1-Click) */}
            <div className="mb-4">
              <button
                id="btn-google-auth"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleSubmitting}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 active:scale-[0.99] text-gray-800 text-sm font-semibold rounded-2xl border-2 border-gray-200 hover:border-[#548687]/50 transition-all shadow-xs cursor-pointer disabled:opacity-50 group"
              >
                {isGoogleSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#548687]" />
                ) : (
                  <svg className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Entrar com conta Google</span>
                <span className="ml-auto text-[10px] uppercase font-bold bg-[#E6F0F0] text-[#3B6869] px-2 py-0.5 rounded-full">
                  1 Clique
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                ou com e-mail e senha
              </span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Tabs: Entrar / Criar conta */}
            <div className="flex border-b border-gray-100 mb-5">
              <button
                id="tab-login"
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMessage(null);
                }}
                className={`flex-1 pb-2.5 text-sm font-semibold transition-colors border-b-2 text-center cursor-pointer ${
                  tab === 'login'
                    ? 'border-[#548687] text-[#548687]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Entrar
              </button>
              <button
                id="tab-register"
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMessage(null);
                }}
                className={`flex-1 pb-2.5 text-sm font-semibold transition-colors border-b-2 text-center cursor-pointer ${
                  tab === 'register'
                    ? 'border-[#548687] text-[#548687]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Criar conta
              </button>
            </div>

            {/* TAB: LOGIN */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    E-mail ou @usuário
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-login-identifier"
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="ex: mari.santos ou mari@email.com"
                      className="w-full pl-9 pr-3 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Sua senha"
                      className="w-full pl-9 pr-10 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="btn-submit-login"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 bg-[#548687] hover:bg-[#457273] text-white font-medium text-sm rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <span>Entrar na VYBE</span>
                  )}
                </button>
              </form>
            )}

            {/* TAB: REGISTER (CRIAR CONTA) */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nome completo
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-register-fullname"
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Mariana Santos"
                      className="w-full pl-9 pr-3 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700">
                      Nome de usuário (@)
                    </label>
                    {usernameStatus === 'checking' && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> verificando...
                      </span>
                    )}
                    {usernameStatus === 'available' && (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> disponível
                      </span>
                    )}
                    {usernameStatus === 'taken' && (
                      <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> indisponível
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-register-username"
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => checkUsername(e.target.value)}
                      placeholder="mari.santos"
                      className={`w-full pl-9 pr-3 py-2 bg-[#F9FBFC] border rounded-xl text-sm focus:outline-none transition-colors ${
                        usernameStatus === 'available'
                          ? 'border-emerald-300 focus:border-emerald-500'
                          : usernameStatus === 'taken'
                          ? 'border-rose-300 focus:border-rose-500'
                          : 'border-gray-200 focus:border-[#548687]'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-register-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="mariana@exemplo.com"
                      className="w-full pl-9 pr-3 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Senha (mínimo 6 caracteres)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-register-password"
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Crie uma senha forte"
                      className="w-full pl-9 pr-10 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Data de nascimento & País */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Data de nascimento
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-register-birthdate"
                        type="date"
                        required
                        value={regBirthDate}
                        onChange={(e) => setRegBirthDate(e.target.value)}
                        className="w-full pl-9 pr-2 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#548687] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      País
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        id="select-register-country"
                        value={regCountry}
                        onChange={(e) => setRegCountry(e.target.value)}
                        className="w-full pl-9 pr-2 py-2 bg-[#F9FBFC] border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#548687] transition-colors appearance-none"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  id="btn-submit-register"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-2.5 px-4 bg-[#548687] hover:bg-[#457273] text-white font-medium text-sm rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Criando sua conta...</span>
                    </>
                  ) : (
                    <span>Criar conta na VYBE</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Database real confirmation badge */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Banco de dados Firestore ativo & sincronizado em tempo real</span>
        </div>
      </div>
    </div>
  );
}


