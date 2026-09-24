/**
 * SSO por OIDC — extensão do Colab[hd] sobre o Paperclip.
 *
 * POR QUE EXISTE
 *
 * A diretriz de IAM da casa é "SSO nas aplicações, não base de usuário por
 * app": a prestação de contas depende de trilha por pessoa, e login por
 * aplicação faz o registro apontar para uma conta em vez de alguém. O
 * Paperclip só tem login próprio (Better Auth, e-mail e senha), então quem
 * entra atravessa duas portas — o provedor de identidade e a do app — e a
 * segunda cria um cadastro paralelo.
 *
 * O QUE ESTE ARQUIVO FAZ, E O QUE ELE NÃO FAZ
 *
 * Liga o plugin `genericOAuth`, que já vem no `better-auth@1.7.0` instalado —
 * nenhuma dependência nova. Ele acrescenta um provedor; NÃO desliga o login
 * por e-mail e senha, que segue disponível e é o caminho de recuperação se o
 * provedor de identidade cair. Fechar essa porta é decisão de implantação,
 * pela variável `PAPERCLIP_AUTH_DISABLE_SIGN_UP` e pela política do provedor,
 * não desta extensão.
 *
 * FALHA FECHADA
 *
 * Sem as três variáveis, devolve `null` e o app sobe exatamente como o
 * upstream. Não há modo meio-ligado: ou o provedor está inteiro, ou não
 * existe. Uma configuração pela metade que ainda mostrasse o botão levaria a
 * pessoa a uma tela de erro do provedor, e o sintoma apontaria para o lugar
 * errado.
 */
import { genericOAuth } from "better-auth/plugins";

export type ColabhdOidcSettings = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  providerId: string;
  displayName: string;
};

/**
 * Lê a configuração do ambiente. As três primeiras são obrigatórias e não têm
 * valor padrão: um padrão aqui seria um provedor de identidade adivinhado.
 */
export function resolveColabhdOidcSettings(
  env: NodeJS.ProcessEnv = process.env,
): ColabhdOidcSettings | null {
  const issuer = env.PAPERCLIP_OIDC_ISSUER?.trim();
  const clientId = env.PAPERCLIP_OIDC_CLIENT_ID?.trim();
  const clientSecret = env.PAPERCLIP_OIDC_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) return null;

  return {
    issuer,
    clientId,
    clientSecret,
    providerId: env.PAPERCLIP_OIDC_PROVIDER_ID?.trim() || "sso",
    displayName: env.PAPERCLIP_OIDC_DISPLAY_NAME?.trim() || "SSO",
  };
}

/**
 * O plugin, pronto para entrar no array de `plugins` do Better Auth.
 *
 * `discoveryUrl` em vez de URLs escritas à mão: o provedor publica
 * `authorization_endpoint`, `token_endpoint` e `jwks_uri` no documento de
 * descoberta, e escrevê-las aqui criaria um segundo lugar declarando o que o
 * provedor já declara — que envelhece calado quando ele muda.
 */
export function colabhdOidcPlugin(settings: ColabhdOidcSettings) {
  return genericOAuth({
    config: [
      {
        providerId: settings.providerId,
        discoveryUrl: `${settings.issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        scopes: ["openid", "profile", "email"],
        /**
         * PKCE ligado. Não é opcional aqui: o fluxo é de navegador, e sem PKCE
         * um código interceptado na volta é trocável por sessão.
         */
        pkce: true,
        /**
         * Nome e e-mail são reescritos do provedor a cada entrada. O provedor
         * é a fonte da verdade da identidade; deixar a cópia local divergir é
         * como a trilha por pessoa se perde sem ninguém notar.
         */
        overrideUserInfo: true,
      },
    ],
  });
}
