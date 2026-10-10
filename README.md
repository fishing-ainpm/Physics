# Física Teórica na Web

Plataforma web para **construir fórmulas de física teórica, fazer cálculos matemáticos e simular modelos físicos**, com interface em português brasileiro, tema escuro e layout responsivo (celular e computador).

Tudo roda no navegador: não há servidor nem conta. A biblioteca e o histórico ficam salvos no `localStorage` do navegador e podem ser exportados e importados em JSON.

## Funcionalidades

| Ferramenta | O que faz |
|---|---|
| **Editor de fórmulas** | Escreva expressões ou equações com pré-visualização em LaTeX (KaTeX). Detecta variáveis e constantes físicas, calcula qualquer variável a partir das outras (isolamento direto, solução polinomial fechada ou busca numérica em escala logarítmica), verifica as dimensões e envia a fórmula para o gráfico. |
| **Calculadora** | Avalia expressões com unidades (`3 m/s * 2 s`, `1 eV to J`), simplifica, deriva, resolve equações (forma fechada até grau 3, método de Brent nos outros casos) e calcula integrais definidas (Simpson adaptativo). |
| **Simulações** | 8 modelos com parâmetros ajustáveis, resultados numéricos, gráficos e documentação (equações, método, hipóteses, limitações, referências). |
| **Gráficos** | Plota até 8 funções. Símbolos extras viram parâmetros com controles deslizantes. Zoom, deslocamento, escala log e exportação PNG (Plotly). |
| **Unidades** | Conversão entre unidades compatíveis, análise dimensional de expressões, verificação dimensional de equações e tabela de constantes (CODATA 2018). |
| **Biblioteca** | Salve, edite, duplique, exclua e organize fórmulas por área, projeto e etiquetas. Inclui catálogo com 37 fórmulas de referência documentadas. Exporta e importa JSON. |
| **Histórico** | Registra cálculos, conversões, simulações e gráficos (até 300 entradas), com busca, filtros e botão **Reabrir** para refazer o cálculo na ferramenta de origem. |

### Simulações disponíveis

| Área | Modelo | Método |
|---|---|---|
| Mecânica clássica | Projétil com arrasto quadrático vs. vácuo | RK4 |
| Mecânica clássica | Pêndulo simples não linear com amortecimento | RK4 + período exato por AGM |
| Relatividade | Foguete com aceleração própria constante (movimento hiperbólico) | Analítico |
| Mecânica quântica | Partícula em poço infinito: superposição de estados e evolução temporal | Analítico + integração numérica |
| Cosmologia | Expansão ΛCDM (Friedmann): idade, a(t), distâncias, H(z) | Quadratura adaptativa |
| Termodinâmica | Distribuição de Maxwell–Boltzmann | Analítico |
| Termodinâmica | Processos isotérmico/adiabático/isobárico (diagrama P–V) | Analítico + ∫P dV numérico |
| Eletromagnetismo | Carga em campos E e B uniformes (cíclotron e deriva E×B) | Integrador de Boris |

Equações, hipóteses e limitações de cada modelo estão em [`docs/MODELOS.md`](docs/MODELOS.md) e também aparecem na própria interface.

## Instalação e execução

Requisitos: **Node.js 20 ou superior** e npm.

```bash
npm install        # instala as dependências
npm run dev        # servidor de desenvolvimento em http://localhost:5173
```

Outros comandos:

```bash
npm test           # roda os testes (Vitest)
npm run typecheck  # verificação de tipos (TypeScript)
npm run build      # gera a versão de produção em dist/
npm run preview    # serve a versão de produção em http://localhost:4173
```

A pasta `dist/` é estática (caminhos relativos) e pode ser publicada em qualquer hospedagem de arquivos (GitHub Pages, Netlify, um servidor nginx etc.).

## Aplicativo de desktop (Windows)

A plataforma também é distribuída como programa para Windows, empacotada com [Electron](https://www.electronjs.org/). Funciona offline e guarda a biblioteca e o histórico no próprio computador.

- **Baixar:** página [Releases](../../releases) do repositório. Use `FisicaTeorica-Setup-<versão>.exe` (instalador) ou `FisicaTeorica-Portatil-<versão>.exe` (roda sem instalar).
- **Rodar a versão desktop em desenvolvimento:** `npm run desktop`.
- **Gerar o `.exe` localmente:** `npm run dist:win` (os arquivos saem em `release/`). No Windows funciona direto; no Linux/macOS é preciso ter o Wine instalado (com suporte a 32 bits).
- **Publicar uma nova versão:** atualize `version` no `package.json`, faça o commit e envie uma tag, por exemplo `git tag v0.2.0 && git push origin v0.2.0`. O workflow `.github/workflows/release.yml` roda os testes, compila no Windows e anexa os executáveis ao Release. Também dá para disparar manualmente em **Actions → Release Windows → Run workflow**, informando a versão (ex.: `v0.2.0`); a tag é criada automaticamente.

O executável não tem assinatura digital, então o Windows SmartScreen pode mostrar um aviso na primeira execução ("Mais informações" → "Executar assim mesmo").

## Arquitetura

```
src/
├── core/                  # Lógica pura em TypeScript (sem DOM, testável)
│   ├── math/engine.ts     # Avaliação, simplificação, derivadas, equações, integrais (mathjs)
│   ├── units/units.ts     # Conversão de unidades e análise dimensional
│   ├── physics/
│   │   ├── constants.ts   # Constantes CODATA 2018 / SI 2019
│   │   ├── formulas.ts    # Catálogo de fórmulas documentadas
│   │   ├── formulaSolver.ts
│   │   └── areas.ts
│   ├── simulations/
│   │   ├── types.ts       # Interface SimulationModel e validação de parâmetros
│   │   ├── integrators.ts # RK4, AGM
│   │   ├── models/        # Um arquivo por modelo físico
│   │   └── index.ts       # Registro de modelos
│   └── storage/stores.ts  # Biblioteca e histórico (armazenamento injetável)
└── ui/                    # Interface React
    ├── App.tsx, AppContext.tsx
    ├── components/        # Tex (KaTeX), Plot (Plotly), ResultPanel
    └── pages/             # Uma página por ferramenta
tests/                     # Testes dos cálculos principais
electron/main.cjs          # Processo principal do app de desktop
build/                     # Ícone do aplicativo
.github/workflows/         # Build e publicação do .exe no GitHub Releases
```

Bibliotecas: [mathjs](https://mathjs.org) (matemática simbólica, numérica e unidades), [KaTeX](https://katex.org) (fórmulas), [Plotly.js](https://plotly.com/javascript/) (gráficos interativos, carregado sob demanda), React + Vite + TypeScript, Vitest.

A interface nunca faz contas: ela chama funções de `src/core`, que validam as entradas e lançam `MathError` com mensagens em português, exibidas no painel de resultados e erros.

### Como adicionar um novo modelo físico

1. Crie `src/core/simulations/models/meuModelo.ts` exportando um objeto `SimulationModel` (veja `types.ts`): parâmetros com limites, equações em LaTeX, método, hipóteses, limitações, referências e a função `run(params)` que devolve resumo numérico, gráficos e avisos.
2. Inclua o modelo na lista `SIMULATIONS` em `src/core/simulations/index.ts`.
3. Escreva testes em `tests/` comparando com um resultado analítico ou tabelado.

A página de simulações monta o formulário, os gráficos e a documentação automaticamente.

### Como adicionar uma fórmula ao catálogo

Acrescente um item a `FORMULA_CATALOG` em `src/core/physics/formulas.ts`. O teste `formulas.test.ts` verifica automaticamente que todas as variáveis estão documentadas e que a fórmula é **dimensionalmente consistente** com as unidades declaradas.

## Sintaxe das expressões

- Operadores: `+ - * / ^`, multiplicação implícita (`2x`), parênteses.
- Funções: `sqrt`, `exp`, `log` (natural), `log10`, `sin`, `cos`, `tan`, `asin`, `sinh`, `abs` etc. Ângulos em radianos.
- Constantes matemáticas: `pi`, `e`.
- Constantes físicas (valores SI): `c`, `G`, `h`, `hbar`, `qe` (carga elementar), `kB`, `NA`, `R`, `me`, `mp`, `mn`, `amu`, `eps0`, `mu0`, `alpha`, `sigmaSB`, `bWien`, `a0`, `g0`, `Msun`. A lista completa está em **Unidades → Constantes físicas**.
- Unidades (calculadora e conversor): `m`, `km`, `s`, `kg`, `N`, `J`, `eV`, `MeV`, `K`, `degC`, `Pa`, `atm`, `T`, `au`, `lightyear`, `parsec` e as demais do mathjs, com prefixos SI.

> Na calculadora, com "Usar constantes físicas" ativado, `h` é a constante de Planck. Para horas use `hour`.

## Verificação dos cálculos

Os testes (`npm test`, 70+ casos) comparam os resultados com valores conhecidos, entre eles:

| Caso | Valor esperado |
|---|---|
| Raiz de `cos x = x` | 0,739085133215 (número de Dottie) |
| ∫ e^(−x²) dx em [−10, 10] | √π |
| Energia de repouso de 1 kg | 8,98755 × 10¹⁶ J |
| Estado fundamental do hidrogênio (Bohr) | −13,606 eV |
| Raio de Schwarzschild do Sol | ≈ 2953 m |
| Volume molar a 0 °C e 1 atm | 0,0224140 m³ |
| Pêndulo a 90°: T/T₀ | 1,18034 |
| Projétil sem arrasto | R = v₀² sen 2θ / g |
| 1 g durante 1 ano (relatividade) | v ≈ 0,718 c |
| Elétron em poço de 1 nm | E₁ ≈ 0,376 eV |
| Einstein–de Sitter | t₀ = 2/(3H₀), D_C(z) analítica |
| ΛCDM Planck 2018 | idade ≈ 13,8 Ga |
| N₂ a 300 K | v_rms ≈ 517 m/s |
| Próton em B = 1 T | T_c = 2πm/(qB), órbita fechada, \|v\| conservado |
| Deriva E×B | v = E/B |

Os testes também verificaram a **consistência dimensional de todas as 37 fórmulas do catálogo**.

## Hipóteses e limitações gerais

- Os valores numéricos usam ponto flutuante de dupla precisão (~15–16 dígitos significativos).
- No editor de fórmulas, os valores são **interpretados em unidades SI**. As unidades informadas servem para a verificação dimensional, não para conversão automática.
- A simplificação simbólica é a do mathjs: não aplica identidades trigonométricas nem fatoração avançada.
- A busca numérica de raízes encontra raízes com mudança de sinal. Raízes de multiplicidade par (ex.: `x^2 = 0` resolvida numericamente) ou fora do intervalo podem não aparecer. Os polos são descartados.
- O radiano é tratado como adimensional (convenção do SI).
- Os dados ficam só no navegador atual. Limpar os dados do site apaga a biblioteca; use **Exportar JSON** para guardar uma cópia.
- Cada simulação lista as próprias limitações (ex.: o pêndulo e a partícula carregada não são relativísticos, e o ΛCDM usa w = −1 constante).
