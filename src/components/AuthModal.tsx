import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  registerWithEmail,
  loginWithEmailOrUsername,
  loginWithGoogle,
  completeGoogleProfile,
  isUsernameAvailable,
  isEmailAvailable,
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
  ArrowLeft,
  Check,
  X,
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, query, limit, doc, setDoc } from 'firebase/firestore';
import { toggleFollowUser as serviceToggleFollowUser, createFollowRequest } from '../services/socialService';

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

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

interface AuthModalProps {
  onSuccess?: () => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
  isModal?: boolean;
  onClose?: () => void;
  initialTab?: 'login' | 'register';
  paywallMessage?: string;
}

export function AuthModal({
  showToast,
  isModal = false,
  onClose,
  initialTab = 'login',
  paywallMessage,
}: AuthModalProps) {
  const { needsProfileCompletion, pendingGoogleUser, refreshProfile } = useAuth();

  // Registration step state: 0 = login view, 1 to 5 = onboarding step-by-step
  const [regStep, setRegStep] = useState<number>(initialTab === 'register' ? 1 : 0);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Step-by-Step Onboarding State
  const [regEmail, setRegEmail] = useState('');
  const [regEmailError, setRegEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Date of birth parts
  const [regBirthDay, setRegBirthDay] = useState('');
  const [regBirthMonth, setRegBirthMonth] = useState('Janeiro');
  const [regBirthYear, setRegBirthYear] = useState('');
  const [regBirthError, setRegBirthError] = useState<string | null>(null);
  const [regCountry, setRegCountry] = useState('Brasil');

  const [regUsername, setRegUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Step 5 recommended accounts
  const [suggestedAccounts, setSuggestedAccounts] = useState<any[]>([]);
  const [selectedFollows, setSelectedFollows] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Complete profile state (for Google Auth first-time users)
  const [compUsername, setCompUsername] = useState('');
  const [compBirthDate, setCompBirthDate] = useState('');
  const [compCountry, setCompCountry] = useState('Brasil');

  // Global submit status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password Strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: '', score: 0, colorClass: 'bg-gray-100', textClass: 'text-gray-400' };
    if (pass.length < 8) return { label: 'Fraca (mínimo 8 caracteres)', score: 1, colorClass: 'bg-rose-500', textClass: 'text-rose-600' };
    
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    
    if (hasLetters && hasNumbers && hasSpecial) {
      return { label: 'Forte', score: 3, colorClass: 'bg-emerald-500', textClass: 'text-emerald-600' };
    } else if ((hasLetters && hasNumbers) || (hasLetters && hasSpecial) || (hasNumbers && hasSpecial)) {
      return { label: 'Média', score: 2, colorClass: 'bg-amber-500', textClass: 'text-amber-600' };
    } else {
      return { label: 'Fraca', score: 1, colorClass: 'bg-rose-500', textClass: 'text-rose-600' };
    }
  };

  const strength = getPasswordStrength(regPassword);

  // Fetch suggested accounts on Step 5
  useEffect(() => {
    if (regStep === 5) {
      const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        try {
          const snap = await getDocs(query(collection(db, 'users'), limit(15)));
          const list = snap.docs
            .map((doc) => doc.data())
            .filter((u: any) => u.username && u.uid !== 'system')
            .slice(0, 4);

          // Fallback if no users in Firestore
          if (list.length === 0) {
            setSuggestedAccounts([
              { uid: 'fallback_ana', displayName: 'Ana Silva', username: 'ana_silva', bio: 'Moda, viagens e café ☕✨' },
              { uid: 'fallback_joao', displayName: 'João Medeiros', username: 'joao.m', bio: 'Explorando novas batidas 🎧🎵' },
              { uid: 'fallback_vybe', displayName: 'VYBE Oficial', username: 'vybe.oficial', bio: 'Perfil oficial da sua nova rede social 🚀' },
              { uid: 'fallback_gabi', displayName: 'Gabi Martins', username: 'gabi_martins', bio: 'Vivendo intensamente cada segundo 🌻' }
            ]);
          } else {
            setSuggestedAccounts(list);
          }
        } catch (e) {
          console.error('Error fetching users for onboarding suggestions:', e);
          // Fallback on error
          setSuggestedAccounts([
            { uid: 'fallback_ana', displayName: 'Ana Silva', username: 'ana_silva', bio: 'Moda, viagens e café ☕✨' },
            { uid: 'fallback_joao', displayName: 'João Medeiros', username: 'joao.m', bio: 'Explorando novas batidas 🎧🎵' },
            { uid: 'fallback_vybe', displayName: 'VYBE Oficial', username: 'vybe.oficial', bio: 'Perfil oficial da sua nova rede social 🚀' },
            { uid: 'fallback_gabi', displayName: 'Gabi Martins', username: 'gabi_martins', bio: 'Vivendo intensamente cada segundo 🌻' }
          ]);
        } finally {
          setLoadingSuggestions(false);
        }
      };
      fetchSuggestions();
    }
  }, [regStep]);

  // Real-time username validation
  useEffect(() => {
    if (regStep !== 4 || !regUsername) {
      setUsernameStatus('idle');
      return;
    }

    const checkAvailability = async () => {
      if (regUsername.length < 3) {
        setUsernameStatus('idle');
        return;
      }
      setUsernameStatus('checking');
      try {
        const avail = await isUsernameAvailable(regUsername);
        setUsernameStatus(avail ? 'available' : 'taken');
      } catch (err) {
        console.error('Error checking username availability:', err);
        setUsernameStatus('idle');
      }
    };

    const timeout = setTimeout(checkAvailability, 400);
    return () => clearTimeout(timeout);
  }, [regUsername, regStep]);

  // Real-time Google username checking
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

  // Login handler
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

  // Google Sign In
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

  // Google complete profile
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

  // Step-by-Step Onboarding Navigation Handlers
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegEmailError(null);
    setErrorMessage(null);

    const email = regEmail.trim();
    if (!email) {
      setRegEmailError('O e-mail é obrigatório.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setRegEmailError('Digite um formato de e-mail válido.');
      return;
    }

    setCheckingEmail(true);
    try {
      const isAvailable = await isEmailAvailable(email);
      if (!isAvailable) {
        setRegEmailError('Este e-mail já está cadastrado por outro usuário.');
      } else {
        setRegStep(2);
      }
    } catch (err) {
      console.warn('Error during preliminary email check, proceeding to step 2:', err);
      setRegStep(2);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (regPassword.length < 8) {
      setErrorMessage('A senha deve conter no mínimo 8 caracteres.');
      return;
    }
    setRegStep(3);
  };

  const calculateAge = (day: number, month: number, year: number) => {
    const today = new Date();
    let age = today.getFullYear() - year;
    const m = today.getMonth() - (month - 1);
    if (m < 0 || (m === 0 && today.getDate() < day)) {
      age--;
    }
    return age;
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegBirthError(null);
    setErrorMessage(null);

    const d = parseInt(regBirthDay);
    const m = MONTHS.indexOf(regBirthMonth) + 1;
    const y = parseInt(regBirthYear);

    if (isNaN(d) || isNaN(y) || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) {
      setRegBirthError('Por favor, informe uma data de nascimento válida.');
      return;
    }

    const age = calculateAge(d, m, y);
    if (age < 13) {
      setRegBirthError('Você precisa ter pelo menos 13 anos para usar a VYBE.');
      return;
    }

    setRegStep(4);
  };

  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const username = regUsername.toLowerCase().trim();
    if (username.length < 3) {
      setErrorMessage('O nome de usuário deve conter pelo menos 3 caracteres.');
      return;
    }

    if (usernameStatus === 'taken') {
      setErrorMessage('Este nome de usuário já está em uso.');
      return;
    }

    if (usernameStatus !== 'available') {
      setErrorMessage('Por favor, escolha um nome de usuário disponível.');
      return;
    }

    setRegStep(5);
  };

  const toggleSelectFollow = (uid: string) => {
    if (selectedFollows.includes(uid)) {
      setSelectedFollows(selectedFollows.filter(id => id !== uid));
    } else {
      setSelectedFollows([...selectedFollows, uid]);
    }
  };

  // Final Step - Complete Registration
  const handleStep5Finish = async (skipFollows: boolean = false) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const d = parseInt(regBirthDay);
      const m = MONTHS.indexOf(regBirthMonth) + 1;
      const y = parseInt(regBirthYear);

      if (isNaN(d) || isNaN(y) || calculateAge(d, m, y) < 13) {
        setErrorMessage('Você precisa ter pelo menos 13 anos para criar uma conta na VYBE.');
        setIsSubmitting(false);
        setRegStep(3);
        return;
      }

      const formattedBirthDate = `${regBirthYear}-${String(MONTHS.indexOf(regBirthMonth) + 1).padStart(2, '0')}-${String(regBirthDay).padStart(2, '0')}`;
      
      // Complete signup
      const newProfile = await registerWithEmail({
        displayName: regUsername.toLowerCase().trim(),
        username: regUsername.toLowerCase().trim(),
        email: regEmail.trim(),
        password: regPassword,
        birthDate: formattedBirthDate,
        country: regCountry,
      });

      // Write any selected follows or follow requests
      const currentUid = newProfile?.uid || auth.currentUser?.uid;
      if (currentUid && !skipFollows && selectedFollows.length > 0) {
        for (const targetUid of selectedFollows) {
          const targetAcc = suggestedAccounts.find((a) => a.uid === targetUid);
          const isTargetPrivate = Boolean(targetAcc?.conta_privada || targetAcc?.isPrivate);
          if (isTargetPrivate) {
            await createFollowRequest(currentUid, targetUid, newProfile || undefined).catch((err) =>
              console.warn('Error saving onboarding follow request:', err)
            );
          } else {
            await serviceToggleFollowUser(currentUid, targetUid, false, newProfile || undefined).catch((err) =>
              console.warn('Error saving onboarding follow:', err)
            );
          }
        }
      }

      if (showToast) showToast('Conta criada com sucesso! Bem-vindo à VYBE! 🎉', 'success');
      await refreshProfile();
    } catch (err: any) {
      console.error('Error completing onboarding signup:', err);
      if (err.code === 'auth/email-already-in-use') {
        setRegStep(1);
        setRegEmailError('Este e-mail já está cadastrado por outro usuário.');
        setErrorMessage('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
      } else if (err.code === 'auth/invalid-email') {
        setRegStep(1);
        setRegEmailError('O formato do e-mail é inválido.');
        setErrorMessage('Por favor, digite um e-mail válido.');
      } else if (err.code === 'auth/weak-password') {
        setRegStep(2);
        setErrorMessage('A senha é muito fraca. Ela deve conter pelo menos 8 caracteres.');
      } else if (err.message && err.message.includes('nome de usuário já está em uso')) {
        setRegStep(4);
        setErrorMessage('Este nome de usuário já está em uso. Por favor, escolha outro.');
      } else {
        setErrorMessage(err.message || 'Houve um erro ao salvar o seu cadastro. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper sanitizer for username typing
  const cleanAndSetUsername = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setRegUsername(clean);
  };

  const cardContent = (
    <div className="w-full max-w-md bg-white rounded-3xl border border-[#E2ECEC] shadow-xl shadow-black/10 p-6 sm:p-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Close button if rendered inside a modal */}
      {isModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors z-20 cursor-pointer"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Decorative subtle background tint */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#E1EEEE] rounded-full blur-2xl opacity-60 pointer-events-none" />

      {/* Header messages */}
      {paywallMessage && regStep === 0 && (
        <div className="mb-5 p-3.5 rounded-2xl bg-[#EAF3F3] border border-[#548687]/30 text-[#2C5253] text-xs sm:text-sm flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-[#548687] shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">
            Entre ou crie sua conta para {paywallMessage}.
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          id="auth-error-alert"
          className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Google profile completion block */}
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
      ) : regStep === 0 ? (
        /* STANDARD LOGIN SCREEN (Step 0) */
        <div>
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

          {/* Google Sign In */}
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

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
              ou com e-mail e senha
            </span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Standard Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
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
                  placeholder="mari.santos ou mari@email.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
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
                  className="w-full pl-9 pr-10 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
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
              className="w-full mt-2 py-3 px-4 bg-[#548687] hover:bg-[#457273] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

          {/* Create Account Link below login page */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setRegStep(1);
                }}
                className="text-[#548687] hover:text-[#3f6768] font-bold cursor-pointer transition-colors hover:underline"
              >
                Cadastre-se na VYBE
              </button>
            </p>
          </div>
        </div>
      ) : (
        /* STEP-BY-STEP ONBOARDING REGISTRATION VIEW (Steps 1-5) */
        <div>
          {/* Segmented Progress Bar */}
          <div className="flex gap-1.5 items-center mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s <= regStep ? 'bg-[#548687]' : 'bg-gray-100'
                }`}
              />
            ))}
            <span className="text-xs font-semibold text-gray-400 ml-2 shrink-0">
              {regStep}/5
            </span>
          </div>

          {/* Navigation Back Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setRegEmailError(null);
                setRegBirthError(null);
                setRegStep(regStep - 1);
              }}
              className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-full cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Voltar
            </span>
          </div>

          {/* STEP 1: E-mail */}
          {regStep === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight mb-2">
                  Qual é o seu e-mail?
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  Cadastre um e-mail válido para acessar a plataforma de forma segura.
                </p>
                
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-onboarding-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      setRegEmailError(null);
                    }}
                    placeholder="voce@email.com"
                    className={`w-full pl-9 pr-3 py-2.5 bg-[#F9FBFC] border rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors ${
                      regEmailError ? 'border-rose-400 focus:border-rose-500' : 'border-gray-200'
                    }`}
                  />
                </div>
                {regEmailError && (
                  <p className="mt-1.5 text-xs text-rose-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {regEmailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={checkingEmail}
                className="w-full py-3 px-4 bg-[#548687] hover:bg-[#457273] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {checkingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando e-mail...</span>
                  </>
                ) : (
                  <span>Continuar</span>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setRegStep(0);
                    }}
                    className="text-[#548687] hover:underline font-semibold cursor-pointer"
                  >
                    Entrar na VYBE
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: Senha */}
          {regStep === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight mb-2">
                  Crie uma senha
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  Sua senha é a chave do seu perfil. Escolha uma combinação segura de pelo menos 8 caracteres.
                </p>

                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-onboarding-password"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Pelo menos 8 caracteres"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {regPassword.length > 0 && (
                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Força da senha:</span>
                      <span className={`font-semibold ${strength.textClass}`}>{strength.label}</span>
                    </div>
                    <div className="flex gap-1 h-1.5">
                      <div className={`flex-1 rounded-full ${strength.score >= 1 ? strength.colorClass : 'bg-gray-100'}`} />
                      <div className={`flex-1 rounded-full ${strength.score >= 2 ? strength.colorClass : 'bg-gray-100'}`} />
                      <div className={`flex-1 rounded-full ${strength.score >= 3 ? strength.colorClass : 'bg-gray-100'}`} />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={regPassword.length < 8}
                className="w-full py-3 px-4 bg-[#548687] hover:bg-[#457273] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Continuar</span>
              </button>
            </form>
          )}

          {/* STEP 3: Data de nascimento + País */}
          {regStep === 3 && (
            <form onSubmit={handleStep3Submit} className="space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight mb-2">
                  Quando você nasceu e onde vive?
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  Precisamos verificar sua idade. Apenas pessoas com 13 anos ou mais podem participar da VYBE.
                </p>

                {/* Date Birth Selects */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-600">
                    Data de nascimento
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Dia */}
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      placeholder="Dia"
                      value={regBirthDay}
                      onChange={(e) => {
                        setRegBirthDay(e.target.value);
                        setRegBirthError(null);
                      }}
                      className="w-full px-3 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                    />
                    {/* Mês */}
                    <select
                      value={regBirthMonth}
                      onChange={(e) => {
                        setRegBirthMonth(e.target.value);
                        setRegBirthError(null);
                      }}
                      className="w-full px-2 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors appearance-none"
                    >
                      {MONTHS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    {/* Ano */}
                    <input
                      type="number"
                      required
                      min="1900"
                      max={new Date().getFullYear()}
                      placeholder="Ano"
                      value={regBirthYear}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRegBirthYear(val);
                        setRegBirthError(null);
                        const y = parseInt(val);
                        const d = parseInt(regBirthDay) || 1;
                        const m = MONTHS.indexOf(regBirthMonth) + 1;
                        if (!isNaN(y) && val.length === 4) {
                          const age = calculateAge(d, m, y);
                          if (age < 13) {
                            setRegBirthError('Você precisa ter pelo menos 13 anos para usar a VYBE.');
                          }
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors"
                    />
                  </div>
                  {regBirthError && (
                    <p className="mt-1.5 text-xs text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {regBirthError}
                    </p>
                  )}
                </div>

                {/* País Select */}
                <div className="mt-4 space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600">
                    Em qual país você mora?
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={regCountry}
                      onChange={(e) => setRegCountry(e.target.value)}
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
              </div>

              <button
                type="submit"
                disabled={Boolean(regBirthError) || (Boolean(regBirthYear) && regBirthYear.length === 4 && calculateAge(parseInt(regBirthDay) || 1, MONTHS.indexOf(regBirthMonth) + 1, parseInt(regBirthYear)) < 13)}
                className="w-full py-3 px-4 bg-[#548687] hover:bg-[#457273] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Continuar</span>
              </button>
            </form>
          )}

          {/* STEP 4: Nome de usuário */}
          {regStep === 4 && (
            <form onSubmit={handleStep4Submit} className="space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight mb-2">
                  Escolha um nome de usuário
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  Esse será seu @ na VYBE. Outras pessoas usarão ele para marcar você, enviar mensagens ou pesquisar seu perfil.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700">
                      Nome de usuário (@)
                    </label>
                    {usernameStatus === 'checking' && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#548687]" /> checando...
                      </span>
                    )}
                    {usernameStatus === 'available' && (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3 shrink-0" /> disponível
                      </span>
                    )}
                    {usernameStatus === 'taken' && (
                      <span className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-full">
                        <X className="w-3 h-3 shrink-0" /> em uso
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="input-onboarding-username"
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => cleanAndSetUsername(e.target.value)}
                      placeholder="seunome"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#F9FBFC] border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#548687] transition-colors font-medium lowercase"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-normal">
                    Use apenas letras minúsculas, números, pontos (.) ou sublinhados (_). Sem espaços.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={usernameStatus !== 'available' || regUsername.length < 3}
                className="w-full py-3 px-4 bg-[#548687] hover:bg-[#457273] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Continuar</span>
              </button>
            </form>
          )}

          {/* STEP 5: Sugestão de seguir contas */}
          {regStep === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight mb-1">
                  Siga algumas contas
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mb-4 leading-normal">
                  Siga criadores para começar a personalizar e dar vida ao seu feed na VYBE.
                </p>

                {loadingSuggestions ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[#548687]" />
                    <span className="text-xs text-gray-400">Carregando sugestões...</span>
                  </div>
                ) : (
                  /* Accounts list */
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {suggestedAccounts.map((account) => {
                      const isSelected = selectedFollows.includes(account.uid);
                      const isPrivate = Boolean(account.conta_privada || account.isPrivate);
                      return (
                        <div
                          key={account.uid}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 ${
                            isSelected
                              ? 'bg-[#EBF5F5] border-[#548687]/40'
                              : 'bg-[#F9FBFC] border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-[#E1EEEE] text-[#3B6869] flex items-center justify-center font-bold text-sm border border-white shrink-0 uppercase">
                            {account.displayName ? account.displayName[0] : account.username[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-gray-800 truncate">
                                {account.displayName || account.username}
                              </h4>
                              {isPrivate && (
                                <Lock className="w-3 h-3 text-gray-400 shrink-0" title="Conta privada" />
                              )}
                            </div>
                            <p className="text-[10px] text-[#548687] font-medium truncate mb-0.5">
                              @{account.username}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate leading-tight">
                              {account.bio || (isPrivate ? 'Conta privada na rede VYBE.' : 'Criador na rede social VYBE.')}
                            </p>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => toggleSelectFollow(account.uid)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                              isSelected
                                ? 'bg-white text-[#548687] border border-[#548687]/30 flex items-center gap-1 shadow-xs'
                                : isPrivate
                                ? 'bg-gray-800 hover:bg-gray-900 text-white shadow-xs'
                                : 'bg-[#548687] hover:bg-[#457273] text-white shadow-xs'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3 h-3 shrink-0" />
                                <span>{isPrivate ? 'Solicitado' : 'Seguindo'}</span>
                              </>
                            ) : (
                              <span>{isPrivate ? 'Solicitar' : 'Seguir'}</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleStep5Finish(false)}
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-[#548687] hover:bg-[#457273] text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Concluindo cadastro...</span>
                    </>
                  ) : (
                    <span>Entrar na VYBE</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleStep5Finish(true)}
                  disabled={isSubmitting}
                  className="w-full py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 hover:underline transition-colors cursor-pointer text-center"
                >
                  Pular por enquanto
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()}>{cardContent}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAFA] flex flex-col justify-center items-center p-4 sm:p-6 animate-fade-in">
      {cardContent}
    </div>
  );
}
