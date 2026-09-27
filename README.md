# Calculadora de CR – IC/UFRJ

SPA leve e 100% client-side para leitura do **boletim/histórico não oficial do SIGA/UFRJ** e simulação de metas de notas. Desenvolvida com HTML5, CSS3 e JavaScript puro (ES modules), sem dependências de servidor ou framework.

## Funcionalidades

- **Histórico Completo via PDF**  
  Faça upload do `boletim.pdf` ou `historico.pdf` do SIGA. O processamento ocorre localmente no navegador com [`pdfjs-dist`](https://mozilla.github.io/pdf.js/). A aplicação extrai os dados, recalcula o CR acumulado e destaca disciplinas por situação (AP, RM, RF, RFM, NCG, NCC, T).

- **Simulador de Período Atual**  
  Adicione as disciplinas em curso com notas previstas e visualize o impacto no CR acumulado em tempo real. Inclui cálculo de **meta reversa**: descubra a média necessária nas disciplinas restantes para atingir um CR alvo.

- **Cálculo Rápido**  
  Para quando você não tem o PDF em mãos: insira créditos e pontos (ou CR atual + créditos) manualmente e simule o novo CR.

- **Persistência Local**  
  O último histórico processado e a preferência de tema são salvos automaticamente no `localStorage`. É possível exportar/importar o histórico como JSON.

- **Identidade Visual do IC/UFRJ com Temas Claro/Escuro**  
  Interface com tipografia `Montserrat` + `Open Sans`, ícones `Bootstrap Icons`, paleta institucional (`#344563`) e alternância nativa entre Light e Dark Mode, persistindo a escolha do usuário.

## Regras de negócio e precisão do cálculo

A calculadora segue as regras do SIGA/UFRJ para o Coeficiente de Rendimento (CR):

```
CR = Σ(Grau × CrR) / Σ(CrR)
```

Onde `Grau` é a nota final e `CrR` são os créditos requisitados da disciplina. Apenas disciplinas que **conferem grau** entram no numerador e no denominador.

### Situações tratadas

| Situação (SF) | Conferem grau? | Comportamento no CR |
|---------------|----------------|----------------------|
| **AP**        | Sim            | Entra com grau × CrR no numerador e CrR no denominador. |
| **RM** / **RF** / **RFM** | Sim | Reprovações entram no cálculo com grau 0, reduzindo o CR. |
| **NCG**       | Não            | Disciplina sem grau; ignora CrR e pontos. |
| **NCC**       | Não            | Disciplina que não confere crédito; ignora CrR e pontos. |
| **T**         | Não            | Transferência/equivalência; ignora CrR e pontos. |
| **Cursando**  | Não            | Disciplinas em curso não entram no CR de histórico concluído. |
| Trancamentos  | Não            | Períodos com trancamento são ignorados. |

> **Detalhe importante:** alguns boletins exibem a disciplina com SF `AP` e, ao mesmo tempo, grau textual `T`, `NCG` ou `NCC` (ex: transferências aprovadas por equivalência). Nesses casos, a disciplina é excluída do divisor do CR, mesmo que a situação final seja `AP`.

### Exemplo de validação contra o `boletim.pdf`

- **Créditos acumulados exibidos no PDF:** `196,0`
- **CrR efetivo com grau:** `190,0` (exclui `ICP136`=4,0 cr como transferência `T` e `ICPX06`=2,0 cr como `NCG`)
- **Pontos acumulados:** `1336,1`
- **CR calculado:** `1336,1 / 190,0 = 7,032` (o SIGA pode arredondar para `7,0` na interface)

### Formatos numéricos

A interface aceita tanto **vírgula** quanto **ponto** como separador decimal. Os resultados são exibidos no padrão brasileiro (vírgula como separador decimal).

## Como executar localmente

Como a aplicação usa ES modules e o worker do `pdfjs-dist`, abra-a através de um servidor local (não funciona diretamente com `file://`).

Opção 1 – via `npx serve`:

```bash
npx serve
```

Opção 2 – via Python:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080` (ou a porta indicada).

Você também pode usar a extensão **Live Server** do VS Code a partir da raiz do projeto.

## Estrutura do projeto

```
calculadora-de-nota/
├── index.html              # SPA principal
├── css/
│   └── styles.css          # variáveis CSS, tipografia e componentes (Light/Dark Mode)
├── js/
│   ├── app.js              # inicialização, tema e navegação de abas
│   ├── pdfParser.js        # extração e parsing dos PDFs do SIGA
│   ├── boaParser.js        # parser opcional do BOA (sugestão de matérias)
│   ├── calculator.js       # motor de cálculo de CR e metas reversas
│   ├── storage.js          # localStorage, exportação/importação JSON e preferência de tema
│   └── ui.js               # helpers de DOM e renderização
├── data/                   # dados de exemplo gerados (não versionado)
├── docs-pessoais/          # PDFs e planilhas pessoais para testes (não versionado)
└── README.md
```

## Privacidade

Nenhum dado pessoal ou histórico escolar sai do seu navegador. Todo o processamento de PDFs, cálculos e persistência acontece localmente.

## Licença

MIT
