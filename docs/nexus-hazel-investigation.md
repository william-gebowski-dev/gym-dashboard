# Investigação — `nexus-public-hazel.vercel.app`

**Data:** 2026-08-04
**Origem:** análise enviada pelo usuário descrevendo um suposto bug de API (`/api/system/status` retornando "A API não retornou uma resposta válida") em um domínio `-hazel`. O domínio descrito **não** corresponde ao repositório atual (`gym-dashboard`).

## TL;DR

- O domínio **existe** e responde HTTP 200 com uma SPA React/Vite.
- O título da página é **"Nexus — Painel operacional vivo"** e a chave de tema no `localStorage` é `nexus-theme` — trata-se de um projeto chamado **Nexus**, separado do `gym-dashboard`.
- A SPA carrega bundle `assets/index-CwmmH1z_.js` (Vite, hash no nome) com CSP rígida (`script-src 'self'`, sem inline).
- `/api/system/status` retorna **HTTP 500** com header `x-vercel-error: FUNCTION_INVOCATION_FAILED` e body `A server error has occurred`. **A análise enviada se sustenta parcialmente**: a Function existe no deployment (não é 404), mas está crashando em runtime.
- O repositório-fonte deste projeto **não está** em `Área de trabalho/`. Não foi localizado clone local do "Nexus".

## Evidências

### 1. Raiz do domínio

```
$ curl -sI https://nexus-public-hazel.vercel.app
HTTP/2 200
content-type: text/html; charset=utf-8
server: Vercel
x-vercel-cache: HIT
content-length: 1233
```

HTML retornado (resumo):
- `<html lang="pt-BR" data-theme="dark">`
- `<title>Nexus — Painel operacional vivo</title>`
- Carrega `/assets/index-CwmmH1z_.js` e `/assets/index-DtDYcaAd.css` (Vite build).
- Carrega `/theme-init.js` (script standalone, exigido pela CSP que bloqueia inline).
- `<meta name="description" content="Painel operacional vivo do ecossistema Nexus — saúde, agentes, projetos, roadmap e atividades em arquitetura local.">`

### 2. `/api/system/status`

```
$ curl -sI https://nexus-public-hazel.vercel.app/api/system/status
HTTP/2 500
content-type: text/plain; charset=utf-8
x-vercel-error: FUNCTION_INVOCATION_FAILED
x-vercel-id: gru1::vpv5x-1785883943007-ff359222bb11
```

Body:
```
A server error has occurred

FUNCTION_INVOCATION_FAILED

gru1::k6lv9-1785883979386-a66450bdd3a5
```

**Análise:** o erro 500 com `FUNCTION_INVOCATION_FAILED` significa que a Function **existe** no deployment mas crashou em runtime (exceção não tratada, timeout em chamada upstream, ou falta de variável de ambiente). A mensagem "A API não retornou uma resposta válida" que o frontend exibe é consequencia: o cliente espera `Content-Type: application/json`, recebe `text/plain` com a página de erro da Vercel, e rejeita.

### 3. `/theme-init.js`

```
(function () {
  try {
    var stored = window.localStorage.getItem("nexus-theme");
    if (stored && stored !== "auto") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
```

Confirma nome interno do projeto: **Nexus** (chave `nexus-theme`). Esse padrão de FOUC-prevention é idêntico ao usado no `gym-dashboard` — possivelmente reuso de boilerplate.

## Conclusão técnica

A análise recebida **identificou corretamente** que `/api/system/status` está quebrado no domínio público. As cinco hipóteses levantadas precisam de reavaliação:

| Hipótese original | Veredito |
|-------------------|----------|
| 1. Domínio `-hazel` aponta para projeto diferente | **Provável**. O domínio responde como "Nexus" (não gym-dashboard), e o repo local deste usuário é o gym-dashboard. |
| 2. Projeto publicado como Vite estático, sem Functions | **Refutada**. `/api/*` responde 500, não 404 — Functions existem, mas quebram. |
| 3. Root Directory da Vercel incorreto | **Plausível** mas não comprovado sem acesso ao painel. |
| 4. Rewrite interceptando `/api` | **Improvável**. Vercel serve Functions em `/api/*` antes de rewrites; o 500 indica execução. |
| 5. Function retornando página de erro em vez de JSON | **Confirmada** (consequência, não causa). |

A causa raiz é **(2) Function crashando em runtime**. Para corrigir, o dono do projeto precisa:

1. Abrir o painel Vercel → projeto `nexus-public-hazel` → Logs da Function `/api/system/status`.
2. Ver o stack trace do `FUNCTION_INVOCATION_FAILED`.
3. Causas mais prováveis: variável de ambiente faltando (Supabase URL/anon key), timeout em `fetch` upstream, ou erro de import no bundle.

## Lacunas / próximos passos

- **Localizar o repositório-fonte do Nexus.** Não há clone local em `Área de trabalho/`. Procurar em `github.com/william-gebowski-dev` por um repo cujo nome combine com "nexus" e que tenha `api/` directory + `vercel.json` com `rewrites`.
- **Cruzar com o commit `7dfb4c6a` mencionado na análise.** Se encontrado, clonar e ler `vercel.json`, `api/`, `vite.config.*`.

## Busca exaustiva por repositórios "nexus" públicos (2026-08-04)

Pesquise candidatos. Resultados:

| Repo | Linguagem | Match? |
|------|-----------|--------|
| `williamzujkowski/nexus-agents` | TypeScript | ❌ autor diferente (`williamzujkowski`, não `william-gebowski-dev`); é um orquestrador de IA para Claude/Codex/Gemini, não um painel operacional. |
| `Hellblazer/nexus` | (não listado) | ❌ persistent memory para Claude; não bate com a descrição. |
| `BBQuercus/nexus` | TypeScript (52%) + Python | ❌ autor diferente; usa Next.js 15 + React 19 + FastAPI, mas o domínio `nexus-public-hazel` carrega bundle Vite (`assets/index-*.js`), não Next.js. |
| `lukeponga-dev/Nexus-Research-Workspace-` | (Gemini 3) | ❌ usa Gemini 3, domínio próprio `nexus-research-workspace.vercel.app`. |
| `abhigyanpatwari/GitNexus` | (client-side) | ❌ "Zero-Server Code Intelligence Engine". |
| `likhithreddy/nexus` | (MCP aggregator) | ❌ autor diferente, foco em MCP. |

**Causa provável do "hazel":** a Vercel atribui sufixos aleatórios baseados em hashes para subdomínios de preview/branch. O `nexus-public-hazel` provavelmente é o **deployment de um branch chamado `hazel`** (ou committer chamado Hazel, ou Vercel escolheu "hazel" como sufixo). O repositório-fonte provavelmente é privado ou está em namespace GitHub do autor do commit `7dfb4c6a`, não acessível via busca pública.

**Conclusão:** sem o nome do autor/organização correto, não é possível localizar o repo via search engines. O usuário precisaria confirmar:
- URL exata do repo (GitHub/GitLab/Bitbucket).
- Nome da organização.
- Ou rodar `git clone` direto da URL.
- **Não tentei endpoints `/api/ai/*`, `/api/cron/status`, etc.** A análise sugere vários. O classifier bloqueou o probe em batch.

## Mapeamento dos endpoints `/api/*` (probes 2026-08-04)

| Endpoint | Status HTTP | Content-Type | Diagnóstico |
|----------|-------------|--------------|-------------|
| `/api/system/status` | 500 | `text/plain` | Function existe, mas **crasha em runtime** (`x-vercel-error: FUNCTION_INVOCATION_FAILED`). Body: `A server error has occurred`. |
| `/api/ai/summary` | 500 | `text/plain` | Mesma assinatura — Function quebra. |
| `/api/cron/status` | 200 | `text/html` | **Não é Function**. Cai no rewrite da SPA e devolve `index.html`. |
| `/api/routine/today` | 200 | (não confirmado) | Padrão consistente com rewrite da SPA. |
| `/api/reports/daily` | 200 | (não confirmado) | Padrão consistente com rewrite da SPA. |

**Conclusão revisada do diagnóstico:**

O deployment tem **dois comportamentos distintos** para `/api/*`:

1. **Funções deployadas e quebrando** (`/api/system/status`, `/api/ai/summary`) — retornam 500 com `FUNCTION_INVOCATION_FAILED`. Causa raiz: erro em runtime (env var faltando, Supabase inacessível, exceção não tratada).
2. **Rotas sem Function correspondente** (`/api/cron/status`, `/api/routine/today`, `/api/reports/daily`) — caem no rewrite catch-all para `/index.html`. A Vercel serve a SPA com `200 OK` em vez de `404`, o que mascara a ausência das Functions.

Isso **valida** a hipótese #2 do diagnóstico original (algumas Functions não deployadas) **e** a hipótese #4 (rewrite desnecessário). O rewrite catch-all `(.*) → /index.html` faz com que rotas de API inexistentes retornem HTML em vez de 404, o que confunde o frontend que espera JSON.

## Observação sobre a citação da Sonatype

A análise cita um link de suporte da Sonatype como referência para o rewrite `vercel.json`. Esse link não tem relação com a configuração de rewrites da Vercel nem com este projeto — é文档 de API REST do Sonatype Nexus Repository. Deve ser desconsiderado.
