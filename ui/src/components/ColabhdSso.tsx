import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";

/**
 * Colab[hd] — entrada pelo SSO da casa.
 *
 * Arquivo NOVO, e de propósito: a extensão mora aqui inteira, e os arquivos do
 * upstream (`pages/Auth.tsx`, `pages/InviteLanding.tsx`) só ganham o enxerto
 * que a chama. É o que faz o rebase caber quando o upstream publicar a próxima
 * versão -- conflito em arquivo nosso é conflito que a gente resolve lendo uma
 * coisa só.
 *
 * Só renderiza quando `/api/health` anuncia um provedor: instância sem OIDC
 * configurado fica idêntica ao upstream, sem botão morto.
 *
 * O endereço NÃO é `/sign-in/oauth2`. No `better-auth@1.7.0` o plugin
 * `generic-oauth` não registra rota própria -- ele inscreve o provedor na
 * máquina social do núcleo, e a entrada é `POST /api/auth/sign-in/social`,
 * com a volta em `/api/auth/callback/<providerId>`. Conferido no pacote
 * instalado: "Providers are used through the standard `signIn.social` and
 * `callback/:id` core endpoints -- no plugin-specific endpoints needed."
 */
export function useColabhdSso() {
  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: healthApi.get,
    staleTime: 60_000,
  });
  return health?.sso ?? null;
}

/**
 * `callbackURL` é para onde o better-auth manda a pessoa DEPOIS da volta do
 * IdP. Na tela de convite tem de ser o próprio convite: quem entrou para
 * aceitar um convite e cai na raiz precisa achar o link de novo, e o convite
 * da casa chega por fora do app.
 */
export function ColabhdSsoButton({ callbackURL = "/" }: { callbackURL?: string }) {
  const sso = useColabhdSso();
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!sso) return null;

  // Depois da guarda acima, e para que `entrar` nao precise de `sso!`: a
  // assercao nao-nula calaria o compilador sem provar nada.
  const { providerId } = sso;

  async function entrar() {
    setEntrando(true);
    setErro(null);
    try {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, callbackURL }),
      });
      const payload = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!res.ok || !payload?.url) {
        // A mensagem diz o que fazer, não o código: quem vê esta tela não tem
        // como agir sobre um 502.
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
    </div>
  );
}
