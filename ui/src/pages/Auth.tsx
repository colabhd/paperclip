import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
// Colab[hd]: o botão de SSO só aparece se o servidor disser que há provedor.
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";
import { getRememberedInvitePath } from "../lib/invite-memory";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { PaperclipLoading } from "@/components/AnimatedPaperclipIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaperclipLockup } from "../components/PaperclipLockup";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = "auth-error";

  const nextPath = useMemo(
    () => searchParams.get("next") || getRememberedInvitePath() || "/",
    [searchParams],
  );
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInEmail({ email: email.trim(), password });
        return;
      }
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      // Reset rather than invalidate: the `["companies"]` entry is shared app-wide and
      // is not account-scoped, so invalidating leaves the previous account's list
      // readable (and any fetch for that session in flight) until the refetch lands.
      // Sign-in can change accounts, so drop the list outright.
      await queryClient.resetQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Authentication failed");
    },
  });

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === "sign_in" || (name.trim().length > 0 && password.trim().length >= 8));

  if (isSessionLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <PaperclipLoading className="min-h-0" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Left half — form */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          <div className="mb-8">
            <PaperclipLockup className="h-5 w-auto" />
          </div>

          <h1 className="text-xl font-semibold">
            {mode === "sign_in" ? "Sign in to Paperclip" : "Create your Paperclip account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "Use your email and password to access this instance."
              : "Create an account for this instance. Email confirmation is not required in v1."}
          </p>

          <ColabhdSsoButton />

          <form
            className="mt-6 space-y-4"
            method="post"
            action={mode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending) return;
              if (!canSubmit) {
                setError("Please fill in all required fields.");
                return;
              }
              mutation.mutate();
            }}
          >
            {mode === "sign_up" && (
              <div>
                <label htmlFor="name" className="text-xs text-muted-foreground mb-1 block">Name</label>
                <input
                  id="name"
                  name="name"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  autoFocus
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input
                id="email"
                name="email"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                autoFocus={mode === "sign_in"}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs text-muted-foreground mb-1 block">Password</label>
              <input
                id="password"
                name="password"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            {error && (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={mutation.isPending}
              aria-disabled={!canSubmit || mutation.isPending}
              className={`w-full ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
            >
              {mutation.isPending
                ? "Working…"
                : mode === "sign_in"
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          <div className="mt-5 text-sm text-muted-foreground">
            {mode === "sign_in" ? "Need an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => {
                setError(null);
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              }}
            >
              {mode === "sign_in" ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>
      </div>

      {/* Right half — ASCII art animation (hidden on mobile) */}
      <div className="hidden md:block w-1/2 overflow-hidden">
        <AsciiArtAnimation />
      </div>
    </div>
  );
}

/**
 * Colab[hd] — entrada pelo SSO.
 *
 * Só renderiza quando `/api/health` anuncia um provedor: instância sem OIDC
 * configurado fica idêntica ao upstream, sem botão morto.
 *
 * O endereço NÃO é `/sign-in/oauth2`. No `better-auth@1.7.0` o plugin
 * `generic-oauth` não registra rota própria — ele inscreve o provedor na
 * máquina social do núcleo, e a entrada é `POST /api/auth/sign-in/social`,
 * com a volta em `/api/auth/callback/<providerId>`. Conferido no pacote
 * instalado: "Providers are used through the standard `signIn.social` and
 * `callback/:id` core endpoints — no plugin-specific endpoints needed."
 */
function ColabhdSsoButton() {
  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: healthApi.get,
    staleTime: 60_000,
  });
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sso = health?.sso;
  if (!sso) return null;

  async function entrar() {
    setEntrando(true);
    setErro(null);
    try {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: sso!.providerId, callbackURL: "/" }),
      });
      const payload = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!res.ok || !payload?.url) {
        // A mensagem diz o que fazer, não o código: quem vê esta tela não
        // tem como agir sobre um 502.
        setErro("O provedor de identidade não respondeu. Tente de novo; se persistir, avise quem cuida do SSO.");
        setEntrando(false);
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setErro("Não foi possível falar com o provedor de identidade.");
      setEntrando(false);
    }
  }

  return (
    <div className="mt-6">
      <Button type="button" className="w-full" onClick={() => void entrar()} disabled={entrando}>
        {entrando ? "Redirecionando…" : `Entrar com ${sso.displayName}`}
      </Button>
      {erro && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {erro}
        </p>
      )}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        ou use e-mail e senha
      </p>
    </div>
  );
}
