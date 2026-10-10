# Modelos de simulação

Documentação dos modelos disponíveis em **Simulações**. O mesmo conteúdo aparece na interface, gerado a partir de `src/core/simulations/models/`.

## Lançamento de projétil com resistência do ar

**Área:** Mecânica clássica · **Identificador:** `projectile`

Integra a trajetória de uma esfera com arrasto quadrático e compara com a parábola ideal sem ar.

### Equações

$$m\,\dot{\vec v} = m\vec g - \tfrac{1}{2}\rho\,C_d A\,|\vec v|\,\vec v$$

$$A = \pi d^2/4$$

$$\text{vácuo: } R = \dfrac{v_0^2\sin 2\theta}{g}\;(h_0 = 0)$$

### Método

Runge–Kutta de 4ª ordem, passo fixo de 1 ms; instante de impacto por interpolação linear.

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Velocidade inicial | m/s | 40 | 0.1 a 1000 |
| Ângulo de lançamento | ° | 45 | 0.5 a 89.5 |
| Altura inicial | m | 0 | 0 a 10000 |
| Massa | kg | 0.145 | 0.0001 a 10000 |
| Diâmetro | m | 0.074 | 0.0001 a 10 |
| Coeficiente de arrasto C_d | — | 0.47 | 0 a 3 |
| Densidade do ar | kg/m³ | 1.225 | 0 a 20 |
| Gravidade | m/s² | 9.81 | 0.01 a 100 |

### Hipóteses

- Esfera rígida sem rotação (sem efeito Magnus)
- C_d constante (regime turbulento, Re ~ 10³–10⁵)
- Ar parado, densidade uniforme
- g uniforme, Terra plana e sem rotação

### Limitações

- C_d real varia com o número de Reynolds (crise do arrasto)
- Não modela vento, rotação nem variação de densidade com a altitude

### Referências

- Taylor, Classical Mechanics, cap. 2
- Valores típicos: C_d ≈ 0,47 para esfera

## Pêndulo simples não linear

**Área:** Mecânica clássica · **Identificador:** `pendulum`

Resolve a equação completa do pêndulo (sem aproximar sen θ ≈ θ), com amortecimento opcional, e compara com a solução linear.

### Equações

$$\ddot\theta = -\dfrac{g}{L}\sin\theta - b\,\dot\theta$$

$$T_0 = 2\pi\sqrt{L/g}\quad(\text{pequenas oscilações})$$

$$T = \dfrac{2\pi\sqrt{L/g}}{\mathrm{AGM}\left(1, \cos\frac{\theta_0}{2}\right)}\quad(\text{exato}, b = 0)$$

### Método

Runge–Kutta de 4ª ordem com passo T₀/2000; período medido por cruzamentos de θ = 0.

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Comprimento | m | 1 | 0.01 a 1000 |
| Gravidade | m/s² | 9.81 | 0.01 a 100 |
| Amplitude inicial θ₀ | ° | 60 | 0.1 a 179 |
| Amortecimento b | 1/s | 0 | 0 a 10 |
| Duração (em períodos T₀) | — | 5 | 1 a 100 |

### Hipóteses

- Massa pontual, fio rígido e sem massa
- Amortecimento viscoso linear (b·θ̇)
- Oscilação plana

### Limitações

- Amortecimento real pode ser quadrático na velocidade
- θ₀ = 180° é um equilíbrio instável (não permitido)

### Referências

- Goldstein, Classical Mechanics
- Período exato via integral elíptica completa K(k), k = sen(θ₀/2)

## Foguete relativístico (aceleração própria constante)

**Área:** Relatividade · **Identificador:** `relativistic-rocket`

Compara a viagem de uma nave com aceleração própria constante segundo a relatividade restrita e segundo a mecânica newtoniana; mostra o tempo próprio vivido pela tripulação.

### Equações

$$v(t) = \dfrac{a t}{\sqrt{1 + (a t / c)^2}}$$

$$x(t) = \dfrac{c^2}{a}\left(\sqrt{1 + (a t/c)^2} - 1\right)$$

$$\tau(t) = \dfrac{c}{a}\,\operatorname{arsinh}\!\left(\dfrac{a t}{c}\right)$$

### Método

Solução analítica exata do movimento hiperbólico (Rindler), avaliada em 400 pontos.

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Aceleração própria | m/s² | 9.81 | 0.01 a 10000 |
| Duração (tempo coordenado) | anos | 5 | 0.01 a 1000 |

### Hipóteses

- Espaço-tempo plano (sem gravidade)
- Aceleração própria constante, movimento retilíneo, partida do repouso
- t = tempo coordenado no referencial inercial de partida

### Limitações

- Ignora o consumo de combustível (equação do foguete relativístico)
- Não considera desaceleração para chegada

### Referências

- Rindler, Relativity: Special, General and Cosmological, §3.8
- Misner, Thorne & Wheeler, Gravitation, §6.2

## Partícula em poço infinito: superposição de estados

**Área:** Mecânica quântica · **Identificador:** `quantum-box`

Mostra os níveis de energia, as autofunções e a evolução temporal da densidade de probabilidade de uma superposição de dois estados estacionários.

### Equações

$$E_n = \dfrac{n^2\pi^2\hbar^2}{2mL^2},\quad \psi_n(x) = \sqrt{\tfrac{2}{L}}\sin\dfrac{n\pi x}{L}$$

$$\Psi(x,t) = \sqrt{1-w}\,\psi_{n_1}e^{-iE_{n_1}t/\hbar} + \sqrt{w}\,\psi_{n_2}e^{-iE_{n_2}t/\hbar}$$

$$T_{osc} = \dfrac{2\pi\hbar}{|E_{n_2} - E_{n_1}|}$$

### Método

Solução analítica da equação de Schrödinger; normalização e ⟨x⟩ verificados por integração numérica (Simpson adaptativo).

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Largura do poço | nm | 1 | 0.01 a 10000 |
| Massa | mₑ | 1 | 0.001 a 1000000 |
| Estado n₁ | — | 1 | 1 a 50 |
| Estado n₂ | — | 2 | 1 a 50 |
| Peso de n₂ na superposição (w) | — | 0.5 | 0 a 1 |
| Instante mostrado (fração de T_osc) | — | 0.25 | 0 a 1 |

### Hipóteses

- Poço unidimensional com paredes infinitas
- Partícula não relativística e sem spin
- Coeficientes reais em t = 0

### Limitações

- Poços reais são finitos (há tunelamento e menos estados ligados)
- Não inclui interações nem decoerência

### Referências

- Griffiths, Introduction to Quantum Mechanics, §2.2
- Constantes CODATA 2018

## Expansão do universo (modelo ΛCDM / Friedmann)

**Área:** Cosmologia · **Identificador:** `lcdm`

Integra a equação de Friedmann para obter a idade do universo, a evolução do fator de escala e as distâncias cosmológicas em função do redshift.

### Equações

$$H(a)^2 = H_0^2\left(\Omega_r a^{-4} + \Omega_m a^{-3} + \Omega_k a^{-2} + \Omega_\Lambda\right)$$

$$\Omega_k = 1 - \Omega_m - \Omega_\Lambda - \Omega_r$$

$$t(a) = \int_0^a \dfrac{da'}{a' H(a')},\quad D_C(z) = c\int_0^z \dfrac{dz'}{H(z')}$$

$$D_L = (1+z)\,D_M,\quad D_A = D_M/(1+z)$$

### Método

Quadratura de Simpson adaptativa (com substituição a = u² perto do Big Bang).

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Constante de Hubble H₀ | km/s/Mpc | 67.4 | 1 a 200 |
| Densidade de matéria Ωm | — | 0.315 | 0 a 5 |
| Constante cosmológica ΩΛ | — | 0.684909 | -2 a 5 |
| Densidade de radiação Ωr | — | 0.000091 | 0 a 1 |
| Redshift máximo (distâncias) | — | 5 | 0.01 a 1100 |

### Hipóteses

- Métrica FLRW (universo homogêneo e isotrópico)
- Matéria sem pressão, radiação com w = 1/3, Λ constante (w = −1)
- Neutrinos tratados como radiação ou matéria (não ambos)

### Limitações

- Não modela energia escura dinâmica (w ≠ −1) nem a transição dos neutrinos massivos
- Parâmetros que fazem H² ≤ 0 no passado (sem Big Bang) são rejeitados

### Referências

- Hogg (1999), "Distance measures in cosmology", arXiv:astro-ph/9905116
- Planck 2018 VI: H₀ = 67,4, Ωm = 0,315 (A&A 641, A6); ΩΛ padrão = 1 − Ωm − Ωr (universo plano)

## Distribuição de velocidades de Maxwell–Boltzmann

**Área:** Termodinâmica · **Identificador:** `maxwell-boltzmann`

Distribuição de velocidades moleculares de um gás ideal em equilíbrio térmico, comparando duas temperaturas.

### Equações

$$f(v) = 4\pi\left(\dfrac{m}{2\pi k_B T}\right)^{3/2} v^2\, e^{-m v^2 / 2 k_B T}$$

$$v_p = \sqrt{\dfrac{2k_BT}{m}},\quad \bar v = \sqrt{\dfrac{8k_BT}{\pi m}},\quad v_{rms} = \sqrt{\dfrac{3k_BT}{m}}$$

### Método

Avaliação analítica; normalização verificada por integração numérica (Simpson adaptativo).

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Massa molar | g/mol | 28.0134 | 0.001 a 1000 |
| Temperatura 1 | K | 300 | 0.01 a 1000000 |
| Temperatura 2 | K | 1000 | 0.01 a 1000000 |

### Hipóteses

- Gás ideal clássico em equilíbrio térmico
- Moléculas idênticas de massa m = M/N_A

### Limitações

- Não vale para gases degenerados (efeitos quânticos a baixa T ou alta densidade)
- Ignora interações intermoleculares

### Referências

- Maxwell (1860); Boltzmann (1872)
- Reif, Fundamentals of Statistical and Thermal Physics, §7.10

## Processos de um gás ideal (diagrama P–V)

**Área:** Termodinâmica · **Identificador:** `ideal-gas-processes`

Compara expansões isotérmica, adiabática e isobárica de um gás ideal entre os mesmos volumes, com o trabalho realizado em cada caso.

### Equações

$$PV = nRT$$

$$\text{isotérmico: } W = nRT_1\ln(V_2/V_1)$$

$$\text{adiabático: } PV^\gamma = \text{const},\; W = \dfrac{P_1V_1 - P_2V_2}{\gamma - 1}$$

$$\text{isobárico: } W = P_1 (V_2 - V_1)$$

### Método

Fórmulas analíticas; trabalho conferido por integração numérica de ∫P dV.

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Quantidade de substância | mol | 1 | 0.000001 a 1000000 |
| Temperatura inicial | K | 300 | 0.01 a 100000 |
| Volume inicial | L | 10 | 0.000001 a 1000000000 |
| Volume final | L | 30 | 0.000001 a 1000000000 |
| Índice adiabático γ | — | 1.4 | 1.0001 a 3 |

### Hipóteses

- Gás ideal
- Processos quase-estáticos (reversíveis)
- γ = C_p/C_v constante

### Limitações

- Gases reais desviam a altas pressões
- Processos reais rápidos são irreversíveis

### Referências

- Callen, Thermodynamics, cap. 4
- γ = 5/3 (monoatômico), 7/5 (diatômico)

## Partícula carregada em campos E e B uniformes

**Área:** Eletromagnetismo · **Identificador:** `charged-particle`

Integra a força de Lorentz para uma carga em campo magnético na direção z e campo elétrico no plano xy, mostrando o movimento de cíclotron e a deriva E×B.

### Equações

$$m\,\dot{\vec v} = q\left(\vec E + \vec v \times \vec B\right)$$

$$\omega_c = \dfrac{|q|B}{m},\quad T_c = \dfrac{2\pi m}{|q|B},\quad r_L = \dfrac{m v_\perp}{|q|B}$$

$$\vec v_{E\times B} = \dfrac{\vec E \times \vec B}{B^2}$$

### Método

Integrador de Boris com 400 passos por período de cíclotron.

### Parâmetros

| Parâmetro | Unidade | Padrão | Faixa |
|---|---|---|---|
| Carga | e | 1 | -100 a 100 |
| Massa | mₚ | 1 | 0.0001 a 10000 |
| Campo magnético B_z | T | 0.01 | 1e-9 a 100 |
| Campo elétrico E_x | V/m | 0 | -10000000 a 10000000 |
| Campo elétrico E_y | V/m | 200 | -10000000 a 10000000 |
| Velocidade inicial v_x | m/s | 100000 | -30000000 a 30000000 |
| Velocidade inicial v_z | m/s | 0 | -30000000 a 30000000 |
| Duração (períodos de cíclotron) | — | 5 | 1 a 50 |

### Hipóteses

- Campos uniformes e estáticos
- Movimento não relativístico
- Sem radiação (perda de energia por Larmor desprezada)

### Limitações

- Invalida-se para v ≳ 0,1c (use o integrador de Boris relativístico)
- Sem interação entre partículas

### Referências

- Boris (1970); Birdsall & Langdon, Plasma Physics via Computer Simulation
- Jackson, Classical Electrodynamics, §12
